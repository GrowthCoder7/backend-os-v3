import { EventDeleteOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EventDeleteHandler implements OperationHandler<EventDeleteOperation> {
  public execute(operation: EventDeleteOperation, context: ExecutionContext): ExecutionResult<EventDeleteOperation> {
    const { name } = operation.payload;
    const existing = context.graph.events[name];
    
    if (!existing) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: name,
          type: "event",
          severity: "error",
          message: `Event '${name}' not found.`
        }],
        executedOperation: operation,
      };
    }

    const candidateEvents = { ...context.graph.events };
    delete candidateEvents[name];

    const candidate = { ...context.graph, events: candidateEvents };
    
    const diagnostics = context.validation.validate(candidate);
    if (diagnostics.some(d => d.severity === "error")) {
      return { success: false, graph: context.graph, diagnostics, executedOperation: operation };
    }

    return { success: true, graph: candidate, diagnostics, executedOperation: operation };
  }
}