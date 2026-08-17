import { EndpointUpdateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";
import { Endpoint } from "@repo/types";

export class EndpointUpdateHandler implements OperationHandler<EndpointUpdateOperation> {
  public execute(operation: EndpointUpdateOperation, context: ExecutionContext): ExecutionResult<EndpointUpdateOperation> {
    const { lookup, partialEndpoint } = operation.payload;
    const lookupId = `[${lookup.method}] ${lookup.path}`;

    const matches = context.graph.endpoints.filter(
      ep => ep.method === lookup.method && ep.path === lookup.path
    );

    if (matches.length === 0) return this.fail(context, operation, lookupId, "Endpoint not found for update.");
    if (matches.length > 1) return this.fail(context, operation, lookupId, "Ambiguous lookup: Multiple endpoints match identity.");

    const existing = matches[0];
    const updated = { ...existing, ...partialEndpoint } as Endpoint;

    const collision = context.graph.endpoints.some(
      ep => ep !== existing && ep.method === updated.method && ep.path === updated.path
    );

    if (collision) {
      return this.fail(context, operation, lookupId, "Update causes identity collision with an existing endpoint.");
    }

    // Preserve positional array order
    const nextEndpoints = context.graph.endpoints.map(ep => ep === existing ? updated : ep);
    const nextGraph = { ...context.graph, endpoints: nextEndpoints };
    
    const diagnostics = context.validation.validate(nextGraph);
    const hasErrors = diagnostics.some(d => d.severity === "error");

    return {
      success: !hasErrors,
      graph: hasErrors ? context.graph : nextGraph,
      diagnostics,
      executedOperation: operation
    };
  }

  private fail(context: ExecutionContext, operation: EndpointUpdateOperation, nodeId: string, message: string) {
    return {
      success: false,
      graph: context.graph,
      diagnostics: [{ nodeId, type: "endpoint" as const, message, severity: "error" as const }],
      executedOperation: operation
    };
  }
}