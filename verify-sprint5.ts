import { compileGraph } from "@repo/compiler";
import { executeGenerators } from "@repo/plugins";
import { ProjectMaterializer, RuntimeOrchestrator, RuntimeInstance } from "@repo/runtime";
import { ArchitectureGraph } from "@repo/types";
import * as path from "path";

const TARGET_DIR = path.resolve(".tmp/e2e-test-project");

const canonicalGraph: ArchitectureGraph = {
  metadata: { id: "e2e", name: "e2e", createdAt: "", updatedAt: "", compilerVersion: "", schemaVersion: "" },
  entities: {
    User: {
      name: "User",
      primaryKey: "id",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "name", type: "string", required: true },
        { name: "email", type: "string", required: true },
      ],
    },
  },
  endpoints: [
    { method: "POST", path: "/users", entity: "User", action: "create" },
    { method: "GET", path: "/users", entity: "User", action: "read" }, 
    { method: "GET", path: "/users/:id", entity: "User", action: "read" },
    { method: "PUT", path: "/users/:id", entity: "User", action: "update" },
    { method: "DELETE", path: "/users/:id", entity: "User", action: "delete" },
  ],
  relations: [],
  workflows: [],
  events: {},
};

async function assertResponse(res: Response, expectedStatus: number | number[], label: string) {
  const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!statuses.includes(res.status)) {
    const text = await res.text();
    throw new Error(`[${label}] Expected status ${statuses.join(" or ")}, got ${res.status}. Body: ${text}`);
  }
}

// Global instance to allow emergency cleanup to stop process
let globalInstance: RuntimeInstance | undefined;

async function runE2E() {
  console.log("🚀 Starting Sprint 5 E2E Verification...");

  try {
    // 1. Security Test
    try {
      await ProjectMaterializer.materialize({ "/etc/passwd": "malicious" }, TARGET_DIR);
      throw new Error("Materializer failed to reject absolute POSIX path");
    } catch (e: any) {
      if (!e.message.includes("Security Exception")) throw e;
    }

    // 2. Compile & Generate
    console.log("📦 Compiling Graph & Generating Artifacts...");
    const { success, ir, issues } = compileGraph(canonicalGraph);
    if (!success || !ir) throw new Error(`Compilation Failed: ${JSON.stringify(issues)}`);

    const artifacts = executeGenerators(ir);
    if (!artifacts.fileSystem) throw new Error("NestJS fileSystem not found in GeneratedArtifacts");

    // 3. Materialize
    console.log(`📁 Materializing to ${TARGET_DIR}...`);
    await ProjectMaterializer.materialize(artifacts.fileSystem, TARGET_DIR);

    // 4. Orchestrate (Install, Build, Start)
    const orchestrator = new RuntimeOrchestrator();
    console.log("⚙️  Running npm install (Timeout 30s)...");
    await orchestrator.install(TARGET_DIR);
    console.log("🔨 Running npm build (Timeout 15s)...");
    await orchestrator.build(TARGET_DIR);
    console.log("🟢 Starting Application (Timeout 10s)...");
    
    globalInstance = await orchestrator.start(TARGET_DIR);

    console.log(`✅ Application running on dynamic port: ${globalInstance.port}`);
    const baseUrl = `http://127.0.0.1:${globalInstance.port}`;

    // 5. HTTP CRUD Assertions
    // TEST 1: POST
    let res = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
    });
    await assertResponse(res, 201, "TEST 1: POST /users");
    const createdUser = await res.json();
    if (!createdUser.id) throw new Error("TEST 1: POST /users failed to generate an ID");
    const userId = createdUser.id;

    // TEST 2: GET ALL
    res = await fetch(`${baseUrl}/users`);
    await assertResponse(res, 200, "TEST 2: GET /users");
    const allUsers = await res.json();
    if (!Array.isArray(allUsers) || allUsers.length === 0) throw new Error("TEST 2: GET /users returned empty array");

    // TEST 3: GET ONE
    res = await fetch(`${baseUrl}/users/${userId}`);
    await assertResponse(res, 200, "TEST 3: GET /users/:id");
    const fetchedUser = await res.json();
    if (fetchedUser.name !== "Alice") throw new Error("TEST 3: GET /users/:id data mismatch");

    // TEST 4: PUT
    res = await fetch(`${baseUrl}/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice Updated", email: "alice@example.com" }),
    });
    await assertResponse(res, 200, "TEST 4: PUT /users/:id");
    const updatedUser = await res.json();
    if (updatedUser.name !== "Alice Updated") throw new Error("TEST 4: PUT /users/:id data mismatch");

    // TEST 5: DELETE
    res = await fetch(`${baseUrl}/users/${userId}`, { method: "DELETE" });
    await assertResponse(res, [200, 204], "TEST 5: DELETE /users/:id");

    // TEST 6: VERIFY DELETE
    res = await fetch(`${baseUrl}/users/${userId}`);
    await assertResponse(res, 404, "TEST 6: GET /users/:id (EXPECTED 404)");

    console.log("✅ All HTTP CRUD Assertions Passed!");

  } catch (error) {
    console.error("❌ E2E Verification Failed:", error);
    if (globalInstance) {
      console.error("\n--- RUNTIME LOGS ---");
      const logs = globalInstance.getLogs();
      console.error("STDOUT:\n", logs.stdout);
      console.error("STDERR:\n", logs.stderr);
    }
    process.exitCode = 1;
  } finally {
    console.log("🧹 Tearing down...");
    if (globalInstance) await globalInstance.stop();
    await ProjectMaterializer.cleanup(TARGET_DIR);
    console.log("✅ Cleanup complete.");
  }
}

// Graceful emergency exit handling
const handleEmergency = async () => {
  console.log("\n⚠️ Emergency termination signal received...");
  if (globalInstance) await globalInstance.stop();
  await ProjectMaterializer.cleanup(TARGET_DIR);
  process.exit(1);
};

process.on("SIGINT", handleEmergency);
process.on("SIGTERM", handleEmergency);

runE2E();