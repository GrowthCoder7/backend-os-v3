import { spawn, ChildProcess } from "child_process";
import * as os from "os";
import * as path from "path";
import { promises as fs } from "fs";

export interface OrchestratorObserver {
  onLog?: (stream: "stdout" | "stderr" | "system", chunk: string) => void;
}

/** A retryable capability for process termination that has not yet been confirmed. */
export interface TerminationHandle {
  retryTermination: () => Promise<void>;
}

/** Thrown only when a child process may still be alive after termination was attempted. */
export class TerminationUnconfirmedError extends Error {
  public readonly terminationHandle: TerminationHandle;
  public readonly primaryFailure?: unknown;

  constructor(message: string, terminationHandle: TerminationHandle, primaryFailure?: unknown) {
    super(message);
    this.name = "TerminationUnconfirmedError";
    this.terminationHandle = terminationHandle;
    this.primaryFailure = primaryFailure;
  }
}

const URL_PASSWORD_PATTERN = /\b([a-z][a-z0-9+.-]*:\/\/[^:/\s?#@]+:)[^@\s/?#]*@/gi;
const JSON_SECRET_PATTERN = /(["'](?:password|passwd|pwd|token|secret|api[_-]?key|authorization)["']\s*:\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^,}\s]+)/gi;
const ASSIGNED_SECRET_PATTERN = /\b(password|passwd|pwd|token|secret|api[_-]?key|authorization)\b(\s*[:=]\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}\r\n]+)/gi;
const AUTHORIZATION_HEADER_PATTERN = /((?:^|[\s,{])authorization\s*:\s*)(?:bearer\s+)?[^\r\n,;}]+/gi;
const BEARER_TOKEN_PATTERN = /(\bbearer\s+)[A-Za-z0-9._~+\/-]+=*/gi;

/** Redact credentials before storing logs, exposing logs, or invoking observers. */
export const redactCredentials = (message: string): string => {
  let redacted = message.replace(URL_PASSWORD_PATTERN, "$1***@");
  redacted = redacted.replace(JSON_SECRET_PATTERN, '$1"***"');
  redacted = redacted.replace(AUTHORIZATION_HEADER_PATTERN, "$1***");
  redacted = redacted.replace(BEARER_TOKEN_PATTERN, "$1***");
  redacted = redacted.replace(ASSIGNED_SECRET_PATTERN, "$1$2***");
  return redacted;
};

const truncateUtf8 = (value: string, maxBytes: number): string => {
  if (maxBytes <= 0) return "";
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;

  let output = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > maxBytes) break;
    output += character;
    bytes += characterBytes;
  }
  return output;
};

const truncateWithMarker = (value: string, maxBytes: number, marker = "...[TRUNCATED]"): string => {
  if (maxBytes <= 0) return "";
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const markerBytes = Buffer.byteLength(marker, "utf8");
  if (markerBytes >= maxBytes) return truncateUtf8(marker, maxBytes);
  return `${truncateUtf8(value, maxBytes - markerBytes)}${marker}`;
};

const tailUtf8 = (value: string, maxBytes: number): string => {
  if (maxBytes <= 0) return "";
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const characters = Array.from(value);
  let output = "";
  let bytes = 0;
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    const character = characters[index];
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (bytes + characterBytes > maxBytes) break;
    output = character + output;
    bytes += characterBytes;
  }
  return output;
};

/** A bounded, line-oriented log. Oversized unterminated lines are discarded to avoid leaking partial secrets. */
export class BoundedLog {
  private readonly lines: string[] = [];
  private totalBytes = 0;
  private pendingChunk = "";
  private discardUntilNewline = false;

  constructor(
    private readonly maxLines = 200,
    private readonly maxBytes = 50_000,
    private readonly streamName: "stdout" | "stderr" | "system" = "system",
    private readonly observer?: OrchestratorObserver,
  ) {
    if (!Number.isInteger(maxLines) || maxLines < 1) {
      throw new Error("maxLines must be a positive integer.");
    }
    if (!Number.isInteger(maxBytes) || maxBytes < 128) {
      throw new Error("maxBytes must be an integer of at least 128.");
    }
  }

