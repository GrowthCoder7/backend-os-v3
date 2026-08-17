import { ArchitectureGraph } from "@repo/types";
import { ValidationIssue } from "@repo/validation";
import {ArchitectureOperation} from "@repo/operations"

export interface ExecutionResult<TOperation extends ArchitectureOperation<string,unknown>> {
  success: boolean;
  graph: ArchitectureGraph;
  diagnostics: ValidationIssue[];
  executedOperation: TOperation;
}