import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "./graphStore";
import { Entity, Endpoint, Relation, Event, Workflow } from "@repo/types";
import { IntentResponse } from "@repo/ai";

describe("GraphStore Mutation Boundary", () => {
  const userEntity: Entity = {
    name: "User",
    primaryKey: "id",
    fields: [{ name: "id", type: "string", required: true }]
  };

  const postEntity: Entity = {
    name: "Post",
    primaryKey: "id",
    fields: [
      { name: "id", type: "string", required: true },
      { name: "userId", type: "string", required: true }
    ]
  };

  beforeEach(() => {
    useGraphStore.setState({
      graph: {
        metadata: { id: "test", name: "test", createdAt: "1", updatedAt: "1", compilerVersion: "1.0.0", schemaVersion: "1.0.0" },
        entities: {
          "User": userEntity,
          "Post": postEntity
        },
        relations: [],
        endpoints: [],
        events: {},
        workflows: []
      }
    });
  });

  const validEndpoint: Endpoint = { method: "GET", path: "/users", entity: "User", action: "read" };
  const validRelation: Relation = { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-many" };

  it("1. addEndpoint uses Executor and modifies state successfully", () => {
    useGraphStore.getState().addEndpoint(validEndpoint);
    expect(useGraphStore.getState().graph.endpoints.length).toBe(1);
  });

  it("2. addRelation uses Executor and modifies state successfully", () => {
    useGraphStore.getState().addRelation(validRelation);
    expect(useGraphStore.getState().graph.relations.length).toBe(1);
  });
});

describe("GraphStore Event & Workflow — Deterministic Store Actions", () => {
  beforeEach(() => {
    useGraphStore.setState({
      graph: {
        metadata: { id: "test", name: "test", createdAt: "1", updatedAt: "1", compilerVersion: "1.0.0", schemaVersion: "1.0.0" },
        entities: {},
        relations: [],
        endpoints: [],
        events: {},
        workflows: []
      }
    });
  });

  it("exercises addEvent, updateEvent, and removeEvent through executor", () => {
    const store = useGraphStore.getState();
    store.addEvent({ name: "EvtA", payloadSchema: { val: "string" } });
    expect(useGraphStore.getState().graph.events["EvtA"]).toBeDefined();

    store.updateEvent("EvtA", { name: "EvtB" });
    expect(useGraphStore.getState().graph.events["EvtB"]).toBeDefined();
    expect(useGraphStore.getState().graph.events["EvtA"]).toBeUndefined();

    store.removeEvent("EvtB");
    expect(useGraphStore.getState().graph.events["EvtB"]).toBeUndefined();
  });

  it("exercises addWorkflow, updateWorkflow, and removeWorkflow through executor", () => {
    const store = useGraphStore.getState();
    store.addEvent({ name: "EvtA", payloadSchema: {} });
    store.addWorkflow({ triggerEvent: "EvtA", steps: [] });
    expect(useGraphStore.getState().graph.workflows.length).toBe(1);

    store.updateWorkflow({ triggerEvent: "EvtA" }, { steps: [{ name: "step1", type: "core" }] });
    expect(useGraphStore.getState().graph.workflows[0].steps.length).toBe(1);

    store.removeWorkflow({ triggerEvent: "EvtA" });
    expect(useGraphStore.getState().graph.workflows.length).toBe(0);
  });

  it("rejects duplicate Event creation, preserving original graph reference", () => {
    const store = useGraphStore.getState();
    store.addEvent({ name: "UniqueEvent", payloadSchema: {} });
    
    const graphBeforeFail = useGraphStore.getState().graph;

    expect(() => store.addEvent({ name: "UniqueEvent", payloadSchema: {} })).toThrow();
    expect(useGraphStore.getState().graph).toBe(graphBeforeFail);
  });

  it("rejects renaming an Event currently referenced by a Workflow", () => {
    const store = useGraphStore.getState();
    store.addEvent({ name: "TriggerA", payloadSchema: {} });
    store.addWorkflow({ triggerEvent: "TriggerA", steps: [] });
    
    const graphBeforeFail = useGraphStore.getState().graph;

    expect(() => store.updateEvent("TriggerA", { name: "TriggerB" })).toThrow();
    
    expect(useGraphStore.getState().graph).toBe(graphBeforeFail);
    expect(useGraphStore.getState().graph.events["TriggerB"]).toBeUndefined();
  });

  it("rejects ambiguous workflow deletes based on exact propagated diagnostic", () => {
    const store = useGraphStore.getState();
    store.addEvent({ name: "AmbiguousTrigger", payloadSchema: {} });
    
    useGraphStore.setState(state => {
      state.graph.workflows.push(
        { triggerEvent: "AmbiguousTrigger", steps: [] },
        { triggerEvent: "AmbiguousTrigger", steps: [] }
      );
    });

    const graphBeforeFail = useGraphStore.getState().graph;

    expect(() => store.removeWorkflow({ triggerEvent: "AmbiguousTrigger" }))
      .toThrow(/Ambiguous delete: Multiple workflows found for trigger event 'AmbiguousTrigger'/);
    
    expect(useGraphStore.getState().graph).toBe(graphBeforeFail);
  });
});