  public append(chunk: Buffer | string): void {
    const input = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let cursor = 0;

    while (cursor < input.length) {
      if (this.discardUntilNewline) {
        const nextNewline = input.indexOf("\n", cursor);
        if (nextNewline === -1) return;
        this.discardUntilNewline = false;
        cursor = nextNewline + 1;
        continue;
      }

      const newline = input.indexOf("\n", cursor);
      const segmentEnd = newline === -1 ? input.length : newline;
      this.pendingChunk += input.slice(cursor, segmentEnd);

      if (Buffer.byteLength(this.pendingChunk, "utf8") > this.maxBytes) {
        this.processLine("[OVERSIZED LOG LINE OMITTED]");
        this.pendingChunk = "";
        this.discardUntilNewline = newline === -1;
      } else if (newline !== -1) {
        const line = this.pendingChunk.replace(/\r$/, "");
        this.pendingChunk = "";
        this.processLine(line);
      }

      if (newline === -1) return;
      cursor = newline + 1;
    }
  }

  /** Flush a final, bounded line when the producer closes its stream. */
  public flush(): void {
    if (this.discardUntilNewline) {
      this.discardUntilNewline = false;
      this.pendingChunk = "";
      return;
    }
    if (!this.pendingChunk) return;
    const finalLine = this.pendingChunk.replace(/\r$/, "");
    this.pendingChunk = "";
    // An unterminated line may end halfway through a credential (before the URL's
    // '@' delimiter), so do not emit its raw text during final flush.
    this.processLine("[FINAL UNTERMINATED LOG LINE OMITTED FOR SAFETY]");
  }

  private processLine(untrustedLine: string): void {
    // Reserve one byte for the newline included in totalBytes. Secret redaction
    // occurs before truncation and before any observer can receive the line.
    const redacted = redactCredentials(untrustedLine);
    const safeLine = truncateWithMarker(redacted, Math.max(0, this.maxBytes - 1));
    const lineBytesWithSeparator = Buffer.byteLength(safeLine, "utf8") + 1;

    this.lines.push(safeLine);
    this.totalBytes += lineBytesWithSeparator;

    while (this.lines.length > this.maxLines || this.totalBytes > this.maxBytes) {
      const removed = this.lines.shift();
      if (removed === undefined) break;
      this.totalBytes -= Buffer.byteLength(removed, "utf8") + 1;
    }

    if (this.observer?.onLog) {
      const observerPayload = truncateWithMarker(safeLine, 2_048);
      try {
        this.observer.onLog(this.streamName, observerPayload);
      } catch {
        // Observability callbacks must never crash the runtime process.
      }
    }
  }

  public get(): string {
    // Do not expose an unterminated partial chunk: it may contain a secret that
    // cannot yet be safely recognized or redacted.
    return this.lines.join("\n");
  }
}

const waitForChildExit = (child: ChildProcess, timeoutMs: number): Promise<boolean> => {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (exited: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.removeListener("exit", onExit);
      child.removeListener("close", onClose);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const onClose = () => finish(true);
    const timeout = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
    child.once("close", onClose);
  });
};

const runTaskkill = (pid: number, force: boolean): Promise<void> =>
  new Promise((resolve, reject) => {
    const args = ["/PID", String(pid), "/T"];
    if (force) args.push("/F");
    const killer = spawn("taskkill", args, { windowsHide: true });
    let stderr = "";
    killer.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = truncateUtf8(stderr + chunk.toString(), 2_048);
    });
    killer.once("error", (error) => reject(new Error(`Could not invoke taskkill: ${redactCredentials(error.message)}`)));
    killer.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`taskkill exited with code ${String(code)}${stderr ? `: ${redactCredentials(stderr)}` : ""}`));
    });
  });

const processGroupExists = (pid: number): boolean => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
    if (code === "ESRCH") return false;
    // EPERM and every unexpected error are treated as "possibly alive" so an
    // inability to inspect the group can never authorize destructive cleanup.
    return true;
  }
};

const waitForProcessGroupExit = async (pid: number, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processGroupExists(pid)) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  return !processGroupExists(pid);
};

