import { WorkflowUpdateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";
import { Workflow } from "@repo/types";

export class WorkflowUpdateHandler implements OperationHandler<WorkflowUpdateOperation> {
  public execute(operation: WorkflowUpdateOperation, context: ExecutionContext): ExecutionResult<WorkflowUpdateOperation> {
    const { lookup, partialWorkflow } = operation.payload;

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
          message: `Ambiguous update: Multiple workflows found for trigger event '${lookup.triggerEvent}'.`
        }],
        executedOperation: operation,
      };
    }

    const index = matchingIndices[0]!;
    const existingWorkflow = context.graph.workflows[index]!;

    const newTrigger = partialWorkflow.triggerEvent ?? lookup.triggerEvent;
    if (newTrigger !== lookup.triggerEvent && context.graph.workflows.some(w => w.triggerEvent === newTrigger)) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: newTrigger,
          type: "workflow",
          severity: "error",
          message: `Cannot change trigger event to '${newTrigger}'. Workflow already exists.`
        }],
        executedOperation: operation,
      };
    }

    const updatedWorkflow: Workflow = {
      ...existingWorkflow,
      ...partialWorkflow,
      triggerEvent: newTrigger,
      steps: partialWorkflow.steps ?? existingWorkflow.steps,
    };

    const candidateWorkflows = [...context.graph.workflows];
    candidateWorkflows[index] = updatedWorkflow;

    const candidate = { ...context.graph, workflows: candidateWorkflows };

    const diagnostics = context.validation.validate(candidate);
    if (diagnostics.some(d => d.severity === "error")) {
      return { success: false, graph: context.graph, diagnostics, executedOperation: operation };
    }

    return { success: true, graph: candidate, diagnostics, executedOperation: operation };
  }
}