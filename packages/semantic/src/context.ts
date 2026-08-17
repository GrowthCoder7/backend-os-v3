import { ArchitectureGraph, Entity, Relation, Endpoint } from "@repo/types";

export interface SemanticContext {
  graph: ArchitectureGraph;
  entityMap: Map<string, Entity>;
  relationsByEntity: Map<string, Relation[]>;
  endpointsByEntity: Map<string, Endpoint[]>;
}