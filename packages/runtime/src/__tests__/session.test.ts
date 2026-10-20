import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as http from "http";
import { BackendIR } from "@repo/types";
import {
  MaterializerAdapter,
  RunCallbacks,
  RunCoordinator,
  RuntimeDriver,
  RuntimeProcess,
} from "../session";
import { OrchestratorObserver, TerminationHandle, TerminationUnconfirmedError } from "../orchestrator";

interface FixtureOptions {
  installFails?: boolean;
  materializeFails?: boolean;
  cleanupFailsOnce?: boolean;
  proxyTimeoutMs?: number;
  maxRequestBodyBytes?: number;
  maxResponseBodyBytes?: number;
  maxQueryBytes?: number;
  allowedOutputRoot?: string;
}

interface Fixture {
  coordinator: RunCoordinator;
  callbacks: RunCallbacks;
  runId: string;
  targetDir: string;
  databaseUrl: string;
  driver: RuntimeDriver;
  materializer: MaterializerAdapter;
  instance: RuntimeProcess;
}

let server: http.Server;
let serverPort = 0;
let counter = 0;
const fixtures: Fixture[] = [];

const mockIR: BackendIR = {
  metadata: { version: "1", generatedAt: "2026-01-01T00:00:00.000Z" },
  database: { models: [] },
  apis: {
    routes: [
      { method: "GET", path: "/api/users/:id", entity: "User", action: "read", handlerId: "users.read" },
      { method: "POST", path: "/api/echo", entity: "User", action: "create", handlerId: "echo.create" },
      { method: "GET", path: "/oversized", entity: "User", action: "read", handlerId: "oversized.read" },
      { method: "GET", path: "/slow", entity: "User", action: "read", handlerId: "slow.read" },
      { method: "GET", path: "/stalled-body", entity: "User", action: "read", handlerId: "stalled-body.read" },
    ],
  },
  workflows: { workflows: [] },
  events: {},
};

const makeFixture = (options: FixtureOptions = {}): Fixture => {
  counter += 1;
  const runId = `session-test-${counter}`;
  const targetDir = `/tmp/backend-os-generated-runs/session-test-${counter}`;
  const databaseUrl = `postgresql://test_user:test_password@127.0.0.1:5432/test_backend_os?schema=test_session_${counter}`;
  let cleanupShouldFail = options.cleanupFailsOnce === true;

  const instance: RuntimeProcess = {
    port: serverPort,
    stop: vi.fn(async () => undefined),
    getLogs: () => ({ stdout: "", stderr: "" }),
  };

  const driver: RuntimeDriver = {
    install: vi.fn(async (_dir: string, _observer?: OrchestratorObserver) => {
      if (options.installFails) throw new Error("controlled installation failure");
    }),
    prepareDatabase: vi.fn(async (_dir: string, _databaseUrl: string, _confirmDisposable: boolean, _observer?: OrchestratorObserver) => undefined),
    build: vi.fn(async (_dir: string, _observer?: OrchestratorObserver) => undefined),
    start: vi.fn(async (_dir: string, _env?: NodeJS.ProcessEnv, _observer?: OrchestratorObserver) => instance),
    cleanupDatabase: vi.fn(async (_dir: string, _databaseUrl: string, _confirmDisposable: boolean, _observer?: OrchestratorObserver) => {
      if (cleanupShouldFail) {
        cleanupShouldFail = false;
        throw new Error("controlled database cleanup failure");
      }
    }),
  };

  const materializer: MaterializerAdapter = {
    materialize: vi.fn(async (_virtualFs: Record<string, string>, _directory: string) => {
      if (options.materializeFails) throw new Error("controlled materialization failure");
    }),
    cleanup: vi.fn(async (_directory: string) => undefined),
  };

  const fixture: Fixture = {
    coordinator: new RunCoordinator(driver, materializer, {
      requestTimeoutMs: options.proxyTimeoutMs,
      maxRequestBodyBytes: options.maxRequestBodyBytes,
      maxResponseBodyBytes: options.maxResponseBodyBytes,
      maxQueryBytes: options.maxQueryBytes,
      allowedOutputRoot: options.allowedOutputRoot,
    }),
    callbacks: { onProgress: vi.fn(), onLog: vi.fn() },
    runId,
    targetDir,
    databaseUrl,
    driver,
    materializer,
    instance,
  };
  fixtures.push(fixture);
  return fixture;
};

