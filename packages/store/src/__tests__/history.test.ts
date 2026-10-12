import { describe, it, expect, beforeEach } from "vitest";
import { ArchitectureGraph } from "@repo/types";
import { HistoryEngine, cloneGraph } from "../history";

const createMockGraph = (id: string, entityCount: number = 0): ArchitectureGraph => ({
  metadata: {
    id,
    name: `Graph-${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    compilerVersion: "1.0.0",
    schemaVersion: "1.0.0",
  },
  entities: Object.fromEntries(
    Array.from({ length: entityCount }, (_, i) => [
      `Entity${i}`,
      {
        name: `Entity${i}`,
        primaryKey: "id",
        fields: [{ name: "id", type: "string", required: true }],
      },
    ])
  ),
  relations: [],
  endpoints: [],
  events: {},
  workflows: [],
});

describe("HistoryEngine (Sprint 9)", () => {
  let initialGraph: ArchitectureGraph;

  beforeEach(() => {
    initialGraph = createMockGraph("g0", 1);
  });

  describe("Initialization & Capabilities", () => {
    it("initializes with clean past and future stacks", () => {
      const history = new HistoryEngine(initialGraph);

      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);

      const snapshot = history.getSnapshot();
      expect(snapshot.pastCount).toBe(0);
      expect(snapshot.futureCount).toBe(0);
      expect(snapshot.canUndo).toBe(false);
      expect(snapshot.canRedo).toBe(false);
      expect(snapshot.maxDepth).toBe(50);
    });

    it("respects custom maxDepth option and clamps invalid values", () => {
      const customHistory = new HistoryEngine(initialGraph, { maxDepth: 10 });
      expect(customHistory.getSnapshot().maxDepth).toBe(10);

      const clampedHistory = new HistoryEngine(initialGraph, { maxDepth: 0 });
      expect(clampedHistory.getSnapshot().maxDepth).toBe(1);
    });

    it("returns an isolated clone on getCurrentState", () => {
      const history = new HistoryEngine(initialGraph);
      const current = history.getCurrentState();

      expect(current).toEqual(initialGraph);
      expect(current).not.toBe(initialGraph);

      current.metadata.name = "MutatedName";
      expect(history.getCurrentState().metadata.name).toBe("Graph-g0");
    });
  });

  describe("Sequential Edits & Stack Movement", () => {
    it("records sequentially and updates undo capability", () => {
      const history = new HistoryEngine(initialGraph);
      const g1 = createMockGraph("g1", 2);
      const g2 = createMockGraph("g2", 3);

      history.record(g1);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
      expect(history.getCurrentState().metadata.id).toBe("g1");

      history.record(g2);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
      expect(history.getCurrentState().metadata.id).toBe("g2");
      expect(history.getSnapshot().pastCount).toBe(2);
    });

    it("executes single undo and redo cycles correctly", () => {
      const history = new HistoryEngine(initialGraph);
      const g1 = createMockGraph("g1", 2);

      history.record(g1);

      const undone = history.undo();
      expect(undone.metadata.id).toBe("g0");
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
      expect(history.getCurrentState().metadata.id).toBe("g0");

      const redone = history.redo();
      expect(redone.metadata.id).toBe("g1");
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
      expect(history.getCurrentState().metadata.id).toBe("g1");
    });

    it("supports multi-step sequential undos and redos", () => {
      const history = new HistoryEngine(initialGraph);
      const g1 = createMockGraph("g1", 1);
      const g2 = createMockGraph("g2", 2);
      const g3 = createMockGraph("g3", 3);

      history.record(g1);
      history.record(g2);
      history.record(g3);

      expect(history.undo().metadata.id).toBe("g2");
      expect(history.undo().metadata.id).toBe("g1");
      expect(history.undo().metadata.id).toBe("g0");
      expect(history.canUndo()).toBe(false);

      expect(history.redo().metadata.id).toBe("g1");
      expect(history.redo().metadata.id).toBe("g2");
      expect(history.redo().metadata.id).toBe("g3");
      expect(history.canRedo()).toBe(false);
    });
  });

  describe("Branching (Clearing Redo)", () => {
    it("clears redo stack when recording a new state after undo", () => {
      const history = new HistoryEngine(initialGraph);
      const g1 = createMockGraph("g1", 1);
      const g2 = createMockGraph("g2", 2);
      const gBranch = createMockGraph("gBranch", 5);

      history.record(g1);
      history.record(g2);

      history.undo(); // back to g1, future has [g2]
      expect(history.canRedo()).toBe(true);
      expect(history.getSnapshot().futureCount).toBe(1);

      history.record(gBranch); // new commit on branch
      expect(history.canRedo()).toBe(false);
      expect(history.getSnapshot().futureCount).toBe(0);
      expect(history.getCurrentState().metadata.id).toBe("gBranch");

      // Undo should now return to g1, not g2
      expect(history.undo().metadata.id).toBe("g1");
      expect(history.undo().metadata.id).toBe("g0");
    });
  });

  describe("Retention Limits", () => {
    it("enforces maxDepth and evicts oldest states FIFO", () => {
      const history = new HistoryEngine(initialGraph, { maxDepth: 2 });
      const g1 = createMockGraph("g1");
      const g2 = createMockGraph("g2");
      const g3 = createMockGraph("g3");

      history.record(g1);
      history.record(g2);
      history.record(g3); // past has had g0 evicted; retained: [g1, g2]

      expect(history.getSnapshot().pastCount).toBe(2);

      expect(history.undo().metadata.id).toBe("g2");
      expect(history.undo().metadata.id).toBe("g1");
      expect(history.canUndo()).toBe(false); // g0 is no longer reachable
    });
  });

  describe("Snapshot Isolation", () => {
    it("isolates internal history state against external mutation after record()", () => {
      const history = new HistoryEngine(initialGraph);
      const mutableGraph = createMockGraph("mutable", 1);

      history.record(mutableGraph);

      // Mutate external object
      mutableGraph.entities["Entity0"].name = "CorruptedName";
      mutableGraph.metadata.name = "CorruptedGraph";

      const current = history.getCurrentState();
      expect(current.entities["Entity0"].name).toBe("Entity0");
      expect(current.metadata.name).toBe("Graph-mutable");
    });

    it("isolates internal history state against mutations on returned undo/redo objects", () => {
      const history = new HistoryEngine(initialGraph);
      const g1 = createMockGraph("g1", 1);
      history.record(g1);

      const undone = history.undo();
      undone.metadata.name = "CorruptedG0";

      // Verify second retrieval is uncorrupted
      expect(history.getCurrentState().metadata.name).toBe("Graph-g0");

      const redone = history.redo();
      redone.metadata.name = "CorruptedG1";

      expect(history.getCurrentState().metadata.name).toBe("Graph-g1");
    });
  });

  describe("Boundary Conditions & Edge Cases", () => {
    it("handles redundant undo() calls when past stack is empty", () => {
      const history = new HistoryEngine(initialGraph);

      expect(history.canUndo()).toBe(false);
      const res1 = history.undo();
      expect(res1.metadata.id).toBe("g0");

      const res2 = history.undo();
      expect(res2.metadata.id).toBe("g0");
      expect(history.getSnapshot().pastCount).toBe(0);
      expect(history.getSnapshot().futureCount).toBe(0);
    });

    it("handles redundant redo() calls when future stack is empty", () => {
      const history = new HistoryEngine(initialGraph);

      expect(history.canRedo()).toBe(false);
      const res1 = history.redo();
      expect(res1.metadata.id).toBe("g0");

      const res2 = history.redo();
      expect(res2.metadata.id).toBe("g0");
      expect(history.getSnapshot().pastCount).toBe(0);
      expect(history.getSnapshot().futureCount).toBe(0);
    });

    it("handles reset() cleanly", () => {
      const history = new HistoryEngine(initialGraph);
      history.record(createMockGraph("g1"));
      history.record(createMockGraph("g2"));

      const resetGraph = createMockGraph("gReset", 0);
      history.reset(resetGraph);

      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
      expect(history.getCurrentState().metadata.id).toBe("gReset");
    });

    it("handles clear() while preserving the current present state", () => {
      const history = new HistoryEngine(initialGraph);
      history.record(createMockGraph("g1"));
      history.record(createMockGraph("g2"));
      history.undo(); // present is g1, future has g2

      history.clear();

      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
      expect(history.getCurrentState().metadata.id).toBe("g1");
    });
  });
});