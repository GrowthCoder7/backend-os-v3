//packages/validation/validationEngine.ts
import { ArchitectureGraph } from "@repo/types"; // DRIFT CORRECTED: Restored @repo/types

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  nodeId: string;
  type: "entity" | "relation" | "endpoint" | "workflow" | "event";
  message: string;
  severity: ValidationSeverity;
}

/**
 * Pure function to semantically analyze the Architecture Graph.
 * Returns an array of structural issues. Does NOT mutate state.
 */
export const validateGraph = (graph: ArchitectureGraph): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  // 1. Entity Integrity Validation
  Object.values(graph.entities).forEach((entity) => {
    // Error: Missing Primary Key
    const hasPrimaryKey = entity.fields.some((f) => f.name === entity.primaryKey);
    if (!hasPrimaryKey) {
      issues.push({
        type: "entity",
        nodeId: entity.name,
        message: `Primary key '${entity.primaryKey}' is not defined in fields for entity '${entity.name}'.`,
        severity: "error"
      });
    }

    // Warning: Empty Entity (No fields other than potentially the missing PK)
    if (entity.fields.length === 0) {
      issues.push({
        type: "entity",
        nodeId: entity.name,
        message: `Entity '${entity.name}' has no fields defined. It will generate an empty table.`,
        severity: "warning"
      });
    }
  });

  // 2. Referential Integrity Validation (Relations)
  graph.relations.forEach((rel, index) => {
    const source = graph.entities[rel.source];
    const target = graph.entities[rel.target];

    // Source Checks
    if (!source) {
      issues.push({ type: "relation", nodeId: `rel-${index}`, message: `Source entity '${rel.source}' does not exist.`, severity: "error" });
    } else if (!source.fields.some((f) => f.name === rel.sourceField)) {
      issues.push({ type: "relation", nodeId: `rel-${index}`, message: `Source field '${rel.sourceField}' does not exist on entity '${rel.source}'.`, severity: "error" });
    }

    // Target Checks
    if (!target) {
      issues.push({ type: "relation", nodeId: `rel-${index}`, message: `Target entity '${rel.target}' does not exist.`, severity: "error" });
    } else if (!target.fields.some((f) => f.name === rel.targetField)) {
      issues.push({ type: "relation", nodeId: `rel-${index}`, message: `Target field '${rel.targetField}' does not exist on entity '${rel.target}'.`, severity: "error" });
    }
  });

  // 3. Endpoint Integrity Validation
  graph.endpoints.forEach((ep) => {
    if (!graph.entities[ep.entity]) {
      issues.push({
        type: "endpoint",
        nodeId: `${ep.method}-${ep.path}`,
        message: `Endpoint '${ep.method} ${ep.path}' references a missing entity '${ep.entity}'.`,
        severity: "error"
      });
    }
    if (!ep.path.startsWith('/')) {
      issues.push({
        type: "endpoint",
        nodeId: `${ep.method}-${ep.path}`,
        message: `Endpoint path '${ep.path}' must start with '/'.`,
        severity: "error"
      });
    }
  });

  // 4. Workflow Integrity Validation
  graph.workflows.forEach((wf, index) => {
    if (!graph.events[wf.triggerEvent]) {
      issues.push({
        type: "workflow",
        nodeId: `wf-${index}`,
        message: `Workflow triggered by a missing event '${wf.triggerEvent}'.`,
        severity: "error"
      });
    }
  });

  return issues;
};