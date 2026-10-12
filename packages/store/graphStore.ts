import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { IntentAdapter } from "@repo/intent";
import { IntentResponse } from "@repo/ai";
import { 
  ArchitectureGraph, 
  Entity, 
  Relation, 
  Endpoint, 
  Event, 
  Workflow 
} from "@repo/types";

import { current } from 'immer';
import { validateGraph, ValidationIssue } from '@repo/validation';

import { 
  createEntityOperation, updateEntityOperation, deleteEntityOperation,
  createEndpointOperation, updateEndpointOperation, deleteEndpointOperation,
  createRelationOperation, updateRelationOperation, deleteRelationOperation,
  createEventOperation, updateEventOperation, deleteEventOperation,
  createWorkflowOperation, updateWorkflowOperation, deleteWorkflowOperation,
  ArchitectureOperation
} from "@repo/operations";

import { 
  OperationExecutor, OperationRegistry, 
  EntityCreateHandler, EntityUpdateHandler, EntityDeleteHandler,
  EndpointCreateHandler, EndpointUpdateHandler, EndpointDeleteHandler,
  RelationCreateHandler, RelationUpdateHandler, RelationDeleteHandler,
  EventCreateHandler, EventUpdateHandler, EventDeleteHandler,
  WorkflowCreateHandler, WorkflowUpdateHandler, WorkflowDeleteHandler
} from "@repo/executor";

import { HistoryEngine, cloneGraph } from "./src/history";

const registry = new OperationRegistry();
registry.register("entity.create", new EntityCreateHandler());
registry.register("entity.update", new EntityUpdateHandler());
registry.register("entity.delete", new EntityDeleteHandler());

registry.register("endpoint.create", new EndpointCreateHandler());
registry.register("endpoint.update", new EndpointUpdateHandler());
registry.register("endpoint.delete", new EndpointDeleteHandler());

registry.register("relation.create", new RelationCreateHandler());
registry.register("relation.update", new RelationUpdateHandler());
registry.register("relation.delete", new RelationDeleteHandler());

registry.register("event.create", new EventCreateHandler());
registry.register("event.update", new EventUpdateHandler());
registry.register("event.delete", new EventDeleteHandler());

registry.register("workflow.create", new WorkflowCreateHandler());
registry.register("workflow.update", new WorkflowUpdateHandler());
registry.register("workflow.delete", new WorkflowDeleteHandler());

const executor = new OperationExecutor(registry);
const intentAdapter = new IntentAdapter(executor);

const initialGraph: ArchitectureGraph = {
  metadata: {
    id: "default-project",
    name: "Default Project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    compilerVersion: "1.0.0",
    schemaVersion: "1.0.0"
  },
  entities: {},
  relations: [],
  endpoints: [],
  events: {},
  workflows: [],
};

// Strict initialization order: initialGraph is declared prior to HistoryEngine instantiation
let historyEngine = new HistoryEngine(initialGraph);

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)){
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA){
    if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

export interface GraphState {
  graph: ArchitectureGraph;
  
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  resetGraph: (graph: ArchitectureGraph) => void;

  addEntity: (entity: Entity) => void;
  updateEntity: (name: string, partialEntity: Partial<Entity>) => void;
  removeEntity: (name: string) => void;
  
  addRelation: (relation: Relation) => void;
  updateRelation: (lookup: { source: string; sourceField: string; target: string; targetField: string }, partialRelation: Partial<Relation>) => void;
  removeRelation: (lookup: { source: string; sourceField: string; target: string; targetField: string }) => void;
  
  addEndpoint: (endpoint: Endpoint) => void;
  updateEndpoint: (lookup: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string }, partialEndpoint: Partial<Endpoint>) => void;
  removeEndpoint: (lookup: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string }) => void;
  updateEndpointPath: (method: "GET" | "POST" | "PUT" | "DELETE", oldPath: string, newPath: string) => void;
  
  addEvent: (event: Event) => void;
  updateEvent: (name: string, partialEvent: Partial<Event>) => void;
  removeEvent: (name: string) => void;

  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (lookup: { triggerEvent: string }, partialWorkflow: Partial<Workflow>) => void;
  removeWorkflow: (lookup: { triggerEvent: string }) => void;

  applyIntent: (intent: IntentResponse) => { success: boolean; message?: string; diagnostics?: ValidationIssue[] };
}

const commitGraph = (state: GraphState, newGraph: ArchitectureGraph) => {
  if (deepEqual(current(state.graph), newGraph)) return;
  historyEngine.record(newGraph);
  state.graph = newGraph;
  state.canUndo = historyEngine.canUndo();
  state.canRedo = historyEngine.canRedo();
};

