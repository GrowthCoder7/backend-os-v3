import * as path from "path";
import * as os from "os";
import { BackendIR } from "@repo/types";
import { ProjectMaterializer } from "./materializer";
import {
  OrchestratorObserver,
  RuntimeOrchestrator,
  safeErrorMessage,
  TerminationHandle,
  TerminationUnconfirmedError,
  validateDisposableTestDatabaseUrl,
} from "./orchestrator";

export type GuidedStage =
  | "VALIDATING"
  | "GENERATING"
  | "MATERIALIZING"
  | "INSTALLING"
  | "PREPARING_DATABASE"
  | "BUILDING"
  | "STARTING"
  | "READY"
  | "STOPPING"
  | "STOPPED";
export type StageStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
export type RunStatus = "IDLE" | "RUNNING" | "READY" | "FAILED" | "STOPPED";
export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface ApiProxyRequest {
  runId: string;
  method: ApiMethod;
  path: string;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ApiProxyResponse {
  statusCode: number;
  durationMs: number;
  headers: Record<string, string>;
  body?: unknown;
  error?: { code: string; message: string };
}

export interface RunProgressEvent {
  runId: string;
  stage: GuidedStage;
  status: StageStatus;
  timestamp: string;
  message: string;
}

export interface RunLogEvent {
  runId: string;
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  message: string;
}

export interface RunCallbacks {
  onProgress: (event: RunProgressEvent) => void;
  onLog: (event: RunLogEvent) => void;
}

/** Small interface to allow typed runtime doubles in tests without constructing ChildProcess objects. */
export interface RuntimeProcess {
  readonly port: number;
  stop(): Promise<void>;
  getLogs?(): { stdout: string; stderr: string };
}

export interface RuntimeDriver {
  install(dir: string, observer?: OrchestratorObserver): Promise<void>;
  prepareDatabase(
    dir: string,
    databaseUrl: string,
    confirmDisposableTestDb: boolean,
    observer?: OrchestratorObserver,
  ): Promise<void>;
  build(dir: string, observer?: OrchestratorObserver): Promise<void>;
  start(dir: string, extraEnv?: NodeJS.ProcessEnv, observer?: OrchestratorObserver): Promise<RuntimeProcess>;
  cleanupDatabase(
    dir: string,
    databaseUrl: string,
    confirmDisposableTestDb: boolean,
    observer?: OrchestratorObserver,
  ): Promise<void>;
}

export interface MaterializerAdapter {
  materialize(virtualFs: Record<string, string>, targetDir: string): Promise<void>;
  cleanup(targetDir: string): Promise<void>;
}

export interface RunCoordinatorOptions {
  /** Root under which generated run directories must live. Defaults to the OS temp directory's dedicated Backend OS root. */
  allowedOutputRoot?: string;
  requestTimeoutMs?: number;
  maxRequestBodyBytes?: number;
  maxResponseBodyBytes?: number;
  maxQueryBytes?: number;
}

interface ActiveRun {
  ir: BackendIR;
  targetDir: string;
  directoryKey: string;
  databaseUrl: string;
  databaseResourceKey: string;
  status: RunStatus;
  currentStage: GuidedStage;
  completedStages: Set<GuidedStage>;
  instance?: RuntimeProcess;
  terminationHandle?: TerminationHandle;
  isTransitioning: boolean;
}

const defaultMaterializer: MaterializerAdapter = {
  materialize: (virtualFs, targetDir) => ProjectMaterializer.materialize(virtualFs, targetDir),
  cleanup: (targetDir) => ProjectMaterializer.cleanup(targetDir),
};

const safeCallback = (callback: () => void): void => {
  try {
    callback();
  } catch {
    // UI observers must not change runtime lifecycle outcomes.
  }
};

const normalizeDirectory = (directory: string, outputRoot: string): { targetDir: string; key: string } => {
  const targetDir = path.resolve(directory);
  const normalizedRoot = path.resolve(outputRoot);
  const relative = path.relative(normalizedRoot, targetDir);
  if (!relative || relative === "." || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Generated target directory must be a child of the configured generated-output root.");
  }
  const key = process.platform === "win32" ? targetDir.toLowerCase() : targetDir;
  return { targetDir, key };
};

const validateAndNormalizePath = (rawPath: string): { ok: true; path: string } | { ok: false; message: string } => {
  if (typeof rawPath !== "string" || !rawPath || rawPath.length > 2_048) return { ok: false, message: "Path is empty or exceeds the allowed length." };
  if (!rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return { ok: false, message: "Only origin-relative paths are allowed." };
  }
  if (/[\\\u0000-\u001f\u007f?#]/.test(rawPath)) {
    return { ok: false, message: "Path contains a prohibited character." };
  }
  if (/%(?![0-9a-f]{2})/i.test(rawPath)) {
    return { ok: false, message: "Malformed percent encoding." };
  }
  // Encoded separators, NUL, encoded dot segments, and nested encodings are
  // rejected before decoding so normalisation cannot erase attack evidence.
  if (/%(?:2f|5c|00|25(?:2e|2f|5c|00|25))/i.test(rawPath)) {
    return { ok: false, message: "Encoded separators, dot segments, or ambiguous encodings are prohibited." };
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return { ok: false, message: "Malformed percent encoding." };
  }

  // Reject any remaining escape introducer so a downstream decoder cannot reinterpret the path.
  if (decodedPath.includes("%")) {
    return { ok: false, message: "Nested or literal percent encodings are prohibited in paths." };
  }
  if (!decodedPath.startsWith("/") || decodedPath.startsWith("//") || /[\\\u0000-\u001f\u007f?#]/.test(decodedPath)) {
    return { ok: false, message: "Decoded path is ambiguous or malformed." };
  }

  const segments = decodedPath.split("/");
  if (segments.some((segment, index) => index > 0 && (segment === "." || segment === ".."))) {
    return { ok: false, message: "Path traversal is prohibited." };
  }
  if (decodedPath.includes("//")) return { ok: false, message: "Repeated path separators are prohibited." };
  if (path.posix.normalize(decodedPath) !== decodedPath) {
    return { ok: false, message: "Non-canonical paths are prohibited." };
  }

  return { ok: true, path: decodedPath };
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const routeMatches = (routePath: string, requestPath: string): boolean => {
  if (!routePath.startsWith("/") || routePath.startsWith("//") || routePath.includes("?") || routePath.includes("#")) return false;
  const segments = routePath.split("/");
  const pattern = segments.map((segment) => {
    if (segment.startsWith(":")) {
      return /^:[A-Za-z_][A-Za-z0-9_]*$/.test(segment) ? "([^/]+)" : "(?!)";
    }
    return escapeRegex(segment);
  }).join("\\/");
  return new RegExp(`^${pattern}$`).test(requestPath);
};

const ALLOWED_REQUEST_HEADERS = new Set([
  "accept",
  "authorization",
  "content-type",
  "if-match",
  "if-none-match",
  "prefer",
  "x-request-id",
]);

const ALLOWED_RESPONSE_HEADERS = new Set([
  "allow",
  "cache-control",
  "content-language",
  "content-type",
  "etag",
  "last-modified",
  "location",
  "retry-after",
  "www-authenticate",
]);

const normalizeRequestHeaders = (
  headers: Record<string, string> | undefined,
  hasJsonBody: boolean,
): { ok: true; headers: Record<string, string> } | { ok: false; message: string } => {
  const safe: Record<string, string> = {};
  let bytes = 0;
  const entries = Object.entries(headers ?? {});
  if (entries.length > 40) return { ok: false, message: "Too many request headers." };

  for (const [name, value] of entries) {
    const key = name.toLowerCase();
    if (!ALLOWED_REQUEST_HEADERS.has(key)) {
      return { ok: false, message: `Request header '${key}' is not allowed by the API cockpit.` };
    }
    if (typeof value !== "string" || !value || /[\u0000-\u001f\u007f]/.test(value)) {
      return { ok: false, message: `Request header '${key}' has an invalid value.` };
    }
    bytes += Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8");
    if (bytes > 16 * 1024) return { ok: false, message: "Request headers exceed the 16KB limit." };
    safe[key] = value;
  }

  if (hasJsonBody) safe["content-type"] = "application/json";
  return { ok: true, headers: safe };
};

const normalizeQuery = (
  query: Record<string, string | string[]> | undefined,
  maximumBytes: number,
): { ok: true; encoded: string } | { ok: false; message: string } => {
  const params = new URLSearchParams();
  let count = 0;
  for (const [key, value] of Object.entries(query ?? {})) {
    if (!key || key.length > 256) return { ok: false, message: "Query parameter name is invalid." };
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      count += 1;
      if (typeof item !== "string" || count > 100 || item.length > 2_048) {
        return { ok: false, message: "Query parameters exceed the supported count or value length." };
      }
      params.append(key, item);
    }
  }
  const encoded = params.toString();
  if (Buffer.byteLength(encoded, "utf8") > maximumBytes) {
    return { ok: false, message: "Query string exceeds the 8KB limit." };
  }
  return { ok: true, encoded };
};

const readBoundedResponse = async (
  response: Response,
  maximumBytes: number,
): Promise<{ ok: true; bytes: Buffer } | { ok: false }> => {
  if (!response.body) return { ok: true, bytes: Buffer.alloc(0) };

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      totalBytes += chunk.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return { ok: true, bytes: Buffer.concat(chunks, totalBytes) };
};

export class RunCoordinator {
  private readonly runs = new Map<string, ActiveRun>();
  private readonly usedDirectories = new Set<string>();
  private readonly usedDatabases = new Set<string>();

  constructor(
    private readonly orchestrator: RuntimeDriver = new RuntimeOrchestrator(),
    private readonly materializer: MaterializerAdapter = defaultMaterializer,
    private readonly options: RunCoordinatorOptions = {},
  ) {}

  private createObserver(runId: string, callbacks: RunCallbacks): OrchestratorObserver {
    return {
      onLog: (stream, chunk) => safeCallback(() => callbacks.onLog({
        runId,
        timestamp: new Date().toISOString(),
        stream,
        message: chunk,
      })),
    };
  }

  private emit(
    callbacks: RunCallbacks,
    runId: string,
    stage: GuidedStage,
    status: StageStatus,
    message: string,
  ): void {
    const run = this.runs.get(runId);
    if (run) {
      run.currentStage = stage;
      if (status === "SUCCEEDED") run.completedStages.add(stage);
      if (status === "FAILED") run.status = "FAILED";
      if (stage === "READY" && status === "SUCCEEDED") run.status = "READY";
      if (stage === "STOPPED" && status === "SUCCEEDED") run.status = "STOPPED";
    }
    safeCallback(() => callbacks.onProgress({ runId, stage, status, timestamp: new Date().toISOString(), message }));
  }

  private logSystem(callbacks: RunCallbacks, runId: string, message: string): void {
    safeCallback(() => callbacks.onLog({
      runId,
      timestamp: new Date().toISOString(),
      stream: "system",
      message: message.slice(0, 4_000),
    }));
  }

  private retainTerminationHandle(run: ActiveRun, error: unknown): void {
    if (error instanceof TerminationUnconfirmedError) {
      run.terminationHandle = error.terminationHandle;
      return;
    }
    // A RuntimeProcess implementation may not yet throw the typed error. Keep a
    // retry operation against that same instance rather than assuming it died.
    if (run.instance) {
      const instance = run.instance;
      run.terminationHandle = { retryTermination: () => instance.stop() };
    }
  }

  private async confirmRunTermination(run: ActiveRun): Promise<void> {
    if (run.terminationHandle) {
      await run.terminationHandle.retryTermination();
      run.terminationHandle = undefined;
      // A retained handle represents the process whose termination was
      // previously unconfirmed. After it succeeds, do not issue a second
      // platform kill against the same (now exited) PID.
      if (run.instance) run.instance = undefined;
    }

    if (run.instance) {
      try {
        await run.instance.stop();
        run.instance = undefined;
      } catch (error: unknown) {
        this.retainTerminationHandle(run, error);
        throw error;
      }
    }
  }

  public async startRun(
    runId: string,
    ir: BackendIR,
    targetDirRaw: string,
    databaseUrlRaw: string,
    virtualFs: Record<string, string>,
    callbacks: RunCallbacks,
  ): Promise<RunStatus> {
    if (!runId.trim()) throw new Error("Run ID must not be empty.");
    if (this.runs.has(runId)) throw new Error(`Run ID '${runId}' is already registered.`);

    const outputRoot = this.options.allowedOutputRoot ?? path.join(os.tmpdir(), "backend-os-generated-runs");
    const { targetDir, key: directoryKey } = normalizeDirectory(targetDirRaw, outputRoot);
    const dbIdentity = validateDisposableTestDatabaseUrl(databaseUrlRaw, true);
    if (this.usedDirectories.has(directoryKey)) throw new Error("Generated directory is already locked by another run.");
    if (this.usedDatabases.has(dbIdentity.resourceKey)) throw new Error("Database/schema resource is already locked by another run.");

    this.usedDirectories.add(directoryKey);
    this.usedDatabases.add(dbIdentity.resourceKey);

    const run: ActiveRun = {
      ir,
      targetDir,
      directoryKey,
      databaseUrl: dbIdentity.normalizedUrl,
      databaseResourceKey: dbIdentity.resourceKey,
      status: "RUNNING",
      currentStage: "MATERIALIZING",
      completedStages: new Set<GuidedStage>(),
      isTransitioning: true,
    };
    this.runs.set(runId, run);
    const observer = this.createObserver(runId, callbacks);

    try {
      this.emit(callbacks, runId, "MATERIALIZING", "RUNNING", "Writing generated files...");
      await this.materializer.materialize(virtualFs, targetDir);
      this.emit(callbacks, runId, "MATERIALIZING", "SUCCEEDED", "Files materialized.");

      this.emit(callbacks, runId, "INSTALLING", "RUNNING", "Installing dependencies...");
      await this.orchestrator.install(targetDir, observer);
      this.emit(callbacks, runId, "INSTALLING", "SUCCEEDED", "Dependencies installed.");

      this.emit(callbacks, runId, "PREPARING_DATABASE", "RUNNING", "Applying database schema...");
      await this.orchestrator.prepareDatabase(targetDir, dbIdentity.normalizedUrl, true, observer);
      this.emit(callbacks, runId, "PREPARING_DATABASE", "SUCCEEDED", "Database schema prepared.");

      this.emit(callbacks, runId, "BUILDING", "RUNNING", "Building generated backend...");
      await this.orchestrator.build(targetDir, observer);
      this.emit(callbacks, runId, "BUILDING", "SUCCEEDED", "Build completed.");

      this.emit(callbacks, runId, "STARTING", "RUNNING", "Starting generated backend...");
      run.instance = await this.orchestrator.start(targetDir, { DATABASE_URL: dbIdentity.normalizedUrl }, observer);
      this.emit(callbacks, runId, "READY", "SUCCEEDED", `Application ready on port ${run.instance.port}.`);
    } catch (error: unknown) {
      this.retainTerminationHandle(run, error);
      this.emit(callbacks, runId, run.currentStage, "FAILED", safeErrorMessage(error));
      if (run.instance) {
        try {
          await run.instance.stop();
          run.instance = undefined;
        } catch (stopError: unknown) {
          this.retainTerminationHandle(run, stopError);
          this.logSystem(callbacks, runId, `Startup cleanup could not confirm process termination; the run and resource locks remain registered: ${safeErrorMessage(stopError)}`);
        }
      }
    } finally {
      run.isTransitioning = false;
    }
    return run.status;
  }

  public async stopRun(runId: string, callbacks: RunCallbacks): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found.");
    if (run.isTransitioning) throw new Error("Run is currently transitioning.");

    run.isTransitioning = true;
    try {
      this.emit(callbacks, runId, "STOPPING", "RUNNING", "Stopping generated backend process...");
      await this.confirmRunTermination(run);
      this.emit(callbacks, runId, "STOPPED", "SUCCEEDED", "Process termination confirmed; generated files and database schema were preserved.");
    } catch (error: unknown) {
      this.retainTerminationHandle(run, error);
      this.emit(callbacks, runId, "STOPPING", "FAILED", `Process stop could not be confirmed; resources remain locked: ${safeErrorMessage(error)}`);
      throw error;
    } finally {
      run.isTransitioning = false;
    }
  }

  public async restartRun(runId: string, callbacks: RunCallbacks): Promise<RunStatus> {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found.");
    if (run.isTransitioning) throw new Error("Run is currently transitioning.");
    if (run.terminationHandle) {
      throw new Error("Cannot restart while previous process termination remains unconfirmed; use Stop or Reset to retry termination.");
    }
    if (run.status !== "STOPPED" && run.status !== "FAILED") {
      throw new Error("Only stopped or failed runs can be restarted.");
    }
    if (!run.completedStages.has("MATERIALIZING")) {
      throw new Error("Materialization did not complete. Use explicit Reset/Cleanup, then start a new run.");
    }

    run.isTransitioning = true;
    run.status = "RUNNING";
    const observer = this.createObserver(runId, callbacks);

    try {
      if (!run.completedStages.has("INSTALLING")) {
        this.emit(callbacks, runId, "INSTALLING", "RUNNING", "Recovering by installing dependencies...");
        await this.orchestrator.install(run.targetDir, observer);
        this.emit(callbacks, runId, "INSTALLING", "SUCCEEDED", "Dependencies installed.");
      }
      if (!run.completedStages.has("PREPARING_DATABASE")) {
        this.emit(callbacks, runId, "PREPARING_DATABASE", "RUNNING", "Recovering database schema...");
        await this.orchestrator.prepareDatabase(run.targetDir, run.databaseUrl, true, observer);
        this.emit(callbacks, runId, "PREPARING_DATABASE", "SUCCEEDED", "Database schema prepared.");
      }
      if (!run.completedStages.has("BUILDING")) {
        this.emit(callbacks, runId, "BUILDING", "RUNNING", "Recovering by rebuilding the generated backend...");
        await this.orchestrator.build(run.targetDir, observer);
        this.emit(callbacks, runId, "BUILDING", "SUCCEEDED", "Build completed.");
      }

      this.emit(callbacks, runId, "STARTING", "RUNNING", "Starting generated backend...");
      run.instance = await this.orchestrator.start(run.targetDir, { DATABASE_URL: run.databaseUrl }, observer);
      this.emit(callbacks, runId, "READY", "SUCCEEDED", `Application ready on port ${run.instance.port}.`);
    } catch (error: unknown) {
      this.retainTerminationHandle(run, error);
      this.emit(callbacks, runId, run.currentStage, "FAILED", `Restart/recovery failed: ${safeErrorMessage(error)}`);
      if (run.instance) {
        try {
          await run.instance.stop();
          run.instance = undefined;
        } catch (stopError: unknown) {
          this.retainTerminationHandle(run, stopError);
          this.logSystem(callbacks, runId, `Failed to confirm termination of partially restarted process; resources remain locked: ${safeErrorMessage(stopError)}`);
        }
      }
    } finally {
      run.isTransitioning = false;
    }
    return run.status;
  }

  public async resetRun(runId: string, callbacks: RunCallbacks): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    if (run.isTransitioning) throw new Error("Run is currently transitioning.");

    run.isTransitioning = true;
    try {
      // Do not start either destructive cleanup until every known process handle
      // has positively confirmed termination. Missing instance != process death.
      await this.confirmRunTermination(run);

      // Both operations are intentionally retryable. Keep run/resource locks until
      // the DB schema and generated directory have both been cleaned successfully.
      await this.orchestrator.cleanupDatabase(run.targetDir, run.databaseUrl, true);
      await this.materializer.cleanup(run.targetDir);

      this.usedDirectories.delete(run.directoryKey);
      this.usedDatabases.delete(run.databaseResourceKey);
      this.runs.delete(runId);
      safeCallback(() => callbacks.onProgress({
        runId,
        stage: "STOPPED",
        status: "SUCCEEDED",
        timestamp: new Date().toISOString(),
        message: "Run reset and test resources cleaned up.",
      }));
    } catch (error: unknown) {
      this.retainTerminationHandle(run, error);
      this.emit(callbacks, runId, "STOPPING", "FAILED", `Reset blocked or cleanup incomplete; run and resource locks were retained for retry: ${safeErrorMessage(error)}`);
      throw error;
    } finally {
      run.isTransitioning = false;
    }
  }

  public async executeApi(request: ApiProxyRequest): Promise<ApiProxyResponse> {
    const startedAt = Date.now();
    const run = this.runs.get(request.runId);
    if (!run || run.status !== "READY" || !run.instance) {
      return { statusCode: 503, durationMs: 0, headers: {}, error: { code: "RUN_NOT_READY", message: "Run is inactive or not ready." } };
    }

    const method = String(request.method).toUpperCase();
    const allowedMethods = new Set<string>(["GET", "POST", "PUT", "DELETE", "PATCH"]);
    if (!allowedMethods.has(method)) {
      return { statusCode: 405, durationMs: 0, headers: {}, error: { code: "METHOD_NOT_ALLOWED", message: "Unsupported HTTP method." } };
    }

    const pathResult = validateAndNormalizePath(request.path);
    if (!pathResult.ok) {
      return { statusCode: 400, durationMs: 0, headers: {}, error: { code: "INVALID_PATH", message: pathResult.message } };
    }
    const requestPath = pathResult.path;

    let allowedRoute = method === "GET" && requestPath === "/health";
    if (!allowedRoute) {
      allowedRoute = run.ir.apis.routes.some((route) =>
        route.method.toUpperCase() === method && routeMatches(route.path, requestPath),
      );
    }
    if (!allowedRoute) {
      return { statusCode: 404, durationMs: 0, headers: {}, error: { code: "ROUTE_NOT_FOUND", message: "Method and path do not match a route in the compiled Backend IR." } };
    }

    let payloadString: string | undefined;
    const hasJsonBody = method !== "GET" && method !== "DELETE" && request.body !== undefined;
    if (hasJsonBody) {
      try {
        const serialized = JSON.stringify(request.body);
        if (typeof serialized !== "string") throw new Error("Body is not JSON serializable.");
        payloadString = serialized;
      } catch {
        return { statusCode: 400, durationMs: 0, headers: {}, error: { code: "INVALID_JSON_BODY", message: "Request body must be JSON-serializable." } };
      }
      if (Buffer.byteLength(payloadString, "utf8") > (this.options.maxRequestBodyBytes ?? 5 * 1024 * 1024)) {
        return { statusCode: 413, durationMs: 0, headers: {}, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the configured size limit." } };
      }
    }

    const headerResult = normalizeRequestHeaders(request.headers, hasJsonBody);
    if (!headerResult.ok) {
      return { statusCode: 400, durationMs: 0, headers: {}, error: { code: "INVALID_HEADERS", message: headerResult.message } };
    }
    const queryResult = normalizeQuery(request.query, this.options.maxQueryBytes ?? 8 * 1024);
    if (!queryResult.ok) {
      return { statusCode: 400, durationMs: 0, headers: {}, error: { code: "INVALID_QUERY", message: queryResult.message } };
    }

    const target = new URL(requestPath, `http://127.0.0.1:${run.instance.port}`);
    if (queryResult.encoded) target.search = queryResult.encoded;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeoutMs ?? 10_000);
    try {
      const response = await fetch(target, {
        method,
        headers: headerResult.headers,
        body: payloadString,
        signal: controller.signal,
        redirect: "manual",
      });

      const bodyResult = await readBoundedResponse(response, this.options.maxResponseBodyBytes ?? 10 * 1024 * 1024);
      if (!bodyResult.ok) {
        controller.abort();
        return { statusCode: 502, durationMs: Date.now() - startedAt, headers: {}, error: { code: "RESPONSE_TOO_LARGE", message: "Downstream response exceeded the configured size limit." } };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const responseText = bodyResult.bytes.toString("utf8");
      let responseBody: unknown;
      if (bodyResult.bytes.length > 0) {
        if (/application\/[\w.+-]*\+?json\b/i.test(contentType)) {
          try {
            responseBody = JSON.parse(responseText);
          } catch {
            responseBody = responseText;
          }
        } else {
          responseBody = responseText;
        }
      }

      const safeResponseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        const normalizedKey = key.toLowerCase();
        if (ALLOWED_RESPONSE_HEADERS.has(normalizedKey)) safeResponseHeaders[normalizedKey] = value;
      });

      return {
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        headers: safeResponseHeaders,
        body: responseBody,
      };
    } catch {
      const timedOut = controller.signal.aborted;
      return {
        statusCode: timedOut ? 504 : 502,
        durationMs: Date.now() - startedAt,
        headers: {},
        error: timedOut
          ? { code: "PROXY_TIMEOUT", message: "Downstream request timed out." }
          : { code: "BAD_GATEWAY", message: "Downstream request could not be completed." },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}