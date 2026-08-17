import { EntityUpdateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EntityUpdateHandler implements OperationHandler<EntityUpdateOperation> {
  public execute(
    operation: EntityUpdateOperation, 
    context: ExecutionContext
  ): ExecutionResult<EntityUpdateOperation> {
    const { name, partialEntity } = operation.payload;
    const existingEntity = context.graph.entities[name];
    
    // 1. Existence Precondition Check
    if (!existingEntity) {
      return {
        success: false,
        graph: context.graph,
        diagnostics: [{
          nodeId: name,
          type: "entity",
          message: `Update failed: Entity '${name}' does not exist.`,
          severity: "error"
        }],
        executedOperation: operation,
      };
    }

    // 2. Immutability & Constraint Enforcement (No Rename)
    const updatedEntity = { 
      ...existingEntity, 
      ...partialEntity, 
      name // Explicitly overwrite to prevent rename via partialEntity
    };
    
    const nextGraph = {
      ...context.graph,
      entities: {
        ...context.graph.entities,
        [name]: updatedEntity,
      },
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