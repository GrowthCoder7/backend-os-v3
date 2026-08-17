import { 
  ArchitectureGraph, 
  BackendIR, 
  CompiledModel, 
  CompiledRoute, 
  CompiledWorkflow 
} from "@repo/types";
import { validateGraph, ValidationIssue } from "@repo/validation";

export interface CompilationResult {
  success: boolean;
  issues: ValidationIssue[];
  ir: BackendIR | null;
}

/**
 * Lowers the Architecture Graph into the standard Backend IR.
 * Halts if structural errors are detected by the Validation Engine.
 */
export const compileGraph = (graph: ArchitectureGraph): CompilationResult => {
  // 1. Pre-flight Validation
  const issues = validateGraph(graph);
  const fatalErrors = issues.filter((issue) => issue.severity === "error");

  // 2. Compilation Halt Check
  if (fatalErrors.length > 0) {
    return {
      success: false,
      issues,
      ir: null,
    };
  }

  // 3. Generate Backend Intermediate Representation (IR)
  const ir: BackendIR = {
    database: {
      models: Object.values(graph.entities).map((entity) => ({
        tableName: entity.name.toLowerCase(),
        primaryKey: entity.primaryKey,
        fields: [...entity.fields],
        relations: graph.relations.filter(
          (r) => r.source === entity.name || r.target === entity.name
        ),
      })),
    },
    
    apis: {
      routes: graph.endpoints.map((ep) => ({
        method: ep.method.toUpperCase(),
        path: ep.path,
        handlerId: `${ep.method.toLowerCase()}_${ep.entity.toLowerCase()}`,
        entity: ep.entity,
        action: ep.action,
      })),
    },

    workflows: {
      workflows: graph.workflows.map((wf) => ({
        triggerEvent: wf.triggerEvent,
        executionSteps: wf.steps.length,
        steps: [...wf.steps],
      })),
    },

    events: { ...graph.events },
    
    metadata: {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
    },
  };

  return {
    success: true,
    issues, // Pass along any warnings
    ir,
  };
};