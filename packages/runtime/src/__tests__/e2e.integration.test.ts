import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { compileGraph } from "@repo/compiler";
import { executeGenerators } from "@repo/plugins";
import { RuntimeOrchestrator, RuntimeInstance } from "../orchestrator";
import { ProjectMaterializer } from "../materializer";import { ArchitectureGraph } from "@repo/types";
import * as fs from "fs/promises";
import * as path from "path";

const persistenceGraph: ArchitectureGraph = {
  metadata: { id: "e2e-pg", name: "E2E PG Test", createdAt: "", updatedAt: "", compilerVersion: "1.0", schemaVersion: "1.0" },
  entities: {
    User: {
      name: "User", primaryKey: "id",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "email", type: "string", required: true }
      ]
    },
    Post: {
      name: "Post", primaryKey: "id",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "title", type: "string", required: true },
        { name: "authorId", type: "string", required: true }
      ]
    }
  },
  relations: [
    { source: "User", sourceField: "id", target: "Post", targetField: "authorId", type: "one-to-many" }
  ],
  endpoints: [
    { method: "POST", path: "/users", entity: "User", action: "create" },
    { method: "GET", path: "/users/:id", entity: "User", action: "read" },
    { method: "DELETE", path: "/users/:id", entity: "User", action: "delete" },
    { method: "POST", path: "/posts", entity: "Post", action: "create" },
    { method: "GET", path: "/posts/:id", entity: "Post", action: "read" },
    { method: "GET", path: "/posts", entity: "Post", action: "read" },
    { method: "DELETE", path: "/posts/:id", entity: "Post", action: "delete" }
  ],
  workflows: [], events: {}
};

