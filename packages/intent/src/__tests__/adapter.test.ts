import { describe, it, expect, beforeEach } from "vitest";
import { ArchitectureGraph } from "@repo/types";
import { validateGraph } from "@repo/validation";
import { IntentAdapter } from "../adapter";
import { OperationExecutor, OperationRegistry } from "@repo/executor";
import { IntentResponse, IntentOperation } from "@repo/ai";

import {
  EntityCreateHandler, EntityUpdateHandler, EntityDeleteHandler,
  RelationCreateHandler, RelationUpdateHandler, RelationDeleteHandler,
  EndpointCreateHandler, EndpointUpdateHandler, EndpointDeleteHandler,
  EventCreateHandler, EventUpdateHandler, EventDeleteHandler,
  WorkflowCreateHandler, WorkflowUpdateHandler, WorkflowDeleteHandler
} from "@repo/executor";

const createTestAdapter = (): IntentAdapter => {
  const registry = new OperationRegistry();
  registry.register("entity.create", new EntityCreateHandler());
  registry.register("entity.update", new EntityUpdateHandler());
  registry.register("entity.delete", new EntityDeleteHandler());
  registry.register("relation.create", new RelationCreateHandler());
  registry.register("relation.update", new RelationUpdateHandler());
  registry.register("relation.delete", new RelationDeleteHandler());
  registry.register("endpoint.create", new EndpointCreateHandler());
  registry.register("endpoint.update", new EndpointUpdateHandler());
  registry.register("endpoint.delete", new EndpointDeleteHandler());
  registry.register("event.create", new EventCreateHandler());
  registry.register("event.update", new EventUpdateHandler());
  registry.register("event.delete", new EventDeleteHandler());
  registry.register("workflow.create", new WorkflowCreateHandler());
  registry.register("workflow.update", new WorkflowUpdateHandler());
  registry.register("workflow.delete", new WorkflowDeleteHandler());
  return new IntentAdapter(new OperationExecutor(registry));
};

const getBaseValidGraph = (): ArchitectureGraph => ({
  metadata: {
    id: "test-proj",
    name: "Test Project",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    compilerVersion: "1.0.0",
    schemaVersion: "1.0.0"
  },
  entities: {
    User: {
      name: "User",
      primaryKey: "id",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "email", type: "string", required: true }
      ]
    },
    Post: {
      name: "Post",
      primaryKey: "id",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "userId", type: "string", required: true },
        { name: "title", type: "string", required: true }
      ]
    }
  },
  relations: [
    {
      source: "User",
      sourceField: "id",
      target: "Post",
      targetField: "userId",
      type: "one-to-many"
    }
  ],
  endpoints: [
    { method: "GET", path: "/users", entity: "User", action: "read" }
  ],
  events: {
    UserSignedUp: { name: "UserSignedUp", payloadSchema: { userId: "string" } },
    UnusedEvent: { name: "UnusedEvent", payloadSchema: { note: "string" } }
  },
  workflows: [
    { triggerEvent: "UserSignedUp", steps: [{ name: "sendEmail", type: "core" }] }
  ]
});

