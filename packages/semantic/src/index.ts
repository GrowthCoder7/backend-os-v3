import { ArchitectureGraph, Entity, Relation, Endpoint } from "@repo/types";
import { SemanticContext } from "./context";

export * from "./context";

export const analyzeGraph = (graph: ArchitectureGraph): SemanticContext => {
  const entityMap = new Map<string, Entity>();
  const relationsByEntity = new Map<string, Relation[]>();
  const endpointsByEntity = new Map<string, Endpoint[]>();

  // Deterministic Entity Sorting
  const entityNames = Object.keys(graph.entities).sort();
  for (const name of entityNames) {
    entityMap.set(name, graph.entities[name] as Entity);
    relationsByEntity.set(name, []);
    endpointsByEntity.set(name, []);
  }

  // Deterministic Relation Sorting
  const sortedRelations = [...graph.relations].sort((a, b) => {
    return a.source.localeCompare(b.source) ||
           a.sourceField.localeCompare(b.sourceField) ||
           a.target.localeCompare(b.target) ||
           a.targetField.localeCompare(b.targetField);
  });

  // Deterministic Endpoint Sorting
  const sortedEndpoints = [...graph.endpoints].sort((a, b) => {
    return a.method.localeCompare(b.method) ||
           a.path.localeCompare(b.path) ||
           a.entity.localeCompare(b.entity) ||
           a.action.localeCompare(b.action);
  });

  // Symmetric Relation Indexing
  for (const relation of sortedRelations) {
    if (relationsByEntity.has(relation.source)) {
      relationsByEntity.get(relation.source)!.push(relation);
    }
    if (relationsByEntity.has(relation.target) && relation.source !== relation.target) {
      relationsByEntity.get(relation.target)!.push(relation);
    }
  }

  // Endpoint Indexing
  for (const endpoint of sortedEndpoints) {
    if (endpointsByEntity.has(endpoint.entity)) {
      endpointsByEntity.get(endpoint.entity)!.push(endpoint);
    }
  }

  return {
    graph,
    entityMap,
    relationsByEntity,
    endpointsByEntity
  };
};