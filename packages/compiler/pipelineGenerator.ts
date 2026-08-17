import { ArchitectureGraph, BackendIR } from "@repo/types";
import { validateGraph, ValidationIssue } from "@repo/validation";
import { analyzeGraph } from "@repo/semantic";

export interface CompilationResult {
  success: boolean;
  issues: ValidationIssue[];
  ir: BackendIR | null;
}

export const compileGraph = (graph: ArchitectureGraph): CompilationResult => {
  const issues = validateGraph(graph);
  const fatalErrors = issues.filter((issue) => issue.severity === "error");

  if (fatalErrors.length > 0) {
    return {
      success: false,
      issues,
      ir: null,
    };
  }

  const semanticContext = analyzeGraph(graph);

  const ir: BackendIR = {
    database: {
      models: Array.from(semanticContext.entityMap.values()).map((entity) => ({
        tableName: entity.name.toLowerCase(),
        primaryKey: entity.primaryKey,
        fields: [...entity.fields],
        relations: semanticContext.relationsByEntity.get(entity.name) || [],
      })),
    },
    apis: {
      routes: Array.from(semanticContext.endpointsByEntity.values()).flat().map((ep) => ({
        method: ep.method.toUpperCase(),
        path: ep.path,
        handlerId: `${ep.method.toLowerCase()}_${ep.entity.toLowerCase()}`,
        entity: ep.entity,
        action: ep.action,
      })),
    },
    workflows: {
      workflows: semanticContext.graph.workflows.map((wf) => ({
        triggerEvent: wf.triggerEvent,
        executionSteps: wf.steps.length,
        steps: [...wf.steps],
      })),
    },
    events: { ...semanticContext.graph.events },
    metadata: {
      version: "1.0.0",
      generatedAt: semanticContext.graph.metadata.updatedAt,
    },
  };

  return {
    success: true,
    issues, 
    ir,
  };
};