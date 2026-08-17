import { OperationMetadata } from "../metadata";
import { CreateRelationPayload, RelationCreateOperation } from "../relation/create";
import { UpdateRelationPayload, RelationUpdateOperation } from "../relation/update";
import { DeleteRelationPayload, RelationDeleteOperation } from "../relation/delete";

const generateId = (): string => {
  return crypto.randomUUID();
};

const createDefaultMetadata = (metadata?: Partial<OperationMetadata>): OperationMetadata => ({
  timestamp: new Date().toISOString(),
  source: "builder",
  version: 1,
  ...metadata,
});

export const createRelationOperation = (
  payload: CreateRelationPayload,
  metadata?: Partial<OperationMetadata>
): RelationCreateOperation => ({
  id: generateId(),
  type: "relation.create",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const updateRelationOperation = (
  payload: UpdateRelationPayload,
  metadata?: Partial<OperationMetadata>
): RelationUpdateOperation => ({
  id: generateId(),
  type: "relation.update",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const deleteRelationOperation = (
  payload: DeleteRelationPayload,
  metadata?: Partial<OperationMetadata>
): RelationDeleteOperation => ({
  id: generateId(),
  type: "relation.delete",
  payload,
  metadata: createDefaultMetadata(metadata),
});