import { spawn, ChildProcess } from "child_process";
import * as os from "os";
import * as path from "path";

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

  public get() {
    return this.lines.join("\n");
  }
}

export class RuntimeInstance {
  private stopped = false;

  constructor(
    private child: ChildProcess,
    public readonly port: number,
    private stdout: BoundedLog,
    private stderr: BoundedLog
  ) {}

  public getLogs() {
    return { stdout: this.stdout.get(), stderr: this.stderr.get() };
  }

  public async stop(): Promise<void> {
    if (this.stopped || this.child.killed || this.child.exitCode !== null) return;
    this.stopped = true;

    return new Promise((resolve) => {
      this.child.once("exit", () => resolve());
      this.child.once("close", () => resolve());

      if (os.platform() === "win32" && this.child.pid) {
        spawn("taskkill", ["/PID", this.child.pid.toString(), "/T", "/F"]);
      } else {
        this.child.kill("SIGKILL");
      }
    });
  }
}

export class RuntimeOrchestrator {
  private npmCmd = os.platform() === "win32" ? "npm.cmd" : "npm";

  public async install(dir: string): Promise<void> {
    await this.execPromise(this.npmCmd, ["install", "--no-audit", "--no-fund", "--prefer-offline"], dir, 90000, "Install");
  }

  public async build(dir: string): Promise<void> {
    const tscBin = os.platform() === "win32"
      ? path.join(dir, "node_modules", ".bin", "tsc.CMD")
      : path.join(dir, "node_modules", ".bin", "tsc");
    await this.execPromise(tscBin, [], dir, 90000, "Build");
  }

  public async start(dir: string): Promise<RuntimeInstance> {
    return new Promise((resolve, reject) => {
      const stdoutLog = new BoundedLog();
      const stderrLog = new BoundedLog();

      const child = spawn("node", ["dist/main.js"], {
        cwd: dir,
        env: { ...process.env, PORT: "0" },
      });

      const timeout = setTimeout(() => {
        this.killProcess(child);
        reject(new Error(`Start timeout after 10s.\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      }, 10000);

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn start process: ${err.message}\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      });

      const readinessRegex = /^BACKEND_OS_READY:(\d+)$/m;

      child.stdout.on("data", (chunk) => {
        stdoutLog.append(chunk);
        const match = readinessRegex.exec(stdoutLog.get());
        if (match) {
          clearTimeout(timeout);
          const port = parseInt(match[1], 10);
          resolve(new RuntimeInstance(child, port, stdoutLog, stderrLog));
        }
      });

      child.stderr.on("data", (chunk) => stderrLog.append(chunk));

      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Process crashed before readiness. Exit Code: ${code}\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      });
    });
  }

  private killProcess(child: ChildProcess) {
    if (os.platform() === "win32" && child.pid) {
      spawn("taskkill", ["/PID", child.pid.toString(), "/T", "/F"]);
    } else {
      child.kill("SIGKILL");
    }
  }

  private execPromise(cmd: string, args: string[], cwd: string, timeoutMs: number, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stdoutLog = new BoundedLog();
      const stderrLog = new BoundedLog();

      const child = spawn(cmd, args, { cwd, shell: os.platform() === "win32" });

      const timeout = setTimeout(() => {
        this.killProcess(child);
        reject(new Error(`${label} Timeout (${timeoutMs}ms).\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      }, timeoutMs);

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn ${label} process: ${err.message}\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
      });

      child.stdout.on("data", (chunk) => stdoutLog.append(chunk));
      child.stderr.on("data", (chunk) => stderrLog.append(chunk));

      child.once("exit", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`${label} Failed with code ${code}.\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
        } else {
          resolve();
        }
      });
    });
  }
}