const executeOperation = (operation: ArchitectureOperation<string, unknown>, graph: ArchitectureGraph): ArchitectureGraph => {
  const context = {
    graph,
    services: {},
    validation: { validate: validateGraph }
  };
  const result = executor.execute(operation, context);
  if (!result.success) {
    const errors = result.diagnostics
      ?.filter((d: ValidationIssue) => d.severity === "error")
      .map((d: ValidationIssue) => d.message).join(" | ");
    throw new Error(errors || "Operation failed validation.");
  }
  return result.graph;
};

export const useGraphStore = create<GraphState>()(
  immer((set) => ({
    graph: initialGraph,
    canUndo: historyEngine.canUndo(),
    canRedo: historyEngine.canRedo(),

    undo: () => set((state) => {
      if (historyEngine.canUndo()) {
        state.graph = historyEngine.undo();
        state.canUndo = historyEngine.canUndo();
        state.canRedo = historyEngine.canRedo();
      }
    }),
    redo: () => set((state) => {
      if (historyEngine.canRedo()) {
        state.graph = historyEngine.redo();
        state.canUndo = historyEngine.canUndo();
        state.canRedo = historyEngine.canRedo();
      }
    }),
    resetGraph: (newGraph) => set((state) => {
      const cloned = cloneGraph(newGraph);
      historyEngine.reset(cloned);
      state.graph = cloned;
      state.canUndo = historyEngine.canUndo();
      state.canRedo = historyEngine.canRedo();
    }),

    // --- ENTITIES ---
    addEntity: (entity) => set((state) => {
      const newGraph = executeOperation(createEntityOperation({ entity }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    updateEntity: (name, partialEntity) => set((state) => {
      const newGraph = executeOperation(updateEntityOperation({ name, partialEntity }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    removeEntity: (name) => set((state) => {
      const newGraph = executeOperation(deleteEntityOperation({ name }), current(state.graph));
      commitGraph(state, newGraph);
    }),

    // --- RELATIONS ---
    addRelation: (relation) => set((state) => {
      const newGraph = executeOperation(createRelationOperation({ relation }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    updateRelation: (lookup, partialRelation) => set((state) => {
      const newGraph = executeOperation(updateRelationOperation({ lookup, partialRelation }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    removeRelation: (lookup) => set((state) => {
      const newGraph = executeOperation(deleteRelationOperation({ lookup }), current(state.graph));
      commitGraph(state, newGraph);
    }),

    // --- ENDPOINTS ---
    addEndpoint: (endpoint) => set((state) => {
      const newGraph = executeOperation(createEndpointOperation({ endpoint }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    updateEndpoint: (lookup, partialEndpoint) => set((state) => {
      const newGraph = executeOperation(updateEndpointOperation({ lookup, partialEndpoint }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    removeEndpoint: (lookup) => set((state) => {
      const newGraph = executeOperation(deleteEndpointOperation({ lookup }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    updateEndpointPath: (method, oldPath, newPath) => set((state) => {
      const operation = updateEndpointOperation({
        lookup: { method, path: oldPath },
        partialEndpoint: { path: newPath }
      });
      const newGraph = executeOperation(operation, current(state.graph));
      commitGraph(state, newGraph);
    }),

    // --- EVENTS ---
    addEvent: (event) => set((state) => {
      const newGraph = executeOperation(createEventOperation({ event }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    updateEvent: (name, partialEvent) => set((state) => {
      const newGraph = executeOperation(updateEventOperation({ name, partialEvent }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    removeEvent: (name) => set((state) => {
      const newGraph = executeOperation(deleteEventOperation({ name }), current(state.graph));
      commitGraph(state, newGraph);
    }),

    // --- WORKFLOWS ---
    addWorkflow: (workflow) => set((state) => {
      const newGraph = executeOperation(createWorkflowOperation({ workflow }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    updateWorkflow: (lookup, partialWorkflow) => set((state) => {
      const newGraph = executeOperation(updateWorkflowOperation({ lookup, partialWorkflow }), current(state.graph));
      commitGraph(state, newGraph);
    }),
    removeWorkflow: (lookup) => set((state) => {
      const newGraph = executeOperation(deleteWorkflowOperation({ lookup }), current(state.graph));
      commitGraph(state, newGraph);
    }),

    // --- AI INTENT BOUNDARY ---
    applyIntent: (intent) => {
      let resultPayload: { success: boolean; message?: string; diagnostics?: ValidationIssue[] } = { success: false, message: "" };

      set((state) => {
        const context = {
          graph: current(state.graph),
          services: {},
          validation: { validate: validateGraph }
        };

        const result = intentAdapter.applyIntent(intent, context);

        if (result.success) {
          commitGraph(state, result.graph);
          resultPayload = { success: true, message: "Architecture successfully updated.", diagnostics: [] };
        } else {
          const errors = result.diagnostics?.map((d) => d.message).join(" | ") || result.message || "Intent rejected.";
          resultPayload = { success: false, message: errors, diagnostics: result.diagnostics };
        }
      });

      return resultPayload;
    },
  }))
);