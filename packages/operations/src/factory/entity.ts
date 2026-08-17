import { ArchitectureOperation } from "../operation";
import { OperationMetadata } from "../metadata";
import { CreateEntityPayload,EntityCreateOperation } from "../entity/create";
import { UpdateEntityPayload,EntityUpdateOperation } from "../entity/update";
import { DeleteEntityPayload,EntityDeleteOperation } from "../entity/delete";

const generateId = (): string => {
  return crypto.randomUUID();
};

const createDefaultMetadata = (metadata?: Partial<OperationMetadata>): OperationMetadata => ({
  timestamp: new Date().toISOString(),
  source: "builder",
  version: 1,
  ...metadata,
});

export const createEntityOperation = (
  payload: CreateEntityPayload,
  metadata?: Partial<OperationMetadata>
): EntityCreateOperation => ({
  id: generateId(),
  type: "entity.create",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const updateEntityOperation = (
  payload: UpdateEntityPayload,
  metadata?: Partial<OperationMetadata>
): EntityUpdateOperation => ({
  id: generateId(),
  type: "entity.update",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const deleteEntityOperation = (
  payload: DeleteEntityPayload,
  metadata?: Partial<OperationMetadata>
): EntityDeleteOperation => ({
  id: generateId(),
  type: "entity.delete",
  payload,
  metadata: createDefaultMetadata(metadata),
});