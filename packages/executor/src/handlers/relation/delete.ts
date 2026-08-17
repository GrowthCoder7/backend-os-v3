import { RelationDeleteOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class RelationDeleteHandler implements OperationHandler<RelationDeleteOperation> {
  public execute(operation: RelationDeleteOperation, context: ExecutionContext): ExecutionResult<RelationDeleteOperation> {
    const { lookup } = operation.payload;
    const lookupId = `${lookup.source}.${lookup.sourceField}->${lookup.target}.${lookup.targetField}`;

    const matches = context.graph.relations.filter(
      r => r.source === lookup.source && r.sourceField === lookup.sourceField && 
           r.target === lookup.target && r.targetField === lookup.targetField
    );

    if (matches.length === 0) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{ nodeId: lookupId, type: "relation", message: "Relation not found for deletion.", severity: "error" }],
        executedOperation: operation
      };
    }
    if (matches.length > 1) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{ nodeId: lookupId, type: "relation", message: "Ambiguous lookup: Multiple relations match identity.", severity: "error" }],
        executedOperation: operation
      };
    }

    const existing = matches[0];
    const nextGraph = { ...context.graph, relations: context.graph.relations.filter(r => r !== existing) };
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