// packages/executor/src/registry.ts
import { ArchitectureOperation } from "@repo/operations";
import { OperationHandler } from "./handler";

export class OperationRegistry {
  private handlers: Map<string, unknown> = new Map();

  public register<TOperation extends ArchitectureOperation<string, unknown>>(
    type: TOperation["type"], 
    handler: OperationHandler<TOperation>
  ): void {
    if (this.handlers.has(type)) {
      throw new Error(`[Registry Error] Handler for operation type '${type}' is already registered.`);
    }
    this.handlers.set(type, handler);
  }

  public getHandler<TOperation extends ArchitectureOperation<string, unknown>>(
    type: string
  ): OperationHandler<TOperation> | undefined {
    return this.handlers.get(type) as OperationHandler<TOperation> | undefined;
  }
}