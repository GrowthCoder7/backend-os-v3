import { RelationUpdateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";
import { Relation } from "@repo/types";

export class RelationUpdateHandler implements OperationHandler<RelationUpdateOperation> {
  public execute(operation: RelationUpdateOperation, context: ExecutionContext): ExecutionResult<RelationUpdateOperation> {
    const { lookup, partialRelation } = operation.payload;
    const lookupId = `${lookup.source}.${lookup.sourceField}->${lookup.target}.${lookup.targetField}`;

    const matches = context.graph.relations.filter(
      r => r.source === lookup.source && r.sourceField === lookup.sourceField && 
           r.target === lookup.target && r.targetField === lookup.targetField
    );

    if (matches.length === 0) return this.fail(context, operation, lookupId, "Relation not found for update.");
    if (matches.length > 1) return this.fail(context, operation, lookupId, "Ambiguous lookup: Multiple relations match identity.");

    const existing = matches[0];
    const updated = { ...existing, ...partialRelation } as Relation;

    const collision = context.graph.relations.some(
      r => r !== existing && 
           r.source === updated.source && r.sourceField === updated.sourceField && 
           r.target === updated.target && r.targetField === updated.targetField
    );

    if (collision) {
      return this.fail(context, operation, lookupId, "Update causes identity collision with an existing relation.");
    }

    // Preserve positional array order
    const nextRelations = context.graph.relations.map(r => r === existing ? updated : r);
    const nextGraph = { ...context.graph, relations: nextRelations };
    
    const diagnostics = context.validation.validate(nextGraph);
    const hasErrors = diagnostics.some(d => d.severity === "error");

    return {
      success: !hasErrors,
      graph: hasErrors ? context.graph : nextGraph,
      diagnostics,
      executedOperation: operation
    };
  }

  private fail(context: ExecutionContext, operation: RelationUpdateOperation, nodeId: string, message: string) {
    return {
      success: false,
      graph: context.graph,
      diagnostics: [{ nodeId, type: "relation" as const, message, severity: "error" as const }],
      executedOperation: operation
    };
  }
}