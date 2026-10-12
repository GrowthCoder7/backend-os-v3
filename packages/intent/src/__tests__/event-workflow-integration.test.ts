import { describe, it, expect, beforeEach } from "vitest";
import { ArchitectureGraph } from "@repo/types";
import { validateGraph } from "@repo/validation";
import { IntentAdapter } from "../adapter";
import { OperationExecutor, OperationRegistry } from "@repo/executor";
import { IntentResponse } from "@repo/ai";

import {
  EventCreateHandler, EventUpdateHandler, EventDeleteHandler,
  WorkflowCreateHandler, WorkflowUpdateHandler, WorkflowDeleteHandler
} from "@repo/executor";

const createTestAdapter = (): IntentAdapter => {
  const registry = new OperationRegistry();
  registry.register("event.create", new EventCreateHandler());
  registry.register("event.update", new EventUpdateHandler());
  registry.register("event.delete", new EventDeleteHandler());
  registry.register("workflow.create", new WorkflowCreateHandler());
  registry.register("workflow.update", new WorkflowUpdateHandler());
  registry.register("workflow.delete", new WorkflowDeleteHandler());
  return new IntentAdapter(new OperationExecutor(registry));
};

const getBaseValidGraph = (): ArchitectureGraph => ({
  metadata: { id: "test", name: "Test", createdAt: "", updatedAt: "", compilerVersion: "1", schemaVersion: "1" },
  entities: {}, relations: [], endpoints: [],
  events: {
    UserSignedUp: { name: "UserSignedUp", payloadSchema: { userId: "string" } },
    UnusedEvent: { name: "UnusedEvent", payloadSchema: { note: "string" } }
  },
  workflows: [
    { triggerEvent: "UserSignedUp", steps: [] }
  ]
});

describe("Event & Workflow - Full Integration & Atomicity", () => {
  let adapter: IntentAdapter;
  let graph: ArchitectureGraph;

  beforeEach(() => {
    adapter = createTestAdapter();
    graph = getBaseValidGraph();
  });

  const execute = (intent: IntentResponse) => adapter.applyIntent(intent, { graph, services: {}, validation: { validate: validateGraph } });

  it("successfully applies valid Event and Workflow operations", () => {
    const res = execute({
      status: "success",
      operations: [
        { type: "event.create", payload: { event: { name: "OrderPlaced", payloadSchema: {} } } },
        { type: "workflow.create", payload: { workflow: { triggerEvent: "OrderPlaced", steps: [] } } }
      ]
    });
    expect(res.success).toBe(true);
    expect(res.graph.events["OrderPlaced"]).toBeDefined();
    expect(res.graph.workflows.some(w => w.triggerEvent === "OrderPlaced")).toBe(true);
  });

  it("fails atomically when deleting a referenced Event", () => {
    const res = execute({
      status: "success",
      operations: [
        { type: "event.create", payload: { event: { name: "TempEvent", payloadSchema: {} } } },
        { type: "event.delete", payload: { name: "UserSignedUp" } } // This should fail validation
      ]
    });
    expect(res.success).toBe(false);
    expect(res.graph).toBe(graph); // Original graph reference preserved
    expect(res.graph.events["TempEvent"]).toBeUndefined(); // TempEvent rolled back
    expect(res.graph.events["UserSignedUp"]).toBeDefined();
  });

  it("fails atomically when updating workflow to a nonexistent trigger", () => {
    const res = execute({
      status: "success",
      operations: [
        { type: "workflow.update", payload: { lookup: { triggerEvent: "UserSignedUp" }, partialWorkflow: { triggerEvent: "MissingEvent" } } }
      ]
    });
    expect(res.success).toBe(false);
    expect(res.graph).toBe(graph);
    expect(res.graph.workflows.find(w => w.triggerEvent === "UserSignedUp")).toBeDefined();
  });

  it("fails when creating a duplicate workflow", () => {
    const res = execute({
      status: "success",
      operations: [
        { type: "workflow.create", payload: { workflow: { triggerEvent: "UserSignedUp", steps: [] } } }
      ]
    });
    expect(res.success).toBe(false);
    expect(res.diagnostics[0].message).toContain("already exists");
    expect(res.graph).toBe(graph);
  });
});