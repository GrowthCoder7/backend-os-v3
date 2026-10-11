import { WorkflowDeleteOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class WorkflowDeleteHandler implements OperationHandler<WorkflowDeleteOperation> {
  public execute(operation: WorkflowDeleteOperation, context: ExecutionContext): ExecutionResult<WorkflowDeleteOperation> {
    const { lookup } = operation.payload;

    const matchingIndices = context.graph.workflows
      .map((w, index) => w.triggerEvent === lookup.triggerEvent ? index : -1)
      .filter(index => index !== -1);

    if (matchingIndices.length === 0) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: lookup.triggerEvent,
          type: "workflow",
          severity: "error",
          message: `Workflow for trigger event '${lookup.triggerEvent}' not found.`
        }],
        executedOperation: operation,
      };
    }

    if (matchingIndices.length > 1) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: lookup.triggerEvent,
          type: "workflow",
          severity: "error",
          message: `Ambiguous delete: Multiple workflows found for trigger event '${lookup.triggerEvent}'.`
        }],
        executedOperation: operation,
      };
    }

    const indexToRemove = matchingIndices[0];
    const candidateWorkflows = context.graph.workflows.filter((_, i) => i !== indexToRemove);
    const candidate = { ...context.graph, workflows: candidateWorkflows };

    const diagnostics = context.validation.validate(candidate);
    if (diagnostics.some(d => d.severity === "error")) {
      return { success: false, graph: context.graph, diagnostics, executedOperation: operation };
    }

    return { success: true, graph: candidate, diagnostics, executedOperation: operation };
  }
}