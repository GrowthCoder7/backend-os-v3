import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "./graphStore";
import { Entity, Endpoint, Relation } from "@repo/types";
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
    // Seed the graph with valid required entities to ensure endpoint/relation tests 
    // are evaluating their own validity, not failing due to missing target entities.
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

  const validEndpoint: Endpoint = {
    method: "GET",
    path: "/users",
    entity: "User", // Relies on seeded User
    action: "read"
  };

  const validRelation: Relation = {
    source: "User",     // Relies on seeded User
    sourceField: "id",
    target: "Post",     // Relies on seeded Post
    targetField: "userId",
    type: "one-to-many"
  };

  it("1. addEndpoint uses Executor and modifies state successfully", () => {
    useGraphStore.getState().addEndpoint(validEndpoint);
    expect(useGraphStore.getState().graph.endpoints.length).toBe(1);
    expect(useGraphStore.getState().graph.endpoints[0].path).toBe("/users");
  });

  it("2. addRelation uses Executor and modifies state successfully", () => {
    useGraphStore.getState().addRelation(validRelation);
    expect(useGraphStore.getState().graph.relations.length).toBe(1);
    expect(useGraphStore.getState().graph.relations[0].target).toBe("Post");
  });

  it("3 & 5. updateEndpoint and removeEndpoint use Executor successfully", () => {
    const store = useGraphStore.getState();
    store.addEndpoint(validEndpoint);
    
    store.updateEndpoint({ method: "GET", path: "/users" }, { path: "/users/all" });
    expect(useGraphStore.getState().graph.endpoints[0].path).toBe("/users/all");

    store.removeEndpoint({ method: "GET", path: "/users/all" });
    expect(useGraphStore.getState().graph.endpoints.length).toBe(0);
  });

  it("4 & 6. updateRelation and removeRelation use Executor successfully", () => {
    const store = useGraphStore.getState();
    store.addRelation(validRelation);
    
    store.updateRelation(
      { source: "User", sourceField: "id", target: "Post", targetField: "userId" },
      { type: "one-to-one" }
    );
    expect(useGraphStore.getState().graph.relations[0].type).toBe("one-to-one");

    store.removeRelation({ source: "User", sourceField: "id", target: "Post", targetField: "userId" });
    expect(useGraphStore.getState().graph.relations.length).toBe(0);
  });

  it("7 & 8. Invalid mutations throw Executor/Validation errors properly", () => {
    const store = useGraphStore.getState();
    
    // Relation points to target "Ghost" which doesn't exist in the seeded graph
    const invalidRelation: Relation = { ...validRelation, target: "Ghost" };
    
    // Proves that Validation engine boundary correctly traps structurally invalid requests
    expect(() => {
      store.addRelation(invalidRelation);
    }).toThrow();
    
    expect(useGraphStore.getState().graph.relations.length).toBe(0);
  });

  it("9. updateEndpointPath legacy wrapper behaves correctly via Executor", () => {
    const store = useGraphStore.getState();
    store.addEndpoint(validEndpoint);
    
    store.updateEndpointPath("GET", "/users", "/legacy/users");
    expect(useGraphStore.getState().graph.endpoints[0].path).toBe("/legacy/users");
  });

  it("10. AI Intents for endpoints and relations execute successfully on seeded graph", () => {
    const store = useGraphStore.getState();
    const intent: IntentResponse = {
      status: "success",
      operations: [
        { type: "endpoint.create", payload: { endpoint: validEndpoint } },
        { type: "relation.create", payload: { relation: validRelation } }
      ]
    };

    const res = store.applyIntent(intent);
    expect(res.success).toBe(true);
    expect(useGraphStore.getState().graph.endpoints.length).toBe(1);
    expect(useGraphStore.getState().graph.relations.length).toBe(1);
  });
});