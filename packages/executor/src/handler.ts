import { ExecutionContext } from "./context";
import { ExecutionResult } from "./result";
import { ArchitectureOperation } from "@repo/operations";

export interface BaseOperation {
  type: string;
  payload: unknown;
}

export interface OperationHandler<TOperation extends ArchitectureOperation<string,unknown>> {
  execute(operation: TOperation, context: ExecutionContext): ExecutionResult<TOperation>;
}