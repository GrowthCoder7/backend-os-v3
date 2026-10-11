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
  createWorkflowOperation, updateWorkflowOperation, deleteWorkflowOperation
} from "@repo/operations";

import { 
  OperationExecutor, OperationRegistry, 
  EntityCreateHandler, EntityUpdateHandler, EntityDeleteHandler,
  EndpointCreateHandler, EndpointUpdateHandler, EndpointDeleteHandler,
  RelationCreateHandler, RelationUpdateHandler, RelationDeleteHandler,
  EventCreateHandler, EventUpdateHandler, EventDeleteHandler,
  WorkflowCreateHandler, WorkflowUpdateHandler, WorkflowDeleteHandler
} from "@repo/executor";

const registry = new OperationRegistry();

// Entity Handlers
registry.register("entity.create", new EntityCreateHandler());
registry.register("entity.update", new EntityUpdateHandler());
registry.register("entity.delete", new EntityDeleteHandler());

// Endpoint Handlers
registry.register("endpoint.create", new EndpointCreateHandler());
registry.register("endpoint.update", new EndpointUpdateHandler());
registry.register("endpoint.delete", new EndpointDeleteHandler());

// Relation Handlers
registry.register("relation.create", new RelationCreateHandler());
registry.register("relation.update", new RelationUpdateHandler());
registry.register("relation.delete", new RelationDeleteHandler());

// Event Handlers
registry.register("event.create", new EventCreateHandler());
registry.register("event.update", new EventUpdateHandler());
registry.register("event.delete", new EventDeleteHandler());

// Workflow Handlers
registry.register("workflow.create", new WorkflowCreateHandler());
registry.register("workflow.update", new WorkflowUpdateHandler());
registry.register("workflow.delete", new WorkflowDeleteHandler());

const executor = new OperationExecutor(registry);
const intentAdapter = new IntentAdapter(executor);

interface GraphState {
  graph: ArchitectureGraph;
  
  // Entity Mutators
  addEntity: (entity: Entity) => void;
  updateEntity: (name: string, partialEntity: Partial<Entity>) => void;
  removeEntity: (name: string) => void;
  
  // Relation Mutators
  addRelation: (relation: Relation) => void;
  updateRelation: (lookup: { source: string; sourceField: string; target: string; targetField: string }, partialRelation: Partial<Relation>) => void;
  removeRelation: (lookup: { source: string; sourceField: string; target: string; targetField: string }) => void;
  
  // Endpoint Mutators
  addEndpoint: (endpoint: Endpoint) => void;
  updateEndpoint: (lookup: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string }, partialEndpoint: Partial<Endpoint>) => void;
  removeEndpoint: (lookup: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string }) => void;
  updateEndpointPath: (method: string, oldPath: string, newPath: string) => void;
  
  // Event Mutators
  addEvent: (event: Event) => void;
  updateEvent: (name: string, partialEvent: Partial<Event>) => void;
  removeEvent: (name: string) => void;

  // Workflow Mutators
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (lookup: { triggerEvent: string }, partialWorkflow: Partial<Workflow>) => void;
  removeWorkflow: (lookup: { triggerEvent: string }) => void;

  // AI Intent Boundary
  applyIntent: (intent: IntentResponse) => { success: boolean; message?: string; diagnostics?: ValidationIssue[] };
}

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

const executeOperation = (operation: any, graph: ArchitectureGraph) => {
  const context = {
    graph,
    services: {},
    validation: { validate: validateGraph }
  };
  const result = executor.execute(operation, context);
  if (!result.success) {
    const errors = result.diagnostics
      ?.filter((d: any) => d.severity === "error")
      .map((d: any) => d.message).join(" | ");
    throw new Error(errors || "Operation failed validation.");
  }
  return result.graph;
};

export const useGraphStore = create<GraphState>()(
  immer((set) => ({
    graph: initialGraph,

    // --- ENTITIES ---
    addEntity: (entity) => set((state) => {
      state.graph = executeOperation(createEntityOperation({ entity }), current(state.graph));
    }),
    updateEntity: (name, partialEntity) => set((state) => {
      state.graph = executeOperation(updateEntityOperation({ name, partialEntity }), current(state.graph));
    }),
    removeEntity: (name) => set((state) => {
      state.graph = executeOperation(deleteEntityOperation({ name }), current(state.graph));
    }),

    // --- RELATIONS ---
    addRelation: (relation) => set((state) => {
      state.graph = executeOperation(createRelationOperation({ relation }), current(state.graph));
    }),
    updateRelation: (lookup, partialRelation) => set((state) => {
      state.graph = executeOperation(updateRelationOperation({ lookup, partialRelation }), current(state.graph));
    }),
    removeRelation: (lookup) => set((state) => {
      state.graph = executeOperation(deleteRelationOperation({ lookup }), current(state.graph));
    }),

    // --- ENDPOINTS ---
    addEndpoint: (endpoint) => set((state) => {
      state.graph = executeOperation(createEndpointOperation({ endpoint }), current(state.graph));
    }),
    updateEndpoint: (lookup, partialEndpoint) => set((state) => {
      state.graph = executeOperation(updateEndpointOperation({ lookup, partialEndpoint }), current(state.graph));
    }),
    removeEndpoint: (lookup) => set((state) => {
      state.graph = executeOperation(deleteEndpointOperation({ lookup }), current(state.graph));
    }),
    updateEndpointPath: (method, oldPath, newPath) => set((state) => {
      const operation = updateEndpointOperation({
        lookup: { method: method as any, path: oldPath },
        partialEndpoint: { path: newPath }
      });
      state.graph = executeOperation(operation, current(state.graph));
    }),

    // --- EVENTS ---
    addEvent: (event) => set((state) => {
      state.graph = executeOperation(createEventOperation({ event }), current(state.graph));
    }),
    updateEvent: (name, partialEvent) => set((state) => {
      state.graph = executeOperation(updateEventOperation({ name, partialEvent }), current(state.graph));
    }),
    removeEvent: (name) => set((state) => {
      state.graph = executeOperation(deleteEventOperation({ name }), current(state.graph));
    }),

    // --- WORKFLOWS ---
    addWorkflow: (workflow) => set((state) => {
      state.graph = executeOperation(createWorkflowOperation({ workflow }), current(state.graph));
    }),
    updateWorkflow: (lookup, partialWorkflow) => set((state) => {
      state.graph = executeOperation(updateWorkflowOperation({ lookup, partialWorkflow }), current(state.graph));
    }),
    removeWorkflow: (lookup) => set((state) => {
      state.graph = executeOperation(deleteWorkflowOperation({ lookup }), current(state.graph));
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
          state.graph = result.graph; 
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