describe("IntentAdapter — 15 Operation Variants and Integration Integrity", () => {
  let adapter: IntentAdapter;
  let graph: ArchitectureGraph;

  beforeEach(() => {
    adapter = createTestAdapter();
    graph = getBaseValidGraph();
  });

  const executeIntent = (op: IntentOperation) => {
    const intent: IntentResponse = { status: "success", operations: [op] };
    return adapter.applyIntent(intent, {
      graph,
      services: {},
      validation: { validate: validateGraph }
    });
  };

  it("1. entity.create succeeds and adds entity", () => {
    const res = executeIntent({
      type: "entity.create",
      payload: {
        entity: {
          name: "Comment",
          primaryKey: "id",
          fields: [{ name: "id", type: "string", required: true }]
        }
      }
    });
    expect(res.success).toBe(true);
    expect(res.graph.entities["Comment"]).toBeDefined();
  });

  it("2. entity.update succeeds and updates fields and primaryKey consistently", () => {
    graph.relations = [];
    graph.endpoints = [];
    const res = executeIntent({
      type: "entity.update",
      payload: {
        name: "User",
        partialEntity: {
          primaryKey: "userId",
          fields: [
            { name: "userId", type: "string", required: true },
            { name: "email", type: "string", required: true }
          ]
        }
      }
    });
    expect(res.success).toBe(true);
    expect(res.graph.entities["User"].primaryKey).toBe("userId");
  });

  it("3. entity.delete succeeds when dependencies are cleared", () => {
    graph.relations = [];
    graph.endpoints = [];
    const res = executeIntent({ type: "entity.delete", payload: { name: "Post" } });
    expect(res.success).toBe(true);
    expect(res.graph.entities["Post"]).toBeUndefined();
  });

  it("4. relation.create succeeds with valid entity targets", () => {
    const res = executeIntent({
      type: "relation.create",
      payload: {
        relation: {
          source: "Post",
          sourceField: "userId",
          target: "User",
          targetField: "id",
          type: "many-to-one"
        }
      }
    });
    expect(res.success).toBe(true);
    expect(
      res.graph.relations.some(
        r => r.source === "Post" && r.sourceField === "userId" && r.target === "User"
      )
    ).toBe(true);
  });

  it("5. relation.update modifies the relation identified by complete lookup", () => {
    const res = executeIntent({
      type: "relation.update",
      payload: {
        lookup: { source: "User", sourceField: "id", target: "Post", targetField: "userId" },
        partialRelation: { type: "one-to-one" }
      }
    });
    expect(res.success).toBe(true);
    const updated = res.graph.relations.find(
      r => r.source === "User" && r.sourceField === "id" && r.target === "Post" && r.targetField === "userId"
    );
    expect(updated?.type).toBe("one-to-one");
  });

  it("6. relation.delete removes the relation matching lookup", () => {
    const res = executeIntent({
      type: "relation.delete",
      payload: { lookup: { source: "User", sourceField: "id", target: "Post", targetField: "userId" } }
    });
    expect(res.success).toBe(true);
    expect(
      res.graph.relations.some(
        r => r.source === "User" && r.target === "Post"
      )
    ).toBe(false);
  });

  it("7. endpoint.create adds new valid endpoint", () => {
    const res = executeIntent({
      type: "endpoint.create",
      payload: { endpoint: { method: "POST", path: "/users", entity: "User", action: "create" } }
    });
    expect(res.success).toBe(true);
    expect(res.graph.endpoints.some(e => e.method === "POST" && e.path === "/users")).toBe(true);
  });

  it("8. endpoint.update correctly changes path and subsequent lookup reflects new path", () => {
    const res = executeIntent({
      type: "endpoint.update",
      payload: {
        lookup: { method: "GET", path: "/users" },
        partialEndpoint: { path: "/users/all" }
      }
    });
    expect(res.success).toBe(true);
    expect(res.graph.endpoints.find(e => e.method === "GET" && e.path === "/users/all")).toBeDefined();
    expect(res.graph.endpoints.find(e => e.method === "GET" && e.path === "/users")).toBeUndefined();
  });

  it("9. endpoint.delete removes target endpoint by lookup", () => {
    const res = executeIntent({
      type: "endpoint.delete",
      payload: { lookup: { method: "GET", path: "/users" } }
    });
    expect(res.success).toBe(true);
    expect(res.graph.endpoints.find(e => e.method === "GET" && e.path === "/users")).toBeUndefined();
  });

  it("10. event.create adds new event to graph", () => {
    const res = executeIntent({
      type: "event.create",
      payload: { event: { name: "PostPublished", payloadSchema: { postId: "string" } } }
    });
    expect(res.success).toBe(true);
    expect(res.graph.events["PostPublished"]).toBeDefined();
  });

  it("11. event.update updates event payloadSchema", () => {
    const res = executeIntent({
      type: "event.update",
      payload: { name: "UnusedEvent", partialEvent: { payloadSchema: { note: "string", tags: "json" } } }
    });
    expect(res.success).toBe(true);
    expect(res.graph.events["UnusedEvent"].payloadSchema["tags"]).toBe("json");
  });

  it("12. event.delete succeeds when no workflow references it", () => {
    const res = executeIntent({ type: "event.delete", payload: { name: "UnusedEvent" } });
    expect(res.success).toBe(true);
    expect(res.graph.events["UnusedEvent"]).toBeUndefined();
  });

  it("13. workflow.create succeeds when referencing existing event", () => {
    const res = executeIntent({
      type: "workflow.create",
      payload: { workflow: { triggerEvent: "UnusedEvent", steps: [{ name: "step1", type: "core" }] } }
    });
    expect(res.success).toBe(true);
    expect(res.graph.workflows.some(w => w.triggerEvent === "UnusedEvent")).toBe(true);
  });

  it("14. workflow.update updates workflow steps", () => {
    const res = executeIntent({
      type: "workflow.update",
      payload: {
        lookup: { triggerEvent: "UserSignedUp" },
        partialWorkflow: { steps: [{ name: "step1", type: "core" }, { name: "step2", type: "custom" }] }
      }
    });
    expect(res.success).toBe(true);
    const wf = res.graph.workflows.find(w => w.triggerEvent === "UserSignedUp");
    expect(wf?.steps.length).toBe(2);
  });

  it("15. workflow.delete removes workflow by triggerEvent lookup", () => {
    const res = executeIntent({
      type: "workflow.delete",
      payload: { lookup: { triggerEvent: "UserSignedUp" } }
    });
    expect(res.success).toBe(true);
    expect(res.graph.workflows.some(w => w.triggerEvent === "UserSignedUp")).toBe(false);
  });

  describe("Negative Paths and Multi-Operation Atomic Rollback", () => {
    it("rejects event.delete when referenced by an active workflow", () => {
      const res = executeIntent({ type: "event.delete", payload: { name: "UserSignedUp" } });
      expect(res.success).toBe(false);
      expect(res.graph).toBe(graph);
      expect(res.graph.events["UserSignedUp"]).toBeDefined();
    });

    it("rejects missing target lookups for workflow.update and preserves graph", () => {
      const res = executeIntent({
        type: "workflow.update",
        payload: { lookup: { triggerEvent: "NonExistent" }, partialWorkflow: { steps: [] } }
      });
      expect(res.success).toBe(false);
      expect(res.graph).toBe(graph);
    });

    it("rolls back multi-operation intent atomically if later operation fails", () => {
      const multiIntent: IntentResponse = {
        status: "success",
        operations: [
          {
            type: "event.create",
            payload: { event: { name: "IntermediateEvent", payloadSchema: {} } }
          },
          {
            type: "workflow.create",
            payload: { workflow: { triggerEvent: "MissingTriggerEvent", steps: [] } }
          }
        ]
      };

      const res = adapter.applyIntent(multiIntent, {
        graph,
        services: {},
        validation: { validate: validateGraph }
      });

      expect(res.success).toBe(false);
      expect(res.graph).toBe(graph);
      expect(res.graph.events["IntermediateEvent"]).toBeUndefined();
    });
  });
});