const startFixture = async (fixture: Fixture): Promise<void> => {
  await fixture.coordinator.startRun(
    fixture.runId,
    mockIR,
    fixture.targetDir,
    fixture.databaseUrl,
    { "package.json": "{}" },
    fixture.callbacks,
  );
};

beforeAll(async () => {
  server = http.createServer((request, response) => {
    if (request.url === "/health" && request.method === "GET") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("healthy");
      return;
    }

    if (request.url?.startsWith("/api/users/")) {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "ETag": "taskflow-etag",
        "X-Internal-Not-Forwarded": "hidden",
      });
      response.end(JSON.stringify({ user: "Alice", url: request.url, authorization: request.headers.authorization ?? null }));
      return;
    }

    if (request.url?.startsWith("/api/echo")) {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ url: request.url, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
      });
      return;
    }

    if (request.url === "/oversized") {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end(Buffer.alloc(11 * 1024 * 1024, "A"));
      return;
    }

    if (request.url === "/slow") {
      const timer = setTimeout(() => {
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("too late");
      }, 11_000);
      response.once("close", () => clearTimeout(timer));
      return;
    }

    if (request.url === "/stalled-body") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.write('{"message":"body-started');
      const timer = setTimeout(() => response.end(' and-finished"}'), 5_000);
      response.once("close", () => clearTimeout(timer));
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not expose a TCP port."));
        return;
      }
      serverPort = address.port;
      resolve();
    });
  });
});

