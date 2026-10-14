import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "@repo/store";
import { ArchitectureGraph } from "@repo/types";

const getEmptyGraph = (): ArchitectureGraph => ({
  metadata: { id: "test", name: "Test", createdAt: "", updatedAt: "", compilerVersion: "1.0", schemaVersion: "1.0" },
  entities: {}, relations: [], endpoints: [], events: {}, workflows: []
});

describe("Sprint 10 Architecture Editor & History UI Integration", () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph(getEmptyGraph());
  });

  it("supports selecting and updating existing entities through store actions", () => {
    const store = useGraphStore.getState();
    store.addEntity({ name: "User", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }] });

    // Update entity
    store.updateEntity("User", { primaryKey: "id", fields: [{ name: "id", type: "string", required: true }, { name: "email", type: "string", required: true }] });

    const updated = useGraphStore.getState().graph.entities["User"];
    expect(updated).toBeDefined();

if (!updated) {
  throw new Error("Updated User entity was not found");
}
    expect(updated.fields.length).toBe(2);
    expect(updated.fields.some(f => f.name === "email")).toBe(true);
  });

  it("surfaces validation errors and prevents deletion of events referenced by workflows", () => {
    const store = useGraphStore.getState();
    store.addEvent({ name: "UserSignedUp", payloadSchema: {} });
    store.addWorkflow({ triggerEvent: "UserSignedUp", steps: [] });

    // Attempting to remove the referenced event must throw/fail validation
    expect(() => {
      store.removeEvent("UserSignedUp");
    }).toThrow();

    // Graph remains untouched
    expect(useGraphStore.getState().graph.events["UserSignedUp"]).toBeDefined();
  });

  it("manages History (Undo/Redo) controls and updates AST preview state", () => {
    const store = useGraphStore.getState();
    expect(store.canUndo).toBe(false);

    store.addEntity({ name: "Post", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }] });
    expect(useGraphStore.getState().canUndo).toBe(true);
    expect(useGraphStore.getState().graph.entities["Post"]).toBeDefined();

    // Undo
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().graph.entities["Post"]).toBeUndefined();
    expect(useGraphStore.getState().canRedo).toBe(true);

    // Redo
    useGraphStore.getState().redo();
    expect(useGraphStore.getState().graph.entities["Post"]).toBeDefined();
    expect(useGraphStore.getState().canUndo).toBe(true);
  });
});