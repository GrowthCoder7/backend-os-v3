import { 
  OperationRegistry, OperationExecutor,
  RelationCreateHandler, RelationUpdateHandler, RelationDeleteHandler,
  EndpointCreateHandler, EndpointUpdateHandler, EndpointDeleteHandler
} from "@repo/executor";
import { validateGraph } from "@repo/validation";
import { compileGraph } from "@repo/compiler";
import { ArchitectureGraph, Relation, Endpoint } from "@repo/types";
import { 
  createRelationOperation, updateRelationOperation, deleteRelationOperation,
  createEndpointOperation, updateEndpointOperation, deleteEndpointOperation,
  ArchitectureOperation
} from "@repo/operations";

const registry = new OperationRegistry();
registry.register("relation.create", new RelationCreateHandler());
registry.register("relation.update", new RelationUpdateHandler());
registry.register("relation.delete", new RelationDeleteHandler());
registry.register("endpoint.create", new EndpointCreateHandler());
registry.register("endpoint.update", new EndpointUpdateHandler());
registry.register("endpoint.delete", new EndpointDeleteHandler());

const executor = new OperationExecutor(registry);

const assert = (condition: boolean, msg: string) => {
  if (!condition) throw new Error(`❌ FAIL: ${msg}`);
};

const run = () => {
  let graph: ArchitectureGraph = {
    metadata: { id: "test", name: "test", createdAt: "", updatedAt: "", compilerVersion: "", schemaVersion: "" },
    entities: { 
      User: { 
        name: "User", 
        primaryKey: "id", 
        fields: [
          { name: "id", type: "string", required: true },
          { name: "uuid", type: "string", required: true }
        ] 
      },
      Post: { 
        name: "Post", 
        primaryKey: "id", 
        fields: [
          { name: "id", type: "string", required: true },
          { name: "userId", type: "string", required: true }
        ] 
      }
    },
    relations: [], endpoints: [], events: {}, workflows: []
  };

  const execute = <T extends ArchitectureOperation<string, unknown>>(op: T, g: ArchitectureGraph = graph) => 
    executor.execute(op, { graph: g, services: {}, validation: { validate: validateGraph } });

  console.log("🚀 SPRINT 3 VERIFICATION\n");

  // A. relation.create success
  const rCreate = createRelationOperation({ relation: { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-many" } });
  const resA = execute(rCreate);
  assert(resA.success && resA.graph !== graph, "A. relation.create succeeds");
  graph = resA.graph;

  // B. duplicate relation.create rejection + rollback
  const resB = execute(rCreate);
  assert(!resB.success && resB.graph === graph, "B. duplicate relation.create rollback");

  // C. relation.update success
  const rUpdate = updateRelationOperation({ 
    lookup: { source: "User", sourceField: "id", target: "Post", targetField: "userId" },
    partialRelation: { type: "one-to-one" }
  });
  const resC = execute(rUpdate);
  assert(resC.success && resC.graph.relations[0].type === "one-to-one", "C. relation.update succeeds");
  graph = resC.graph;

  // D. nonexistent relation.update rejection + rollback
  const rUpdateBad = updateRelationOperation({ 
    lookup: { source: "Ghost", sourceField: "id", target: "Post", targetField: "userId" }, 
    partialRelation: {} 
  });
  const resD = execute(rUpdateBad);
  assert(!resD.success && resD.graph === graph, "D. nonexistent relation.update rollback");

  // E. identity-changing relation.update success (Uses new 'uuid' field from fixture)
  const rUpdateIdent = updateRelationOperation({
    lookup: { source: "User", sourceField: "id", target: "Post", targetField: "userId" },
    partialRelation: { sourceField: "uuid" } 
  });
  const resE = execute(rUpdateIdent);
  assert(resE.success && resE.graph.relations[0].sourceField === "uuid", "E. identity-change succeeds");
  graph = resE.graph;

  // F. relation.update collision rejection + rollback
  const rCreateCol = createRelationOperation({ relation: { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-many" } });
  graph = execute(rCreateCol).graph; // Insert colliding target back into graph
  const rUpdateCol = updateRelationOperation({
    lookup: { source: "User", sourceField: "uuid", target: "Post", targetField: "userId" },
    partialRelation: { sourceField: "id" } // attempts to collide with the newly created one
  });
  const resF = execute(rUpdateCol);
  assert(!resF.success && resF.graph === graph, "F. update collision rollback");

  // G. relation.update validation failure + rollback
  const rUpdateInvalid = updateRelationOperation({
    lookup: { source: "User", sourceField: "id", target: "Post", targetField: "userId" },
    partialRelation: { target: "MissingEntity" }
  });
  const resG = execute(rUpdateInvalid);
  assert(!resG.success && resG.graph === graph, "G. relation.update validation rollback");

  // H. relation.delete success
  const rDelete = deleteRelationOperation({ lookup: { source: "User", sourceField: "id", target: "Post", targetField: "userId" } });
  const resH = execute(rDelete);
  assert(resH.success && resH.graph !== graph, "H. relation.delete succeeds");
  graph = resH.graph;

  // I. nonexistent relation.delete rejection + rollback
  const resI = execute(rDelete); // running same delete again
  assert(!resI.success && resI.graph === graph, "I. nonexistent relation.delete rollback");

  // J. endpoint.create success
  const eCreate = createEndpointOperation({ endpoint: { method: "GET", path: "/users", entity: "User", action: "read" } });
  const resJ = execute(eCreate);
  assert(resJ.success, "J. endpoint.create succeeds");
  graph = resJ.graph;

  // K. duplicate endpoint.create rejection + rollback
  const resK = execute(eCreate);
  assert(!resK.success && resK.graph === graph, "K. duplicate endpoint.create rollback");

  // L. endpoint.update success
  const eUpdate = updateEndpointOperation({ lookup: { method: "GET", path: "/users" }, partialEndpoint: { action: "update" } });
  const resL = execute(eUpdate);
  assert(resL.success && resL.graph !== graph, "L. endpoint.update succeeds");
  graph = resL.graph;

  // M. nonexistent endpoint.update rejection + rollback
  const eUpdateBad = updateEndpointOperation({ lookup: { method: "POST", path: "/users" }, partialEndpoint: {} });
  const resM = execute(eUpdateBad);
  assert(!resM.success && resM.graph === graph, "M. nonexistent endpoint.update rollback");

  // N. identity-changing endpoint.update success
  const eUpdateIdent = updateEndpointOperation({ lookup: { method: "GET", path: "/users" }, partialEndpoint: { path: "/accounts" } });
  const resN = execute(eUpdateIdent);
  assert(resN.success, "N. identity-changing endpoint.update succeeds");
  graph = resN.graph;

  // O. endpoint.update collision rejection + rollback
  graph = execute(createEndpointOperation({ endpoint: { method: "GET", path: "/users", entity: "User", action: "read" } })).graph;
  const eUpdateCol = updateEndpointOperation({ lookup: { method: "GET", path: "/accounts" }, partialEndpoint: { path: "/users" } });
  const resO = execute(eUpdateCol);
  assert(!resO.success && resO.graph === graph, "O. endpoint.update collision rollback");

  // P. endpoint.update validation failure + rollback
  const eUpdateInvalid = updateEndpointOperation({ lookup: { method: "GET", path: "/users" }, partialEndpoint: { entity: "MissingEntity" } });
  const resP = execute(eUpdateInvalid);
  assert(!resP.success && resP.graph === graph, "P. endpoint.update validation rollback");

  // Q. endpoint.delete success
  const eDelete = deleteEndpointOperation({ lookup: { method: "GET", path: "/users" } });
  const resQ = execute(eDelete);
  assert(resQ.success, "Q. endpoint.delete succeeds");
  graph = resQ.graph;

  // R. nonexistent endpoint.delete rejection + rollback
  const resR = execute(eDelete);
  assert(!resR.success && resR.graph === graph, "R. nonexistent endpoint.delete rollback");

  // S. ambiguous relation lookup rejection + rollback
  const ambigRelGraph = { ...graph, relations: [
    { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-one" as const },
    { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "many-to-many" as const }
  ]};
  const resS = execute(updateRelationOperation({ lookup: { source: "User", sourceField: "id", target: "Post", targetField: "userId" }, partialRelation: {} }), ambigRelGraph);
  assert(!resS.success && resS.graph === ambigRelGraph, "S. ambiguous relation lookup rollback");

  // T. ambiguous endpoint lookup rejection + rollback
  const ambigEndGraph = { ...graph, endpoints: [
    { method: "GET" as const, path: "/accounts", entity: "User", action: "read" as const },
    { method: "GET" as const, path: "/accounts", entity: "User", action: "update" as const }
  ]};
  const resT = execute(updateEndpointOperation({ lookup: { method: "GET", path: "/accounts" }, partialEndpoint: {} }), ambigEndGraph);
  assert(!resT.success && resT.graph === ambigEndGraph, "T. ambiguous endpoint lookup rollback");

  // U. Compiler compatibility
  const compilerResult = compileGraph(graph);
  assert(compilerResult.success === true, "U. Compiler compatibility succeeds");
  assert(compilerResult.ir !== null, "U. Compiler generated IR successfully");

  console.log("✅ ALL SPRINT 3 PUBLIC BOUNDARY TESTS COMPLETED.");
};

try { run(); } catch (e) { console.error(e); process.exit(1); }