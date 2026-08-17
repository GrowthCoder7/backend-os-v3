import { OperationMetadata } from "./metadata";

export interface ArchitectureOperation<TType extends string, TPayload> {
  id: string;
  type: TType;
  payload: TPayload;
  metadata: OperationMetadata;
}