describe("Sprint 11: PostgreSQL Persistence & Relational Integration", () => {
  const runId = Date.now().toString() + Math.random().toString(36).substring(7);
  const TARGET_DIR = path.resolve(`.tmp/vitest-e2e-pg-${runId}`);
  const schemaName = `test_schema_${runId}`;
  
  let DB_URL_STRING: string;
  let orchestrator: RuntimeOrchestrator;
  let globalInstance: RuntimeInstance | undefined;
  
  let createdUserId: string;
  let createdPostId: string;

  beforeAll(async () => {
    const dbUrlRaw = process.env.E2E_DATABASE_URL;
    if (!dbUrlRaw) {
      throw new Error("PRECONDITION FAILED: E2E_DATABASE_URL environment variable is required.");
    }
    
    const url = new URL(dbUrlRaw);
    if (!url.pathname.includes("backend_os_test")) {
      throw new Error("SAFETY VIOLATION: E2E_DATABASE_URL must target a dedicated disposable test database named 'backend_os_test'.");
    }
    
    // Isolate this test run to a unique schema
    url.searchParams.set("schema", schemaName);
    DB_URL_STRING = url.toString();

    orchestrator = new RuntimeOrchestrator();
    await ProjectMaterializer.cleanup(TARGET_DIR);
  });

  afterAll(async () => {
    let teardownErrors: Error[] = [];

    try {
      if (globalInstance) {
        await globalInstance.stop();
      }
    } catch (e) {
      teardownErrors.push(e instanceof Error ? e : new Error(String(e)));
    } finally {
      try {
        if (DB_URL_STRING && orchestrator) {
          // Dev A contract: dir, databaseUrl, confirmDisposableTestDb
          await orchestrator.cleanupDatabase(TARGET_DIR, DB_URL_STRING, true);
        }
      } catch (e) {
        teardownErrors.push(e instanceof Error ? e : new Error(String(e)));
      } finally {
        try {
          await ProjectMaterializer.cleanup(TARGET_DIR);
        } catch (e) {
          teardownErrors.push(e instanceof Error ? e : new Error(String(e)));
        }
      }
    }

    if (teardownErrors.length > 0) {
      throw new Error(`Teardown failures: ${teardownErrors.map(e => e.message).join(" | ")}`);
    }
  });

  it("compiles architecture and materializes the standalone project", async () => {
    const { success, ir } = compileGraph(persistenceGraph);
    expect(success).toBe(true);
    
    const artifacts = executeGenerators(ir!);
    await ProjectMaterializer.materialize(artifacts.fileSystem!, TARGET_DIR);
  });

  it("inspects generated Prisma dependency and ensures version-appropriate configuration", async () => {
    const pkgJsonPath = path.join(TARGET_DIR, "package.json");
    const pkgData = await fs.readFile(pkgJsonPath, "utf-8");
    const pkg = JSON.parse(pkgData);
    
    const prismaVersion = pkg.dependencies?.prisma || pkg.devDependencies?.prisma;
    expect(prismaVersion).toBeDefined();

    if (prismaVersion.startsWith("^7") || prismaVersion.startsWith("7")) {
      const configExists = await fs.stat(path.join(TARGET_DIR, "prisma.config.ts")).then(() => true).catch(() => false);
      expect(configExists).toBe(true);
    }
    
    const schemaExists = await fs.stat(path.join(TARGET_DIR, "prisma", "schema.prisma")).then(() => true).catch(() => false);
    expect(schemaExists).toBe(true);
  });

  it("installs dependencies and securely initializes the database", async () => {
    await orchestrator.install(TARGET_DIR);
    
    // Dev A contract: dir, databaseUrl, confirmDisposableTestDb. No --accept-data-loss used.
    await orchestrator.prepareDatabase(TARGET_DIR, DB_URL_STRING, true);
    
    await orchestrator.build(TARGET_DIR);
  }, 120000);

  it("starts the generated application and awaits the readiness signal", async () => {
    globalInstance = await orchestrator.start(TARGET_DIR, { DATABASE_URL: DB_URL_STRING });
    expect(globalInstance.port).toBeGreaterThan(0);
  });

  it("verifies live HTTP CRUD operations and foreign-key relational integrity", async () => {
    const baseUrl = `http://127.0.0.1:${globalInstance!.port}`;

    // 1. Create Source Record (User)
    let res = await fetch(`${baseUrl}/users`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "integration@example.com" })
    });
    expect(res.status).toBe(201);
    const user = await res.json();
    createdUserId = user.id;

    // 2. Create Target Record (Post) mapped to authorId
    res = await fetch(`${baseUrl}/posts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Valid Relation Post", authorId: createdUserId })
    });
    expect(res.status).toBe(201);
    const post = await res.json();
    createdPostId = post.id;
    expect(post.authorId).toBe(createdUserId);

    // 3. Foreign Key Constraint Rejection (Prisma P2003 maps to HTTP 500 without custom filters)
    const badRes = await fetch(`${baseUrl}/posts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Invalid FK Post", authorId: "00000000-0000-0000-0000-000000000000" })
    });
    expect(badRes.status).toBe(500);
    const errBody = await badRes.json();
    expect(errBody.statusCode).toBe(500);

    // 4. Persistence verification of rejection
    const allPostsRes = await fetch(`${baseUrl}/posts`);
    const allPosts = await allPostsRes.json();
    expect(allPosts.some((p: any) => p.title === "Invalid FK Post")).toBe(false);
  });

  it("stops completely and restarts against the same database schema", async () => {
    await globalInstance!.stop();
    
    // Restart the application to verify persistence
    globalInstance = await orchestrator.start(TARGET_DIR, { DATABASE_URL: DB_URL_STRING });
    expect(globalInstance.port).toBeGreaterThan(0);
  });

  it("verifies persistence: previously created records survived process restart", async () => {
    const baseUrl = `http://127.0.0.1:${globalInstance!.port}`;

    const res = await fetch(`${baseUrl}/posts/${createdPostId}`);
    expect(res.status).toBe(200);
    const post = await res.json();
    expect(post.title).toBe("Valid Relation Post");
    expect(post.authorId).toBe(createdUserId);
  });

  it("cleans up persistent records (Delete Post, then User)", async () => {
    const baseUrl = `http://127.0.0.1:${globalInstance!.port}`;
    
    // Post must be deleted first to avoid FK constraint violations
    const deletePostRes = await fetch(`${baseUrl}/posts/${createdPostId}`, { method: "DELETE" });
    expect([200, 204]).toContain(deletePostRes.status);
    
    // User deleted second
    const deleteUserRes = await fetch(`${baseUrl}/users/${createdUserId}`, { method: "DELETE" });
    expect([200, 204]).toContain(deleteUserRes.status);
  });
});