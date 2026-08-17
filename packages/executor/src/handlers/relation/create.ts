import { RelationCreateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class RelationCreateHandler implements OperationHandler<RelationCreateOperation> {
  public execute(operation: RelationCreateOperation, context: ExecutionContext): ExecutionResult<RelationCreateOperation> {
    const { relation } = operation.payload;
    const { source, sourceField, target, targetField } = relation;
    const nodeId = `${source}.${sourceField}->${target}.${targetField}`;

    const exists = context.graph.relations.some(
      r => r.source === source && r.sourceField === sourceField && 
           r.target === target && r.targetField === targetField
    );

    if (exists) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{ nodeId, type: "relation", message: `Relation identity already exists.`, severity: "error" }],
        executedOperation: operation
      };
    }

    const nextGraph = { ...context.graph, relations: [...context.graph.relations, relation] };
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