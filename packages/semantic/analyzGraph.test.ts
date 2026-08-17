import { describe, it, expect } from "vitest";
import { analyzeGraph } from "./src";
import { ArchitectureGraph } from "@repo/types";

describe("Semantic Analysis", () => {
  const mockGraph: ArchitectureGraph = {
    metadata: { id: "1", name: "test", createdAt: "1", updatedAt: "1", compilerVersion: "1", schemaVersion: "1" },
    entities: { 
      "User": { name: "User", primaryKey: "id", fields: [] },
      "Post": { name: "Post", primaryKey: "id", fields: [] }
    },
    relations: [{ source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-many" }],
    endpoints: [
      { method: "GET", path: "/users", entity: "User", action: "read" },
      { method: "POST", path: "/users", entity: "User", action: "create" }
    ],
    events: {},
    workflows: []
  };

  it("indexes entities, endpoints, and relations properly on both entities", () => {
    const ctx = analyzeGraph(mockGraph);
    expect(ctx.entityMap.has("User")).toBe(true);
    expect(ctx.entityMap.has("Post")).toBe(true);
    expect(ctx.endpointsByEntity.get("User")?.length).toBe(2);
    expect(ctx.relationsByEntity.get("User")?.length).toBe(1);
    expect(ctx.relationsByEntity.get("Post")?.length).toBe(1);
  });

  it("does not duplicate self-relations", () => {
    const selfGraph = {
      ...mockGraph,
      relations: [{ source: "User", sourceField: "id", target: "User", targetField: "friendId", type: "one-to-many" as const }]
    };
    const ctx = analyzeGraph(selfGraph);
    expect(ctx.relationsByEntity.get("User")?.length).toBe(1);
  });

  it("does not mutate the original graph reference", () => {
    const ctx = analyzeGraph(mockGraph);
    expect(ctx.graph).toBe(mockGraph);
  });

  it("does not validate or throw on structurally invalid graphs", () => {
    const invalidGraph: ArchitectureGraph = {
      ...mockGraph,
      entities: { "Bad": { name: "Bad", primaryKey: "missing", fields: [] } } // Invalid PK
    };
    expect(() => analyzeGraph(invalidGraph)).not.toThrow();
    const ctx = analyzeGraph(invalidGraph);
    expect(ctx.entityMap.has("Bad")).toBe(true);
  });

  it("produces deterministic ordering across differently ordered input arrays", () => {
    const graphA = { 
      ...mockGraph, 
      endpoints: [
        { method: "POST", path: "/users", entity: "User", action: "create" as const },
        { method: "GET", path: "/users", entity: "User", action: "read" as const }
      ] 
    };
    const graphB = { 
      ...mockGraph, 
      endpoints: [
        { method: "GET", path: "/users", entity: "User", action: "read" as const },
        { method: "POST", path: "/users", entity: "User", action: "create" as const }
      ] 
    };
    const ctxA = analyzeGraph(graphA);
    const ctxB = analyzeGraph(graphB);
    expect(ctxA.endpointsByEntity.get("User")).toEqual(ctxB.endpointsByEntity.get("User"));
  });
});