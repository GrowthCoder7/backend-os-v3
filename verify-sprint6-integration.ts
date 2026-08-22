import { GeminiProvider } from "@repo/ai";
import {
  OperationRegistry,
  OperationExecutor,
  EntityCreateHandler,
  EndpointCreateHandler,
} from "@repo/executor";
import { validateGraph } from "@repo/validation";
import { compileGraph } from "@repo/compiler";
import { IntentAdapter } from "@repo/intent";
import type { ArchitectureGraph } from "@repo/types";

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`❌ FAIL: ${message}`);
  }
};

const initialGraph: ArchitectureGraph = {
  metadata: {
    id: "sprint6-integration",
    name: "Sprint 6 Integration Test",
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    compilerVersion: "1",
    schemaVersion: "1",
  },
  entities: {},
  relations: [],
  endpoints: [],
  events: {},
  workflows: [],
};

const context = {
  graph: initialGraph,
  services: {},
  validation: {
    validate: validateGraph,
  },
};

async function main() {
  console.log("=== SPRINT 6 A+B INTEGRATION VERIFICATION START ===\n");

  // ============================================================
  // 1. REAL GEMINI PROVIDER
  // ============================================================

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Run this through the pnpm script that loads .env."
    );
  }

  console.log("[1/8] Initializing GeminiProvider...");

  const ai = new GeminiProvider();

  console.log("PASS: GeminiProvider initialized.");

  // ============================================================
  // 2. NATURAL LANGUAGE → INTENT
  // ============================================================

  const prompt =
    "Create a User entity with id, name, and email fields. Then add GET /users and POST /users endpoints.";

  console.log("\n[2/8] Sending natural-language intent to Gemini...");
  console.log(`Prompt: "${prompt}"`);

  const intent = await ai.generateIntent({
    prompt,
  });

  console.log(`AI status: ${intent.status}`);
  console.log(`Generated operations: ${intent.operations.length}`);

  assert(
    intent.status === "success",
    `Gemini did not return success. Message: ${intent.message ?? "none"}`
  );

  assert(
    intent.operations.length >= 1,
    "Gemini returned success without operations."
  );

  console.log("PASS: Gemini produced a successful IntentResponse.");

  // ============================================================
  // 3. INSPECT INTENT
  // ============================================================

  console.log("\n[3/8] Inspecting generated IntentResponse...");

  const operationTypes = intent.operations.map((operation) => operation.type);

  console.log("Operation types:");
  operationTypes.forEach((type, index) => {
    console.log(`  [${index + 1}] ${type}`);
  });

  const hasEntityCreate = intent.operations.some(
    (operation) => operation.type === "entity.create"
  );

  const hasGetEndpoint = intent.operations.some(
    (operation) =>
      operation.type === "endpoint.create" &&
      operation.payload.endpoint.method === "GET" &&
      operation.payload.endpoint.path === "/users"
  );

  const hasPostEndpoint = intent.operations.some(
    (operation) =>
      operation.type === "endpoint.create" &&
      operation.payload.endpoint.method === "POST" &&
      operation.payload.endpoint.path === "/users"
  );

  assert(hasEntityCreate, "Gemini did not generate entity.create.");
  assert(hasGetEndpoint, "Gemini did not generate GET /users.");
  assert(hasPostEndpoint, "Gemini did not generate POST /users.");

  // Intent must not contain generated operation metadata.
  const serializedIntent = JSON.stringify(intent);

  assert(
    !serializedIntent.includes('"id"') ||
      !intent.operations.some(
        (operation) =>
          "id" in operation || "metadata" in operation
      ),
    "Intent operations unexpectedly contain generated IDs or metadata."
  );

  for (const operation of intent.operations) {
    assert(
      !("id" in operation),
      `AI operation ${operation.type} contains an id.`
    );

    assert(
      !("metadata" in operation),
      `AI operation ${operation.type} contains metadata.`
    );
  }

  console.log(
    "PASS: Intent contains expected entity and endpoint operations."
  );
  console.log("PASS: AI operations contain no IDs or metadata.");

  // ============================================================
  // 4. REAL EXECUTOR + INTENT ADAPTER
  // ============================================================

  console.log("\n[4/8] Creating real OperationExecutor...");

  const registry = new OperationRegistry();

  registry.register(
    "entity.create",
    new EntityCreateHandler()
  );

  registry.register(
    "endpoint.create",
    new EndpointCreateHandler()
  );

  const executor = new OperationExecutor(registry);

  const adapter = new IntentAdapter(executor);

  console.log("PASS: Real Executor and IntentAdapter initialized.");

  // ============================================================
  // 5. INTENT → OPERATIONS → EXECUTOR → GRAPH
  // ============================================================

  console.log(
    "\n[5/8] Executing real IntentResponse through IntentAdapter..."
  );

  const result = adapter.applyIntent(intent, context);

  assert(
    result.success,
    `IntentAdapter execution failed: ${JSON.stringify(
      result.diagnostics,
      null,
      2
    )}`
  );

  assert(
    result.graph !== initialGraph,
    "Successful execution did not produce a new graph reference."
  );

  console.log(
    "PASS: IntentResponse successfully entered the canonical Executor."
  );

  // ============================================================
  // 6. VERIFY GRAPH MUTATION
  // ============================================================

  console.log("\n[6/8] Verifying resulting ArchitectureGraph...");

  const graph = result.graph;

  assert(
    Object.keys(graph.entities).length === 1,
    `Expected exactly 1 entity, found ${Object.keys(graph.entities).length}.`
  );

  assert(
    graph.entities.User !== undefined,
    "User entity was not created."
  );

  const user = graph.entities.User;

  assert(
    user.primaryKey === "id",
    "User primary key is not 'id'."
  );

  assert(
    user.fields.some((field) => field.name === "id"),
    "User.id field missing."
  );

  assert(
    user.fields.some((field) => field.name === "name"),
    "User.name field missing."
  );

  assert(
    user.fields.some((field) => field.name === "email"),
    "User.email field missing."
  );

  const getUsers = graph.endpoints.find(
    (endpoint) =>
      endpoint.method === "GET" &&
      endpoint.path === "/users"
  );

  const postUsers = graph.endpoints.find(
    (endpoint) =>
      endpoint.method === "POST" &&
      endpoint.path === "/users"
  );

  assert(
    getUsers !== undefined,
    "GET /users was not created."
  );

  assert(
    postUsers !== undefined,
    "POST /users was not created."
  );

  console.log("PASS: User entity exists.");
  console.log("PASS: User fields id/name/email exist.");
  console.log("PASS: GET /users exists.");
  console.log("PASS: POST /users exists.");

  // ============================================================
  // 7. VERIFY CANONICAL GRAPH → COMPILER
  // ============================================================

  console.log(
    "\n[7/8] Compiling AI-produced ArchitectureGraph..."
  );

  const compilation = compileGraph(graph);

  assert(
    compilation.success,
    `AI-produced graph failed compilation: ${JSON.stringify(
      compilation.issues,
      null,
      2
    )}`
  );

  assert(
    compilation.ir !== null,
    "Compilation succeeded but BackendIR is null."
  );

  console.log("PASS: AI-produced ArchitectureGraph compiles successfully.");
  console.log("PASS: BackendIR successfully generated.");

  // ============================================================
  // 8. FINAL SUMMARY
  // ============================================================

  console.log("\n[8/8] Final integration assertions...");

  assert(
    compilation.ir!.database.models.length === 1,
    "BackendIR does not contain exactly one database model."
  );

  assert(
    compilation.ir!.apis.routes.length === 2,
    `BackendIR expected 2 routes, found ${compilation.ir!.apis.routes.length}.`
  );

  console.log("PASS: BackendIR contains User model.");
  console.log("PASS: BackendIR contains GET /users and POST /users.");

  console.log("\n=== SPRINT 6 A+B INTEGRATION SUCCESS ===");

  console.log(`
Natural Language
      ↓
GeminiProvider
      ↓
Validated IntentResponse
      ↓
IntentAdapter
      ↓
Canonical Operations
      ↓
OperationExecutor
      ↓
ArchitectureGraph
      ↓
compileGraph()
      ↓
BackendIR

🎉 Sprint 6 AI + Executor integration is VERIFIED.
`);
}

main().catch((error: unknown) => {
  console.error("\n=== SPRINT 6 A+B INTEGRATION FAILED ===");

  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) {
      console.error("\n" + error.stack);
    }
  } else {
    console.error(error);
  }

  process.exit(1);
});