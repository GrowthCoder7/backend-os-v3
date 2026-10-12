
import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore, deepEqual } from "../../graphStore";
import type { ArchitectureGraph, Entity } from "@repo/types";
import type { IntentResponse } from "@repo/ai";

const createEmptyGraph = (): ArchitectureGraph => ({
  metadata: {
    id: "test-project",
    name: "Test Project",
    createdAt: "",
    updatedAt: "",
    compilerVersion: "1.0.0",
    schemaVersion: "1.0.0",
  },
  entities: {},
  relations: [],
  endpoints: [],
  events: {},
  workflows: [],
});

const createValidEntity = (name: string): Entity => ({
  name,
  primaryKey: "id",
  fields: [
    { name: "id", type: "string", required: true },
  ],
});

describe("Sprint 9: Store and History Integration", () => {
  beforeEach(() => {
    // Reset both the active graph and its HistoryEngine baseline.
    useGraphStore.getState().resetGraph(createEmptyGraph());
  });

  describe("Undo and redo", () => {
    it("records a successful operation and supports undo/redo", () => {
      useGraphStore.getState().addEntity(createValidEntity("User"));

      let state = useGraphStore.getState();

      expect(state.graph.entities["User"]).toBeDefined();
      expect(state.canUndo).toBe(true);
      expect(state.canRedo).toBe(false);

      state.undo();

      state = useGraphStore.getState();
      expect(state.graph.entities["User"]).toBeUndefined();
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(true);

      state.redo();

      state = useGraphStore.getState();
      expect(state.graph.entities["User"]).toBeDefined();
      expect(state.canUndo).toBe(true);
      expect(state.canRedo).toBe(false);
    });

    it("clears the redo branch when a new edit follows undo", () => {
      useGraphStore.getState().addEntity(createValidEntity("User"));
      useGraphStore.getState().undo();

      expect(useGraphStore.getState().canRedo).toBe(true);

      useGraphStore.getState().addEntity(createValidEntity("Post"));

      const state = useGraphStore.getState();

      expect(state.graph.entities["User"]).toBeUndefined();
      expect(state.graph.entities["Post"]).toBeDefined();
      expect(state.canRedo).toBe(false);

      state.undo();

      const afterUndo = useGraphStore.getState();
      expect(afterUndo.graph.entities["Post"]).toBeUndefined();
      expect(afterUndo.canUndo).toBe(false);
    });
  });

  describe("No-op detection", () => {
    it("compares nested object data independently of key insertion order", () => {
      const first = {
        name: "User",
        config: { a: 1, b: { x: true, y: false } },
      };

      const second = {
        config: { b: { y: false, x: true }, a: 1 },
        name: "User",
      };

      expect(deepEqual(first, second)).toBe(true);
    });

    it("does not create an extra undo step for an identical update", () => {
      useGraphStore.getState().addEntity(createValidEntity("User"));

      const graphBeforeNoOp = useGraphStore.getState().graph;

      expect(useGraphStore.getState().canUndo).toBe(true);

      // Only updates a property to its existing value.
      useGraphStore.getState().updateEntity("User", {
        primaryKey: "id",
      });

      const afterUpdate = useGraphStore.getState();

      expect(afterUpdate.graph).toEqual(graphBeforeNoOp);
      expect(afterUpdate.canUndo).toBe(true);
      expect(afterUpdate.canRedo).toBe(false);

      // One undo should revert the entity creation itself.
      afterUpdate.undo();

      const afterUndo = useGraphStore.getState();

      expect(afterUndo.graph.entities["User"]).toBeUndefined();
      expect(afterUndo.canUndo).toBe(false);
      expect(afterUndo.canRedo).toBe(true);
    });
  });

  describe("Mutation failures and atomic rollback", () => {
    it("preserves graph and history when an operation fails validation", () => {
      const graphBefore = useGraphStore.getState().graph;

      expect(() => {
        useGraphStore.getState().addEntity({
          name: "InvalidUser",
          primaryKey: "missingId",
          fields: [
            { name: "email", type: "string", required: true },
          ],
        });
      }).toThrow();

      const state = useGraphStore.getState();

      expect(state.graph).toBe(graphBefore);
      expect(state.graph.entities["InvalidUser"]).toBeUndefined();
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);
    });

    it("rolls back a partially executed AI intent without recording history", () => {
      const graphBefore = useGraphStore.getState().graph;

      const intent: IntentResponse = {
        status: "success",
        operations: [
          {
            type: "entity.create",
            payload: {
              entity: createValidEntity("TemporaryUser"),
            },
          },
          {
            type: "event.delete",
            payload: {
              name: "NonExistentEvent",
            },
          },
        ],
      };

      const result = useGraphStore.getState().applyIntent(intent);

      expect(result.success).toBe(false);

      const state = useGraphStore.getState();

      // The first operation must not leak into the committed graph.
      expect(state.graph.entities["TemporaryUser"]).toBeUndefined();
      expect(state.graph).toBe(graphBefore);
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);
    });
  });

  describe("Graph reset", () => {
    it("replaces the graph and clears both undo and redo history", () => {
      useGraphStore.getState().addEntity(createValidEntity("Alpha"));
      useGraphStore.getState().undo();

      expect(useGraphStore.getState().canRedo).toBe(true);

      const replacementGraph = createEmptyGraph();

      replacementGraph.metadata.id = "replacement-project";
      replacementGraph.metadata.name = "Replacement Project";
      replacementGraph.entities["Beta"] = createValidEntity("Beta");

      useGraphStore.getState().resetGraph(replacementGraph);

      const state = useGraphStore.getState();

      expect(state.graph.metadata.id).toBe("replacement-project");
      expect(state.graph.entities["Alpha"]).toBeUndefined();
      expect(state.graph.entities["Beta"]).toBeDefined();
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);

      // Boundary calls must not change the reset graph.
      state.undo();
      state.redo();

      expect(useGraphStore.getState().graph.entities["Beta"]).toBeDefined();
      expect(useGraphStore.getState().canUndo).toBe(false);
      expect(useGraphStore.getState().canRedo).toBe(false);
    });
  });

  describe("Event and workflow integration", () => {
    it("records event and workflow changes through the store history", () => {
      useGraphStore.getState().addEvent({
        name: "UserSignedUp",
        payloadSchema: {},
      });

      useGraphStore.getState().addWorkflow({
        triggerEvent: "UserSignedUp",
        steps: [],
      });

      let state = useGraphStore.getState();

      expect(state.graph.events["UserSignedUp"]).toBeDefined();
      expect(
        state.graph.workflows.some(
          (workflow) => workflow.triggerEvent === "UserSignedUp",
        ),
      ).toBe(true);

      // Undo only the workflow creation.
      state.undo();

      state = useGraphStore.getState();

      expect(state.graph.events["UserSignedUp"]).toBeDefined();
      expect(
        state.graph.workflows.some(
          (workflow) => workflow.triggerEvent === "UserSignedUp",
        ),
      ).toBe(false);
      expect(state.canUndo).toBe(true);
      expect(state.canRedo).toBe(true);

      // Redo must restore the workflow.
      state.redo();

      expect(
        useGraphStore
          .getState()
          .graph.workflows.some(
            (workflow) => workflow.triggerEvent === "UserSignedUp",
          ),
      ).toBe(true);
    });
  });
});
