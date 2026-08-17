import { OperationRegistry } from "./registry";
import { ExecutionContext } from "./context";
import { ExecutionResult } from "./result";
import { BaseOperation } from "./handler";
import { ValidationIssue } from "@repo/validation";
import {ArchitectureOperation} from "@repo/operations"

export class OperationExecutor {
  constructor(private registry: OperationRegistry) {}

  public execute<TOperation extends ArchitectureOperation<string,unknown>>(
    operation: TOperation, 
    context: ExecutionContext
  ): ExecutionResult<TOperation> {
    const handler = this.registry.getHandler<TOperation>(operation.type);
    
    if (!handler) {
      throw new Error(`Execution halted: No handler registered for operation type '${operation.type}'`);
    }

    return handler.execute(operation, context);
  }
}