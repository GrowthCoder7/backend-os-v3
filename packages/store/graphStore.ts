// /packages/store/graphStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { 
  ArchitectureGraph, 
  Entity, 
  Relation, 
  Endpoint, 
  Event, 
  Workflow 
} from "@repo/types";

import {current} from 'immer'
import {validateGraph} from '@repo/validation'

// IMPORT DEV A'S CANONICAL FACTORY
import { createEntityOperation,updateEntityOperation,deleteEntityOperation} from "@repo/operations";
import { OperationExecutor, OperationRegistry, EntityCreateHandler, EntityUpdateHandler,EntityDeleteHandler } from "@repo/executor";

const registry = new OperationRegistry();
registry.register("entity.create", new EntityCreateHandler());
registry.register("entity.update", new EntityUpdateHandler());
registry.register("entity.delete", new EntityDeleteHandler());
const executor = new OperationExecutor(registry);

// The shape of our store encompasses the core graph and atomic mutators.
interface GraphState {
  graph: ArchitectureGraph;
  
  // Atomic Mutators
  addEntity: (entity: Entity) => void;
  updateEntity: (name: string, partialEntity: Partial<Entity>) => void;
  removeEntity: (name: string) => void;
  
  addRelation: (relation: Relation) => void;
  
  addEndpoint: (endpoint: Endpoint) => void;
  updateEndpointPath: (method: string, oldPath: string, newPath: string) => void;
  
  addEvent: (event: Event) => void;
  addWorkflow: (workflow: Workflow) => void;
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

export const useGraphStore = create<GraphState>()(
  immer((set) => ({
    graph: initialGraph,

    // O(1) Normalization allows direct assignment
    addEntity: (entity) =>
      set((state) => {
        // 1. DELEGATE TO DEV A'S FACTORY (Handles ID, Type, Metadata, Payload)
        const operation = createEntityOperation({ entity });

        // 2. CONSTRUCT CONTEXT
        const context = {
          graph: current(state.graph),
          services: {},
          validation: { validate: validateGraph }
        };

        // 3. EXECUTE
        const result = executor.execute(operation, context);

        // 4. ROLLBACK / ERROR BUBBLING
        if (!result.success) {
          const errors = result.diagnostics
            .filter(d => d.severity === "error")
            .map(d => d.message).join(" | ");
          throw new Error(errors);
        }

        // 5. COMMIT IMMUTABLE AST
        state.graph = result.graph;
      }),

    updateEntity: (name, partialEntity) =>
      set((state) => {
        const operation = updateEntityOperation({ name, partialEntity });
        const context = {
          graph: current(state.graph),
          services: {},
          validation: { validate: validateGraph }
        };
        const result = executor.execute(operation, context);

        if (!result.success) {
          const errors = result.diagnostics
            .filter(d => d.severity === "error")
            .map(d => d.message).join(" | ");
          throw new Error(errors);
        }
        state.graph = result.graph;
      }),

    removeEntity: (name) =>
      set((state) => {
        const operation = deleteEntityOperation({ name });
        const context = {
          graph: current(state.graph),
          services: {},
          validation: { validate: validateGraph }
        };
        const result = executor.execute(operation, context);

        if (!result.success) {
          const errors = result.diagnostics
            .filter(d => d.severity === "error")
            .map(d => d.message).join(" | ");
          throw new Error(errors);
        }
        state.graph = result.graph;
      }),

    addRelation: (relation) =>
      set((state) => {
        state.graph.relations.push(relation);
      }),

    addEndpoint: (endpoint) =>
      set((state) => {
        state.graph.endpoints.push(endpoint);
      }),

    updateEndpointPath: (method, oldPath, newPath) =>
      set((state) => {
        const target = state.graph.endpoints.find(
          (ep) => ep.method === method && ep.path === oldPath
        );
        if (target) target.path = newPath;
      }),

    addEvent: (event) =>
      set((state) => {
        state.graph.events[event.name] = event;
      }),

    addWorkflow: (workflow) =>
      set((state) => {
        state.graph.workflows.push(workflow);
      }),
  }))
);