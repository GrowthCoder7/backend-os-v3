import { describe, it, expect } from "vitest";
import { ArchitectureGraph } from "@repo/types";
import { serializeGraphContext } from "../context";

describe("serializeGraphContext", () => {
  it("deterministically serializes complete graph state including deeply nested workflow configs and arrays", () => {
    const metadata = { id: "1", name: "test", createdAt: "1", updatedAt: "1", compilerVersion: "1.0", schemaVersion: "1.0" };
    
    // Graph 1: Standard insertion order
    const graph1: ArchitectureGraph = {
      metadata: { ...metadata },
      entities: {}, relations: [], endpoints: [],
      events: {
        "B_Event": { name: "B_Event", payloadSchema: { z: "string", a: "number" } },
        "A_Event": { name: "A_Event", payloadSchema: {} }
      },
      workflows: [
        { triggerEvent: "B_Event", steps: [{ name: "step1", type: "core", config: { b: [2, 1], a: { y: 2, x: 1 } } }] },
        { triggerEvent: "A_Event", steps: [{ name: "step2", type: "custom" }, { name: "step3", type: "core", config: undefined }] }
      ]
    };

    // Graph 2: Scrambled insertion order, but identical semantics
    const graph2: ArchitectureGraph = {
      metadata: { ...metadata },
      entities: {}, relations: [], endpoints: [],
      events: {
        "A_Event": { name: "A_Event", payloadSchema: {} },
        "B_Event": { name: "B_Event", payloadSchema: { a: "number", z: "string" } } // Keys swapped
      },
      workflows: [
        { triggerEvent: "A_Event", steps: [{ name: "step2", type: "custom" }, { name: "step3", type: "core" }] }, // Sequence preserved, optional config omitted completely
        { triggerEvent: "B_Event", steps: [{ name: "step1", type: "core", config: { a: { x: 1, y: 2 }, b: [2, 1] } }] } // Nested config keys swapped, array order identical
      ]
    };

    const serialized1 = serializeGraphContext(graph1);
    const serialized2 = serializeGraphContext(graph2);
    
    // Assert Absolute Determinism
    expect(serialized1).toBe(serialized2);

    // Assert Semantic Contents and Sorting Rules
    const parsed = JSON.parse(serialized1);
    
    expect(parsed.events[0].name).toBe("A_Event");
    expect(parsed.events[1].name).toBe("B_Event");
    expect(Object.keys(parsed.events[1].payloadSchema)).toEqual(["a", "z"]);
    
    expect(parsed.workflows[0].triggerEvent).toBe("A_Event");
    expect(parsed.workflows[0].steps[0].name).toBe("step2"); // Pipeline sequence untouched
    expect(parsed.workflows[0].steps[1].name).toBe("step3");
    expect(parsed.workflows[0].steps[1].config).toBeUndefined(); // Optional field consistency
    
    expect(parsed.workflows[1].triggerEvent).toBe("B_Event");
    expect(Object.keys(parsed.workflows[1].steps[0].config)).toEqual(["a", "b"]); // Deep sort applied
    expect(Object.keys(parsed.workflows[1].steps[0].config.a)).toEqual(["x", "y"]);
    expect(parsed.workflows[1].steps[0].config.b).toEqual([2, 1]); // Array order preserved natively
  });

  it("strictly enforces graph immutability during serialization", () => {
    const graph: ArchitectureGraph = {
      metadata: { id: "1", name: "test", createdAt: "1", updatedAt: "1", compilerVersion: "1.0", schemaVersion: "1.0" },
      entities: {}, relations: [], endpoints: [], 
      events: { "Evt": { name: "Evt", payloadSchema: { b: "string", a: "number" } } }, 
      workflows: [{ triggerEvent: "Evt", steps: [{ name: "s", type: "core", config: { z: 1, a: 2 } }] }]
    };
    
    const originalSnapshot = JSON.stringify(graph);
    serializeGraphContext(graph);
    
    // Assert graph object reference and internal properties were not mutated
    expect(JSON.stringify(graph)).toBe(originalSnapshot);
  });
});