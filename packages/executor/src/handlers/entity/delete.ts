import { EntityDeleteOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EntityDeleteHandler implements OperationHandler<EntityDeleteOperation> {
  public execute(
    operation: EntityDeleteOperation, 
    context: ExecutionContext
  ): ExecutionResult<EntityDeleteOperation> {
    const { name } = operation.payload;
    const existingEntity = context.graph.entities[name];
    
    // 1. Existence Precondition Check
    if (!existingEntity) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: name,
          type: "entity",
          message: `Delete failed: Entity '${name}' does not exist.`,
          severity: "error"
        }],
        executedOperation: operation,
      };
    }

    // 2. Candidate Graph Construction
    const nextEntities = { ...context.graph.entities };
    delete nextEntities[name];
    
    const nextGraph = {
      ...context.graph,
      entities: nextEntities,
    };

    // 3. Validation
    const diagnostics = context.validation.validate(nextGraph);
    const hasErrors = diagnostics.some((issue) => issue.severity === "error");

    // 4. Conditional Commit
    return {
      success: !hasErrors,
      graph: hasErrors ? context.graph : nextGraph,
      diagnostics,
      executedOperation: operation,
    };
  }
}