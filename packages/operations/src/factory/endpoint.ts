import { OperationMetadata } from "../metadata";
import { CreateEndpointPayload, EndpointCreateOperation } from "../endpoint/create";
import { UpdateEndpointPayload, EndpointUpdateOperation } from "../endpoint/update";
import { DeleteEndpointPayload, EndpointDeleteOperation } from "../endpoint/delete";

const generateId = (): string => {
  return crypto.randomUUID();
};

const createDefaultMetadata = (metadata?: Partial<OperationMetadata>): OperationMetadata => ({
  timestamp: new Date().toISOString(),
  source: "builder",
  version: 1,
  ...metadata,
});

export const createEndpointOperation = (
  payload: CreateEndpointPayload,
  metadata?: Partial<OperationMetadata>
): EndpointCreateOperation => ({
  id: generateId(),
  type: "endpoint.create",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const updateEndpointOperation = (
  payload: UpdateEndpointPayload,
  metadata?: Partial<OperationMetadata>
): EndpointUpdateOperation => ({
  id: generateId(),
  type: "endpoint.update",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const deleteEndpointOperation = (
  payload: DeleteEndpointPayload,
  metadata?: Partial<OperationMetadata>
): EndpointDeleteOperation => ({
  id: generateId(),
  type: "endpoint.delete",
  payload,
  metadata: createDefaultMetadata(metadata),
});