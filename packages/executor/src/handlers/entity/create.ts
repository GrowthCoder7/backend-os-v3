// packages/executor/src/handlers/entity/create.ts
import { EntityCreateOperation } from "@repo/operations";
import { OperationHandler } from "../../handler";
import { ExecutionContext } from "../../context";
import { ExecutionResult } from "../../result";

export class EntityCreateHandler implements OperationHandler<EntityCreateOperation> {
  public execute(
    operation: EntityCreateOperation, 
    context: ExecutionContext
  ): ExecutionResult<EntityCreateOperation> {
    const { entity } = operation.payload;
    
    if (context.graph.entities[entity.name]) {
      throw new Error(`Entity '${entity.name}' already exists.`);
    }
    
    const nextGraph = {
      ...context.graph,
      entities: {
        ...context.graph.entities,
        [entity.name]: entity,
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