const terminateChild = async (child: ChildProcess): Promise<void> => {
  const pid = child.pid;
  const leaderHasExited = child.exitCode !== null || child.signalCode !== null;

  if (os.platform() === "win32") {
    // A known PID is required to ask taskkill to terminate the process tree. Do
    // not interpret ChildProcess.killed as proof that the tree is gone.
    if (pid === undefined) {
      if (leaderHasExited) return;
      throw new Error("Cannot verify Windows process-tree termination because no PID is available.");
    }

    // Await taskkill and validate its exit code. If the root has already exited
    // and taskkill cannot verify the tree, fail closed and retain a retry handle.
    await runTaskkill(pid, true);
    if (!(await waitForChildExit(child, 3_000))) {
      throw new Error("Windows process termination could not be confirmed within the timeout.");
    }
    return;
  }

  if (pid === undefined) {
    if (leaderHasExited) return;
    try { child.kill("SIGTERM"); } catch { /* confirmation below decides */ }
    if (await waitForChildExit(child, 2_500)) return;
    try { child.kill("SIGKILL"); } catch { /* confirmation below decides */ }
    if (!(await waitForChildExit(child, 3_000))) {
      throw new Error("Process termination could not be confirmed within the timeout.");
    }
    return;
  }

  // The runtime and command processes are launched detached on Unix, so their
  // PID is also the process-group ID. Check the group even if its leader exited.
  if (leaderHasExited && !processGroupExists(pid)) return;

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // A race with natural process exit is acceptable only if verification below
    // proves the process group no longer exists.
    try { child.kill("SIGTERM"); } catch { /* final verification decides */ }
  }

  const groupExitedAfterTerm = await waitForProcessGroupExit(pid, 2_500);
  if (!groupExitedAfterTerm) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try { child.kill("SIGKILL"); } catch { /* final verification decides */ }
    }
  }

  const [leaderExited, groupExited] = await Promise.all([
    waitForChildExit(child, 3_000),
    waitForProcessGroupExit(pid, 3_000),
  ]);
  if (!leaderExited || !groupExited) {
    throw new Error("Process-tree termination could not be confirmed within the timeout.");
  }
};

const terminationHandleFor = (child: ChildProcess): TerminationHandle => ({
  retryTermination: () => terminateChild(child),
});

export class RuntimeInstance {
  private closed = false;
  private readonly exitPromise: Promise<void>;

  constructor(
    private readonly child: ChildProcess,
    public readonly port: number,
    private readonly stdout: BoundedLog,
    private readonly stderr: BoundedLog,
  ) {
    this.exitPromise = new Promise<void>((resolve) => {
      const finish = () => {
        if (this.closed) return;
        this.closed = true;
        this.stdout.flush();
        this.stderr.flush();
        resolve();
      };
      // 'close' occurs after process exit and stdio closure, so final log data is not lost.
      this.child.once("close", finish);
      if (this.child.exitCode !== null && this.child.stdout === null && this.child.stderr === null) {
        queueMicrotask(finish);
      }
    });
  }

  public getLogs(): { stdout: string; stderr: string } {
    return { stdout: this.stdout.get(), stderr: this.stderr.get() };
  }

  public async stop(): Promise<void> {
    // Even if the Node leader exited, its detached process group may still contain descendants.
    try {
      await terminateChild(this.child);
      await this.exitPromise;
    } catch (error: unknown) {
      throw new TerminationUnconfirmedError(
        `Runtime process termination could not be confirmed: ${safeErrorMessage(error)}`,
        terminationHandleFor(this.child),
        error,
      );
    }
  }
}

export interface TestDatabaseIdentity {
  dbName: string;
  schemaName: string;
  normalizedUrl: string;
  resourceKey: string;
}

