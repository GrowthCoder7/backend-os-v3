import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";
import { WorkflowCreateOperation } from "@repo/operations";

export class WorkflowCreateHandler implements OperationHandler<WorkflowCreateOperation> {
  execute(operation: WorkflowCreateOperation, context: ExecutionContext): ExecutionResult<WorkflowCreateOperation> {
    const { workflow } = operation.payload;

    const exists = context.graph.workflows.some(w => w.triggerEvent === workflow.triggerEvent);
    if (exists) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: workflow.triggerEvent,
          type: "workflow",
          severity: "error", 
          message: `Workflow for trigger event '${workflow.triggerEvent}' already exists.` 
        }],
        executedOperation: operation,
      };
    }

    const candidate = {
      ...context.graph,
      workflows: [...context.graph.workflows, workflow]
    };

    const diagnostics = context.validation.validate(candidate);
    if (diagnostics.some(d => d.severity === "error")) {
      return { success: false, graph: context.graph, diagnostics, executedOperation: operation };
    }

    return { success: true, graph: candidate, diagnostics, executedOperation: operation };
  }
}