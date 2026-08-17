import { describe, it, expect } from "vitest";
import { compileGraph } from "./pipelineGenerator";
import { ArchitectureGraph } from "@repo/types";

describe("Compiler Pipeline", () => {
  const validGraph: ArchitectureGraph = {
    metadata: { id: "1", name: "test", createdAt: "2026-08-17T00:00:00.000Z", updatedAt: "2026-08-17T00:00:00.000Z", compilerVersion: "1", schemaVersion: "1" },
    entities: { "User": { name: "User", primaryKey: "id", fields: [{name: "id", type: "string", required: true}, {name: "friendId", type: "string", required: false}] } },
    relations: [{ source: "User", sourceField: "id", target: "User", targetField: "friendId", type: "one-to-many" }],
    endpoints: [{ method: "GET", path: "/users", entity: "User", action: "read" }],
    events: { "UserCreated": { name: "UserCreated", payloadSchema: {} } },
    workflows: [{ triggerEvent: "UserCreated", steps: [] }]
  };

  it("rejects invalid graph and returns ir null", () => {
    const invalidGraph: ArchitectureGraph = {
      ...validGraph,
      entities: { "Bad": { name: "Bad", primaryKey: "id", fields: [] } }
    };
    const res = compileGraph(invalidGraph);
    expect(res.success).toBe(false);
    expect(res.ir).toBeNull();
  });

  it("compiles valid graph deterministically", () => {
    const res1 = compileGraph(validGraph);
    const res2 = compileGraph(validGraph);
    expect(res1.success).toBe(true);
    expect(res1.ir).toEqual(res2.ir);
  });

  it("maps complete frozen IR cleanly without framework concepts", () => {
    const res = compileGraph(validGraph);
    const ir = res.ir!;
    
    expect(ir.database.models[0].tableName).toBe("user");
    expect(ir.database.models[0].relations.length).toBe(1);
    expect(ir.database.models[0].relations[0].targetField).toBe("friendId");
    
    expect(ir.apis.routes[0].path).toBe("/users");
    // Verify handlerId is a purely logical, framework-independent identifier
    expect(ir.apis.routes[0].handlerId).toBe("get_user");
    
    expect(ir.workflows.workflows[0].triggerEvent).toBe("UserCreated");
    expect(ir.events["UserCreated"].name).toBe("UserCreated");
    
    expect(ir.metadata.generatedAt).toBe("2026-08-17T00:00:00.000Z");
  });

  it("contains no framework-specific concepts in the generated IR", () => {
    const res = compileGraph(validGraph);
    const serializedIR = JSON.stringify(res.ir);

    // Assert that BackendIR does not leak target framework specifics
    expect(serializedIR).not.toContain("NestJS");
    expect(serializedIR).not.toContain("@nestjs");
    
    // Assert that BackendIR does not expose framework-specific architectural constructs
    expect(serializedIR).not.toContain("controllers");
    expect(serializedIR).not.toContain("services");
    expect(serializedIR).not.toContain("modules");
  });
});