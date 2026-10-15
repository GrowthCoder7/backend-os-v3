import { spawn, ChildProcess } from "child_process";
import * as os from "os";
import * as path from "path";
import { promises as fs } from "fs";

class BoundedLog {
  private lines: string[] = [];
  constructor(private limit: number = 200) {}

  public append(chunk: Buffer | string) {
    const newLines = chunk.toString("utf-8").split(/\r?\n/);
    this.lines.push(...newLines);
    if (this.lines.length > this.limit) {
      this.lines = this.lines.slice(this.lines.length - this.limit);
    }
  }

  public get() { return this.lines.join("\n"); }
}

export class RuntimeInstance {
  private stopped = false;
  private hasExited = false;
  private exitPromise: Promise<void>;

  constructor(
    private child: ChildProcess,
    public readonly port: number,
    private stdout: BoundedLog,
    private stderr: BoundedLog
  ) {
    // Attach listeners immediately to avoid race conditions
    this.exitPromise = new Promise((resolve) => {
      this.child.once("exit", () => { this.hasExited = true; resolve(); });
      this.child.once("close", () => { this.hasExited = true; resolve(); });
      this.child.once("error", () => { this.hasExited = true; resolve(); });
    });
  }

  public getLogs() { return { stdout: this.stdout.get(), stderr: this.stderr.get() }; }

  public async stop(): Promise<void> {
    if (!this.hasExited && !this.stopped) {
      this.stopped = true;
      if (os.platform() === "win32" && this.child.pid) {
        spawn("taskkill", ["/PID", this.child.pid.toString(), "/T", "/F"]);
      } else {
        this.child.kill("SIGKILL");
      }
    }
    // Guarantee resolution only when process has completely exited
    await this.exitPromise;
  }
}

export class RuntimeOrchestrator {
  private npmCmd = os.platform() === "win32" ? "npm.cmd" : "npm";

  public async install(dir: string): Promise<void> {
    await this.execPromise(this.npmCmd, ["install", "--no-audit", "--no-fund", "--prefer-offline"], dir, 90000, "Install");
  }

  private validateTestDatabaseUrl(databaseUrl: string, confirmDisposableTestDb: boolean): { dbName: string, schemaName: string } {
    if (!confirmDisposableTestDb) {
      throw new Error("Security Guard: Schema operations require explicit opt-in confirmation.");
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(databaseUrl);
    } catch (e) {
      throw new Error("Security Guard: Malformed database URL provided.");
    }

    if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
      throw new Error(`Security Guard: Protocol must be postgres(ql):. Received '${parsedUrl.protocol}'`);
    }

    const host = parsedUrl.hostname.replace(/^\[/, "").replace(/\]$/, "");
    const allowedHosts = ["localhost", "127.0.0.1", "::1"];
    if (!allowedHosts.includes(host)) {
      throw new Error(`Security Guard: Hostname '${host}' is not an approved loopback interface.`);
    }

    const dbName = parsedUrl.pathname.replace(/^\//, "").toLowerCase();
    const isValidTestDb = dbName === "test" || dbName.startsWith("test_") || dbName.endsWith("_test");
    if (!isValidTestDb) {
      throw new Error(`Security Guard: Database name '${dbName}' does not match the strict test naming convention.`);
    }

    const schemaName = parsedUrl.searchParams.get("schema");
    if (!schemaName) {
      throw new Error("Security Guard: Database URL must explicitly define a ?schema parameter to ensure isolation during test runs.");
    }

    // Strict schema identifier verification (prevents SQL injection and enforces PostgreSQL limits)
    const schemaRegex = /^test_[a-zA-Z0-9_]+$/;
    if (!schemaRegex.test(schemaName) || schemaName.length > 63) {
      throw new Error(`Security Guard: Target schema '${schemaName}' is invalid. Must match ^test_[a-zA-Z0-9_]+$ and be <= 63 characters.`);
    }

    return { dbName, schemaName };
  }

