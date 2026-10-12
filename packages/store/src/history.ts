import { ArchitectureGraph } from "@repo/types";

/**
 * Configuration options for the HistoryEngine.
 */
export interface HistoryOptions {
  /**
   * Maximum number of undo steps to retain in the past stack.
   * Default is 50. Must be at least 1.
   */
  maxDepth?: number;
}

/**
 * Inspection snapshot representing history capacity and readiness.
 */
export interface HistorySnapshot {
  pastCount: number;
  futureCount: number;
  canUndo: boolean;
  canRedo: boolean;
  maxDepth: number;
}

export const DEFAULT_MAX_HISTORY_DEPTH = 50;

/**
 * Creates a deep, detached copy of an ArchitectureGraph.
 * Ensures zero reference sharing between live state and history snapshots.
 */
export function cloneGraph(graph: ArchitectureGraph): ArchitectureGraph {
  if (typeof structuredClone === "function") {
    return structuredClone(graph);
  }
  return JSON.parse(JSON.stringify(graph)) as ArchitectureGraph;
}

/**
 * Deterministic History Engine for committed ArchitectureGraph states.
 * Strictly decoupled from store mutation logic and validation.
 */
export class HistoryEngine {
  private past: ArchitectureGraph[] = [];
  private present: ArchitectureGraph;
  private future: ArchitectureGraph[] = [];
  private readonly maxDepth: number;

  constructor(initialGraph: ArchitectureGraph, options?: HistoryOptions) {
    this.maxDepth = Math.max(1, options?.maxDepth ?? DEFAULT_MAX_HISTORY_DEPTH);
    this.present = cloneGraph(initialGraph);
  }

  /**
   * Returns true if there is at least one previous state to revert to.
   */
  public canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Returns true if there is at least one reverted state to advance to.
   */
  public canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Records a new successfully committed graph state.
   * Clears the redo stack and enforces retention limits.
   */
  public record(graph: ArchitectureGraph): void {
    this.past.push(this.present);
    this.present = cloneGraph(graph);
    this.future = [];

    if (this.past.length > this.maxDepth) {
      this.past.splice(0, this.past.length - this.maxDepth);
    }
  }

  /**
   * Reverts to the immediate prior committed state.
   * If undo is not possible, safely returns a clone of the current state.
   */
  public undo(): ArchitectureGraph {
    if (!this.canUndo()) {
      return cloneGraph(this.present);
    }

    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;

    return cloneGraph(this.present);
  }

  /**
   * Advances to the next state on the active redo branch.
   * If redo is not possible, safely returns a clone of the current state.
   */
  public redo(): ArchitectureGraph {
    if (!this.canRedo()) {
      return cloneGraph(this.present);
    }

    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;

    return cloneGraph(this.present);
  }

  /**
   * Returns an isolated clone of the currently active committed graph.
   */
  public getCurrentState(): ArchitectureGraph {
    return cloneGraph(this.present);
  }

  /**
   * Clears past and future stacks while preserving the current present state.
   */
  public clear(): void {
    this.past = [];
    this.future = [];
  }

  /**
   * Resets the entire history to a new initial graph baseline.
   */
  public reset(graph: ArchitectureGraph): void {
    this.past = [];
    this.future = [];
    this.present = cloneGraph(graph);
  }

  /**
   * Returns diagnostic counters and capability flags.
   */
  public getSnapshot(): HistorySnapshot {
    return {
      pastCount: this.past.length,
      futureCount: this.future.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      maxDepth: this.maxDepth,
    };
  }
}