/** Validate and canonicalize only disposable, loopback-hosted test database targets. */
export const validateDisposableTestDatabaseUrl = (
  databaseUrl: string,
  confirmDisposableTestDb: boolean,
): TestDatabaseIdentity => {
  if (!confirmDisposableTestDb) {
    throw new Error("Security Guard: Schema operations require explicit opt-in confirmation.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("Security Guard: Malformed database URL provided.");
  }

  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("Security Guard: Protocol must be postgres or postgresql.");
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"]);
  if (!allowedHosts.has(host)) {
    throw new Error("Security Guard: Database hostname is not an approved loopback interface.");
  }

  let dbName: string;
  try {
    dbName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
  } catch {
    throw new Error("Security Guard: Malformed database name encoding.");
  }
  if (!dbName || dbName.includes("/") || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error("Security Guard: Database name is invalid.");
  }

  const lowerDbName = dbName.toLowerCase();
  const isValidTestDb = lowerDbName === "test" || lowerDbName.startsWith("test_") || lowerDbName.endsWith("_test");
  if (!isValidTestDb) {
    throw new Error("Security Guard: Database name does not match the test naming convention.");
  }

  const schemas = parsedUrl.searchParams.getAll("schema");
  if (schemas.length !== 1 || !schemas[0]) {
    throw new Error("Security Guard: Database URL must define exactly one schema parameter.");
  }
  const schemaName = schemas[0];
  if (!/^test_[a-zA-Z0-9_]+$/.test(schemaName) || schemaName.length > 63) {
    throw new Error("Security Guard: Target schema is invalid.");
  }

  parsedUrl.searchParams.sort();
  const normalizedUrl = parsedUrl.toString();
  const port = parsedUrl.port || "5432";
  const resourceKey = `${host}:${port}/${lowerDbName}?schema=${schemaName}`;
  return { dbName: lowerDbName, schemaName, normalizedUrl, resourceKey };
};

export class RuntimeOrchestrator {
  private readonly npmCmd = os.platform() === "win32" ? "npm.cmd" : "npm";

  public validateDatabaseUrl(databaseUrl: string): TestDatabaseIdentity {
    return validateDisposableTestDatabaseUrl(databaseUrl, true);
  }

  public async install(dir: string, observer?: OrchestratorObserver): Promise<void> {
    await this.execPromise(this.npmCmd, ["install", "--no-audit", "--no-fund", "--prefer-offline"], dir, 90_000, "Install", undefined, observer);
  }

  public async prepareDatabase(
    dir: string,
    databaseUrl: string,
    confirmDisposableTestDb: boolean,
    observer?: OrchestratorObserver,
  ): Promise<void> {
    const { normalizedUrl } = validateDisposableTestDatabaseUrl(databaseUrl, confirmDisposableTestDb);
    await this.execPromise(this.npmCmd, ["run", "db:push"], dir, 60_000, "DB Push", { DATABASE_URL: normalizedUrl }, observer);
  }

  public async cleanupDatabase(
    dir: string,
    databaseUrl: string,
    confirmDisposableTestDb: boolean,
    observer?: OrchestratorObserver,
  ): Promise<void> {
    const { schemaName, normalizedUrl } = validateDisposableTestDatabaseUrl(databaseUrl, confirmDisposableTestDb);
    const sqlPath = path.join(dir, "drop_schema.sql");
    await fs.writeFile(sqlPath, `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`, { encoding: "utf8" });
    try {
      await this.execPromise(this.npmCmd, ["exec", "--", "prisma", "db", "execute", "--file", "drop_schema.sql"], dir, 60_000, "DB Cleanup", { DATABASE_URL: normalizedUrl }, observer);
    } catch (error: unknown) {
      throw new Error(`Security Guard: Database cleanup failed. Schema '${schemaName}' may remain. ${safeErrorMessage(error)}`);
    } finally {
      await fs.rm(sqlPath, { force: true }).catch(() => undefined);
    }
  }

  public async build(dir: string, observer?: OrchestratorObserver): Promise<void> {
    await this.execPromise(this.npmCmd, ["run", "build"], dir, 120_000, "Build", undefined, observer);
  }

  public async start(
    dir: string,
    extraEnv?: NodeJS.ProcessEnv,
    observer?: OrchestratorObserver,
  ): Promise<RuntimeInstance> {
    return new Promise<RuntimeInstance>((resolve, reject) => {
      const stdoutLog = new BoundedLog(200, 50_000, "stdout", observer);
      const stderrLog = new BoundedLog(200, 50_000, "stderr", observer);
      const child = spawn("node", ["dist/main.js"], {
        cwd: dir,
        env: { ...process.env, PORT: "0", ...extraEnv },
        windowsHide: true,
        detached: os.platform() !== "win32",
      });
      let settled = false;
      let readinessBuffer = "";
      let timeout: NodeJS.Timeout;

      const finishReject = (error: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };

      const failAndTerminate = (message: string): void => {
        if (settled) return;
        // Claim settlement synchronously: late readiness/exit events cannot win.
        settled = true;
        clearTimeout(timeout);
        void terminateChild(child).then(
          () => reject(new Error(message)),
          (terminationError: unknown) => reject(new TerminationUnconfirmedError(
            `${message}; process termination could not be confirmed: ${safeErrorMessage(terminationError)}`,
            terminationHandleFor(child),
            terminationError,
          )),
        );
      };

      timeout = setTimeout(() => {
        failAndTerminate(`Start timeout.\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`);
      }, 15_000);

      child.once("error", (error) => {
        const message = `Failed to spawn start process: ${redactCredentials(error.message)}`;
        // A child with no PID never successfully spawned. If it has a PID, fail
        // closed and verify termination before reporting the launch failure.
        if (child.pid === undefined) finishReject(new Error(message));
        else failAndTerminate(message);
      });
      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdoutLog.append(chunk);
        readinessBuffer = tailUtf8(readinessBuffer + chunk.toString(), 8_192);
        const match = /(?:^|\r?\n)BACKEND_OS_READY:(\d+)(?:\r?\n|$)/m.exec(readinessBuffer);
        if (!settled && match) {
          const port = Number(match[1]);
          if (!Number.isInteger(port) || port < 1 || port > 65_535) {
            failAndTerminate("Runtime reported an invalid readiness port.");
            return;
          }
          settled = true;
          clearTimeout(timeout);
          resolve(new RuntimeInstance(child, port, stdoutLog, stderrLog));
        }
      });
      child.stderr?.on("data", (chunk: Buffer | string) => stderrLog.append(chunk));
      child.once("exit", (code, signal) => {
        if (!settled) {
          failAndTerminate(`Process exited before readiness (code=${String(code)}, signal=${String(signal)}).\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`);
        }
      });
      child.once("close", () => {
        stdoutLog.flush();
        stderrLog.flush();
      });
    });
  }

  private async killProcess(child: ChildProcess): Promise<void> {
    await terminateChild(child);
  }

  private execPromise(
    cmd: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
    label: string,
    extraEnv?: NodeJS.ProcessEnv,
    observer?: OrchestratorObserver,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const stdoutLog = new BoundedLog(200, 50_000, "stdout", observer);
      const stderrLog = new BoundedLog(200, 50_000, "stderr", observer);
      const child = spawn(cmd, args, {
        cwd,
        shell: os.platform() === "win32",
        windowsHide: true,
        detached: os.platform() !== "win32",
        env: { ...process.env, ...extraEnv },
      });
      let settled = false;
      let timeout: NodeJS.Timeout;

      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      const failAndTerminate = (message: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        void terminateChild(child).then(
          () => reject(new Error(message)),
          (terminationError: unknown) => reject(new TerminationUnconfirmedError(
            `${message}; process termination could not be confirmed: ${safeErrorMessage(terminationError)}`,
            terminationHandleFor(child),
            terminationError,
          )),
        );
      };

      timeout = setTimeout(() => {
        failAndTerminate(`${label} timed out.\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`);
      }, timeoutMs);

      child.once("error", (error) => {
        const message = `Failed to spawn ${label}: ${redactCredentials(error.message)}`;
        if (child.pid === undefined) finish(new Error(message));
        else failAndTerminate(message);
      });
      child.stdout?.on("data", (chunk: Buffer | string) => stdoutLog.append(chunk));
      child.stderr?.on("data", (chunk: Buffer | string) => stderrLog.append(chunk));
      child.once("close", (code, signal) => {
        stdoutLog.flush();
        stderrLog.flush();
        if (settled) return;
        if (code !== 0) {
          // The child has exited and close has fired. Preserve the established
          // command-failure contract; timeout paths above handle unconfirmed
          // process termination with a retryable handle.
          finish(new Error(`${label} failed (code=${String(code)}, signal=${String(signal)}).\nSTDOUT:\n${stdoutLog.get()}\nSTDERR:\n${stderrLog.get()}`));
        } else {
          finish();
        }
      });
    });
  }
}

export const safeErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return redactCredentials(message).slice(0, 4_000);
};