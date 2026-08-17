import { EndpointCreateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EndpointCreateHandler implements OperationHandler<EndpointCreateOperation> {
  public execute(operation: EndpointCreateOperation, context: ExecutionContext): ExecutionResult<EndpointCreateOperation> {
    const { endpoint } = operation.payload;
    const nodeId = `[${endpoint.method}] ${endpoint.path}`;

    const exists = context.graph.endpoints.some(
      ep => ep.method === endpoint.method && ep.path === endpoint.path
    );

    if (exists) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{ nodeId, type: "endpoint", message: "Endpoint identity already exists.", severity: "error" }],
        executedOperation: operation
      };
    }

    const nextGraph = { ...context.graph, endpoints: [...context.graph.endpoints, endpoint] };
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