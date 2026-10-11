import { EventCreateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EventCreateHandler implements OperationHandler<EventCreateOperation> {
  public execute(operation: EventCreateOperation, context: ExecutionContext): ExecutionResult<EventCreateOperation> {
    const { event } = operation.payload;
    
    if (context.graph.events[event.name]) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{ nodeId: event.name, type: "event", message: `Event '${event.name}' already exists.`, severity: "error" }],
        executedOperation: operation
      };
    }

    const nextGraph = {
      ...context.graph,
      events: {
        ...context.graph.events,
        [event.name]: event,
      },
    };

    const diagnostics = context.validation.validate(nextGraph);
    const hasErrors = diagnostics.some((issue) => issue.severity === "error");

    return {
      success: !hasErrors,
      graph: hasErrors ? context.graph : nextGraph,
      diagnostics,
      executedOperation: operation,
    };
  }
}