  public async prepareDatabase(dir: string, databaseUrl: string, confirmDisposableTestDb: boolean): Promise<void> {
    this.validateTestDatabaseUrl(databaseUrl, confirmDisposableTestDb);
    
    await this.execPromise(
      this.npmCmd, 
      ["run", "db:push"], 
      dir, 
      60000, 
      "DB Push", 
      { DATABASE_URL: databaseUrl }
    );
  }

  public async cleanupDatabase(dir: string, databaseUrl: string, confirmDisposableTestDb: boolean): Promise<void> {
    const { schemaName } = this.validateTestDatabaseUrl(databaseUrl, confirmDisposableTestDb);
    const sqlPath = path.join(dir, "drop_schema.sql");
    
    // Explicit, safe interpolation (schemaName is regex-enforced alphanumeric)
    await fs.writeFile(sqlPath, `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    
    try {
      // Prisma >= 7 compatibility: Passed connection strictly via env, dropped --url
      await this.execPromise(
        this.npmCmd, 
        ["exec", "prisma", "db", "execute", "--file", "drop_schema.sql"], 
        dir, 
        60000, 
        "DB Cleanup",
        { DATABASE_URL: databaseUrl }
      );
    } catch (error) {
      throw new Error(`Security Guard: Database cleanup explicitly failed. Orphaned schema '${schemaName}' may remain. Original error: ${error}`);
    } finally {
      await fs.rm(sqlPath, { force: true }).catch(() => {});
    }
  }

  public async build(dir: string): Promise<void> {
    await this.execPromise(this.npmCmd, ["run", "build"], dir, 120000, "Build");
  }

  public async start(dir: string, extraEnv?: NodeJS.ProcessEnv): Promise<RuntimeInstance> {
    return new Promise((resolve, reject) => {
      const stdoutLog = new BoundedLog();
      const stderrLog = new BoundedLog();

      const child = spawn("node", ["dist/main.js"], {
        cwd: dir,
        env: { ...process.env, PORT: "0", ...extraEnv },
      });

      const timeout = setTimeout(() => {
        this.killProcess(child);
        reject(new Error(`Start timeout.\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      }, 10000);

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn start process: ${err.message}`));
      });

      const readinessRegex = /^BACKEND_OS_READY:(\d+)$/m;
      child.stdout.on("data", (chunk) => {
        stdoutLog.append(chunk);
        const match = readinessRegex.exec(stdoutLog.get());
        if (match) {
          clearTimeout(timeout);
          resolve(new RuntimeInstance(child, parseInt(match[1], 10), stdoutLog, stderrLog));
        }
      });
      child.stderr.on("data", (chunk) => stderrLog.append(chunk));

      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Process crashed. Exit Code: ${code}\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      });
    });
  }

  private killProcess(child: ChildProcess) {
    if (os.platform() === "win32" && child.pid) spawn("taskkill", ["/PID", child.pid.toString(), "/T", "/F"]);
    else child.kill("SIGKILL");
  }

  private execPromise(cmd: string, args: string[], cwd: string, timeoutMs: number, label: string, extraEnv?: NodeJS.ProcessEnv): Promise<void> {
    return new Promise((resolve, reject) => {
      const stdoutLog = new BoundedLog();
      const stderrLog = new BoundedLog();
      const child = spawn(cmd, args, { cwd, shell: os.platform() === "win32", env: { ...process.env, ...extraEnv } });

      const timeout = setTimeout(() => {
        this.killProcess(child);
        reject(new Error(`${label} Timeout.\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      }, timeoutMs);

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn ${label}: ${err.message}`));
      });
      child.stdout.on("data", (chunk) => stdoutLog.append(chunk));
      child.stderr.on("data", (chunk) => stderrLog.append(chunk));
      child.once("exit", (code) => {
        clearTimeout(timeout);
        if (code !== 0) reject(new Error(`${label} Failed with code ${code}.\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
        else resolve();
      });
    });
  }
}