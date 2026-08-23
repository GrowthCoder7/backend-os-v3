import { useGraphStore } from "@repo/store";
import { Entity, Endpoint, Relation } from "@repo/types";

function verifySprint7() {
  console.log("=== SPRINT 7 EXECUTOR BOUNDARY VERIFICATION START ===\n");

  const store = useGraphStore.getState();

  // 1. Seed Graph Context
  const userEntity: Entity = {
    name: "User",
    primaryKey: "id",
    fields: [{ name: "id", type: "string", required: true }]
  };
  const postEntity: Entity = {
    name: "Post",
    primaryKey: "id",
    fields: [{ name: "id", type: "string", required: true }, { name: "userId", type: "string", required: true }]
  };
  
  store.addEntity(userEntity);
  store.addEntity(postEntity);
  console.log("PASS: Pre-seeded User and Post entities.");

  // 2. Endpoint Pipeline Test
  console.log("\n[1] Testing Endpoint Pipeline...");
  const ep: Endpoint = { method: "POST", path: "/test", entity: "User", action: "create" };
  store.addEndpoint(ep);
  
  if (useGraphStore.getState().graph.endpoints.length !== 1) {
    console.error("FAIL: addEndpoint did not mutate graph.");
    process.exit(1);
  }

  useGraphStore.getState().updateEndpointPath("POST", "/test", "/test2");
  if (useGraphStore.getState().graph.endpoints[0].path !== "/test2") {
    console.error("FAIL: updateEndpointPath compatibility wrapper failed.");
    process.exit(1);
  }

  useGraphStore.getState().updateEndpoint({ method: "POST", path: "/test2" }, { action: "update" });
  if (useGraphStore.getState().graph.endpoints[0].action !== "update") {
    console.error("FAIL: updateEndpoint failed to mutate.");
    process.exit(1);
  }

  useGraphStore.getState().removeEndpoint({ method: "POST", path: "/test2" });
  if (useGraphStore.getState().graph.endpoints.length !== 0) {
    console.error("FAIL: removeEndpoint failed to mutate.");
    process.exit(1);
  }
  console.log("PASS: Endpoint pipeline completely integrated with Executor.");

  // 3. Relation Pipeline Test
  console.log("\n[2] Testing Relation Pipeline...");
  const rel: Relation = { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-many" };
  store.addRelation(rel);

  if (useGraphStore.getState().graph.relations.length !== 1) {
    console.error("FAIL: addRelation did not mutate graph.");
    process.exit(1);
  }

  useGraphStore.getState().updateRelation(
    { source: "User", sourceField: "id", target: "Post", targetField: "userId" },
    { type: "one-to-one" }
  );

  if (useGraphStore.getState().graph.relations[0].type !== "one-to-one") {
    console.error("FAIL: updateRelation failed to mutate.");
    process.exit(1);
  }

  useGraphStore.getState().removeRelation({ source: "User", sourceField: "id", target: "Post", targetField: "userId" });
  if (useGraphStore.getState().graph.relations.length !== 0) {
    console.error("FAIL: removeRelation failed to mutate.");
    process.exit(1);
  }
  console.log("PASS: Relation pipeline completely integrated with Executor.");

  // 4. AI Intent Regression Test
  console.log("\n[3] Testing AI Intent Regression...");
  const res = store.applyIntent({
    status: "success",
    operations: [
      { type: "endpoint.create", payload: { endpoint: ep } },
      { type: "relation.create", payload: { relation: rel } }
    ]
  });

  if (!res.success) {
    console.error("FAIL: applyIntent failed to execute Sprint 6 operations.", res.message);
    process.exit(1);
  }
  console.log("PASS: Sprint 6 AI Intents process successfully through updated store boundary.");

  console.log("\n=== SPRINT 7 VERIFICATION COMPLETE ===");
}

verifySprint7();