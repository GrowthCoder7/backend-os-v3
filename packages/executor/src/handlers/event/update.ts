import { EventUpdateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EventUpdateHandler implements OperationHandler<EventUpdateOperation> {
  public execute(operation: EventUpdateOperation, context: ExecutionContext): ExecutionResult<EventUpdateOperation> {
    const { name, partialEvent } = operation.payload;
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

    const newName = partialEvent.name ?? name;
    if (newName !== name && context.graph.events[newName]) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: newName,
          type: "event",
          severity: "error",
          message: `Event '${newName}' already exists.`
        }],
        executedOperation: operation,
      };
    }

    const candidateEvents = { ...context.graph.events };
    if (newName !== name) delete candidateEvents[name];
    candidateEvents[newName] = { ...existing, ...partialEvent };

    const candidate = { ...context.graph, events: candidateEvents };
    
    const diagnostics = context.validation.validate(candidate);
    if (diagnostics.some(d => d.severity === "error")) {
      return { success: false, graph: context.graph, diagnostics, executedOperation: operation };
    }

    return { success: true, graph: candidate, diagnostics, executedOperation: operation };
  }
}