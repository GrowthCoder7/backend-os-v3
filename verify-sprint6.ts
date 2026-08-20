import { IntentAdapter } from "@repo/intent";
import { OperationRegistry, OperationExecutor, EntityCreateHandler, EndpointCreateHandler } from "@repo/executor";
import { validateGraph } from "@repo/validation";
import { compileGraph } from "@repo/compiler";
import { IntentResponse } from "@repo/ai";

const registry = new OperationRegistry();
registry.register("entity.create", new EntityCreateHandler());
registry.register("endpoint.create", new EndpointCreateHandler());
const executor = new OperationExecutor(registry);
const adapter = new IntentAdapter(executor);

const initialContext = {
  graph: { metadata: {} as any, entities: {}, endpoints: [], relations: [], workflows: [], events: {} },
  services: {},
  validation: { validate: validateGraph }
};

const assert = (condition: boolean, msg: string) => {
  if (!condition) throw new Error(`❌ FAIL: ${msg}`);
};

const run = () => {
  console.log("🚀 SPRINT 6 VERIFICATION (MOCK)\n");

  // TEST 1-7: Valid Intent & Atomic Commit
  const intentSuccess: IntentResponse = {
    status: "success",
    operations: [
      { type: "entity.create", payload: { entity: { name: "User", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }] } } },
      { type: "endpoint.create", payload: { endpoint: { method: "GET", path: "/users", entity: "User", action: "read" } } }
    ]
  };

  const result1 = adapter.applyIntent(intentSuccess, initialContext);
  assert(result1.success, "Test 1: Valid intent succeeds");
  assert(Object.keys(result1.graph.entities).length === 1, "Test 5: Graph mutated successfully");
  assert(result1.graph !== initialContext.graph, "Test 5: New graph reference returned");

  // TEST 8: Needs Clarification does zero mutations
  const intentClarify: IntentResponse = { status: "needs_clarification", message: "Which fields?", operations: [] };
  const result2 = adapter.applyIntent(intentClarify, initialContext);
  assert(!result2.success && result2.graph === initialContext.graph, "Test 8: needs_clarification does zero mutations");

  // TEST 9: Error does zero mutations
  const intentErr: IntentResponse = { status: "error", message: "Failed", operations: [] };
  const result3 = adapter.applyIntent(intentErr, initialContext);
  assert(!result3.success && result3.graph === initialContext.graph, "Test 9: error does zero mutations");

  // TEST 10: Unknown Intent Operation throws
  const intentUnknown = { status: "success" as const, operations: [{ type: "magic.create", payload: {} }] };
  try {
    adapter.applyIntent(intentUnknown as any, initialContext);
    assert(false, "Test 10: Unknown type should throw");
  } catch (e: any) {
    assert(e.message.includes("Unknown IntentOperation"), "Test 10: Throws explicit error on unknown type");
  }

  // TEST 12: Compiler validation
  const compileResult = compileGraph(result1.graph);
  assert(compileResult.success, "Test 12: Final graph compiles cleanly");

  console.log("✅ Offline tests passed.");
};

run();