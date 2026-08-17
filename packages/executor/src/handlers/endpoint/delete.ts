import { EndpointDeleteOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EndpointDeleteHandler implements OperationHandler<EndpointDeleteOperation> {
  public execute(operation: EndpointDeleteOperation, context: ExecutionContext): ExecutionResult<EndpointDeleteOperation> {
    const { lookup } = operation.payload;
    const lookupId = `[${lookup.method}] ${lookup.path}`;

    const matches = context.graph.endpoints.filter(
      ep => ep.method === lookup.method && ep.path === lookup.path
    );

    if (matches.length === 0) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{ nodeId: lookupId, type: "endpoint", message: "Endpoint not found for deletion.", severity: "error" }],
        executedOperation: operation
      };
    }
    if (matches.length > 1) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{ nodeId: lookupId, type: "endpoint", message: "Ambiguous lookup: Multiple endpoints match.", severity: "error" }],
        executedOperation: operation
      };
    }

    const existing = matches[0];
    const nextGraph = { ...context.graph, endpoints: context.graph.endpoints.filter(ep => ep !== existing) };
    const diagnostics = context.validation.validate(nextGraph);
    const hasErrors = diagnostics.some(d => d.severity === "error");

    return {
      success: !hasErrors,
      graph: hasErrors ? context.graph : nextGraph,
      diagnostics,
      executedOperation: operation
    };
  }
}