afterEach(async () => {
  for (const fixture of fixtures.splice(0, fixtures.length)) {
    try {
      await fixture.coordinator.resetRun(fixture.runId, fixture.callbacks);
    } catch {
      // A cleanup-failure test intentionally exercises the retry path. Make one final best-effort cleanup.
      try {
        await fixture.coordinator.resetRun(fixture.runId, fixture.callbacks);
      } catch {
        // The failure is asserted by the test; never hide it by treating cleanup as successful.
      }
    }
  }
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

const fixtureRootForPrefixAttack = (): string => "/tmp/backend-os-allowed-root";

describe("RunCoordinator API proxy and lifecycle", () => {
  it("starts a run and reports READY only after the runtime start resolves", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    expect(fixture.driver.start).toHaveBeenCalledTimes(1);
    expect(fixture.callbacks.onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: "READY", status: "SUCCEEDED" }));
  });

  it("rejects malformed encodings, traversal, encoded separators, and ambiguous paths", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    const invalidPaths = [
      "/%ZZ",
      "/../etc/passwd",
      "/%252e%252e/admin",
      "/%2e%2e/api/users/123",
      "/api%2fusers/123",
      "/%2Fapi/users/123",
      "/api%252fusers/123",
      "/api%5cusers/123",
      "/api%00users/123",
      "/api/users/123?injected=true",
      "/api/users/123#fragment",
      "/api\\users\\123",
    ];

    for (const path of invalidPaths) {
      const result = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "GET", path });
      expect(result.statusCode, `path should be rejected: ${path}`).toBe(400);
    }
  });

  it("rejects output-directory prefix attacks outside the configured root", async () => {
    const fixture = makeFixture({ allowedOutputRoot: fixtureRootForPrefixAttack() });
    const rejectedTarget = `${fixtureRootForPrefixAttack()}-malicious/run`;
    await expect(fixture.coordinator.startRun(
      `${fixture.runId}-prefix-attack`,
      mockIR,
      rejectedTarget,
      fixture.databaseUrl,
      { "package.json": "{}" },
      fixture.callbacks,
    )).rejects.toThrow(/must be a child of the configured generated-output root/);
    expect(fixture.materializer.materialize).not.toHaveBeenCalled();
  });

  it("successfully forwards a dynamic route and approved headers", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);

    const result = await fixture.coordinator.executeApi({
      runId: fixture.runId,
      method: "GET",
      path: "/api/users/123",
      query: { tag: ["one", "two"] },
      headers: { accept: "application/json", authorization: "Bearer demo-token" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ user: "Alice", url: "/api/users/123?tag=one&tag=two", authorization: "Bearer demo-token" });
    expect(result.headers.etag).toBe("taskflow-etag");
    expect(result.headers["x-internal-not-forwarded"]).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("rejects unsupported request headers rather than silently forwarding them", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    const result = await fixture.coordinator.executeApi({
      runId: fixture.runId,
      method: "GET",
      path: "/api/users/123",
      headers: { "x-unapproved-header": "value" },
    });
    expect(result.statusCode).toBe(400);
    expect(result.error?.code).toBe("INVALID_HEADERS");
  });

  it("forwards a JSON body and query values correctly", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    const result = await fixture.coordinator.executeApi({
      runId: fixture.runId,
      method: "POST",
      path: "/api/echo",
      query: { source: "cockpit" },
      body: { title: "TaskFlow", enabled: true },
    });
    expect(result.statusCode).toBe(201);
    expect(result.body).toEqual({ url: "/api/echo?source=cockpit", body: { title: "TaskFlow", enabled: true } });
  });

  it("rejects unknown routes and methods that do not match the compiled route catalog", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    const unknown = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "GET", path: "/api/products/1" });
    const wrongMethod = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "PUT", path: "/api/users/1" });
    expect(unknown.statusCode).toBe(404);
    expect(wrongMethod.statusCode).toBe(404);
  });

  it("restricts the infrastructure health bypass to GET", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    const allowed = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "GET", path: "/health" });
    const denied = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "POST", path: "/health" });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.body).toBe("healthy");
    expect(denied.statusCode).toBe(404);
  });

  it("enforces the response body limit using actual streamed bytes", async () => {
    const fixture = makeFixture({ maxResponseBodyBytes: 1_024 });
    await startFixture(fixture);
    const result = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "GET", path: "/oversized" });
    expect(result.statusCode).toBe(502);
    expect(result.error?.code).toBe("RESPONSE_TOO_LARGE");
  });

  it("enforces the configured request-body and query-string limits", async () => {
    const fixture = makeFixture({ maxRequestBodyBytes: 100, maxQueryBytes: 32 });
    await startFixture(fixture);
    const largeBody = await fixture.coordinator.executeApi({
      runId: fixture.runId,
      method: "POST",
      path: "/api/echo",
      body: { longValue: "x".repeat(256) },
    });
    const largeQuery = await fixture.coordinator.executeApi({
      runId: fixture.runId,
      method: "GET",
      path: "/api/users/123",
      query: { value: "x".repeat(128) },
    });
    expect(largeBody.statusCode).toBe(413);
    expect(largeQuery.statusCode).toBe(400);
    expect(largeQuery.error?.code).toBe("INVALID_QUERY");
  });

  it("returns a stable timeout response when downstream work exceeds the deadline", async () => {
    const fixture = makeFixture({ proxyTimeoutMs: 50 });
    await startFixture(fixture);
    const result = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "GET", path: "/slow" });
    expect(result.statusCode).toBe(504);
    expect(result.error?.code).toBe("PROXY_TIMEOUT");
  });

  it("keeps the deadline active after headers arrive while the response body stalls", async () => {
    const fixture = makeFixture({ proxyTimeoutMs: 50 });
    await startFixture(fixture);
    const result = await fixture.coordinator.executeApi({ runId: fixture.runId, method: "GET", path: "/stalled-body" });
    expect(result.statusCode).toBe(504);
    expect(result.error?.code).toBe("PROXY_TIMEOUT");
  });

  it("prevents distinct run IDs from claiming the same database and schema", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    await expect(fixture.coordinator.startRun(
      `${fixture.runId}-duplicate-db`,
      mockIR,
      `${fixture.targetDir}-different`,
      fixture.databaseUrl.replace("test_user:test_password", "another_user:another_password"),
      { "package.json": "{}" },
      fixture.callbacks,
    )).rejects.toThrow(/Database\/schema resource is already locked/);
  });

  it("normalizes directory identity to block path aliases", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    await expect(fixture.coordinator.startRun(
      `${fixture.runId}-duplicate-dir`,
      mockIR,
      `${fixture.targetDir}/.`,
      fixture.databaseUrl.replace(/test_session_\d+/, `test_session_${counter + 100}`),
      { "package.json": "{}" },
      fixture.callbacks,
    )).rejects.toThrow(/Generated directory is already locked/);
  });

  it("preserves generated files and database identity across Stop and Restart", async () => {
    const fixture = makeFixture();
    await startFixture(fixture);
    await fixture.coordinator.stopRun(fixture.runId, fixture.callbacks);
    const restartStatus = await fixture.coordinator.restartRun(fixture.runId, fixture.callbacks);

    expect(restartStatus).toBe("READY");
    expect(fixture.materializer.cleanup).not.toHaveBeenCalled();
    expect(fixture.driver.cleanupDatabase).not.toHaveBeenCalled();
    expect(fixture.driver.prepareDatabase).toHaveBeenCalledTimes(1);
  });

  it("does not report READY if installation fails", async () => {
    const fixture = makeFixture({ installFails: true });
    const status = await fixture.coordinator.startRun(
      fixture.runId, mockIR, fixture.targetDir, fixture.databaseUrl, { "package.json": "{}" }, fixture.callbacks,
    );
    expect(status).toBe("FAILED");
    expect(fixture.callbacks.onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ stage: "READY", status: "SUCCEEDED" }));
  });

  it("requires explicit reset after failed materialization rather than starting a partial directory", async () => {
    const fixture = makeFixture({ materializeFails: true });
    const status = await fixture.coordinator.startRun(
      fixture.runId, mockIR, fixture.targetDir, fixture.databaseUrl, { "package.json": "{}" }, fixture.callbacks,
    );
    expect(status).toBe("FAILED");
    await expect(fixture.coordinator.restartRun(fixture.runId, fixture.callbacks)).rejects.toThrow(/Materialization did not complete/);
  });

  it("blocks destructive cleanup and retains locks while command termination is unconfirmed", async () => {
    const fixture = makeFixture();
    let retryCount = 0;
    const retryTermination: TerminationHandle["retryTermination"] = vi.fn(async () => {
      retryCount += 1;
      if (retryCount === 1) throw new Error("controlled process is still alive");
    });
    fixture.driver.install = vi.fn(async () => {
      throw new TerminationUnconfirmedError(
        "controlled install timeout",
        { retryTermination },
        new Error("controlled install timeout"),
      );
    });

    const status = await fixture.coordinator.startRun(
      fixture.runId,
      mockIR,
      fixture.targetDir,
      fixture.databaseUrl,
      { "package.json": "{}" },
      fixture.callbacks,
    );
    expect(status).toBe("FAILED");

    await expect(fixture.coordinator.resetRun(fixture.runId, fixture.callbacks))
      .rejects.toThrow(/controlled process is still alive/);
    expect(fixture.driver.cleanupDatabase).not.toHaveBeenCalled();
    expect(fixture.materializer.cleanup).not.toHaveBeenCalled();

    await expect(fixture.coordinator.startRun(
      `${fixture.runId}-locked`,
      mockIR,
      fixture.targetDir,
      fixture.databaseUrl,
      { "package.json": "{}" },
      fixture.callbacks,
    )).rejects.toThrow(/Generated directory is already locked/);

    await fixture.coordinator.resetRun(fixture.runId, fixture.callbacks);
    expect(retryTermination).toHaveBeenCalledTimes(2);
    expect(fixture.driver.cleanupDatabase).toHaveBeenCalledTimes(1);
    expect(fixture.materializer.cleanup).toHaveBeenCalledTimes(1);
  });

  it("retains run/resource locks after cleanup failure so cleanup can be retried", async () => {
    const fixture = makeFixture({ cleanupFailsOnce: true });
    await startFixture(fixture);
    await expect(fixture.coordinator.resetRun(fixture.runId, fixture.callbacks)).rejects.toThrow(/controlled database cleanup failure/);

    await expect(fixture.coordinator.startRun(
      `${fixture.runId}-other`, mockIR, fixture.targetDir, fixture.databaseUrl, { "package.json": "{}" }, fixture.callbacks,
    )).rejects.toThrow(/locked by another run/);

    await fixture.coordinator.resetRun(fixture.runId, fixture.callbacks);
    expect(fixture.materializer.cleanup).toHaveBeenCalledTimes(1);
  });
});