import { OperationMetadata } from "../metadata";
import { CreateEventPayload, EventCreateOperation } from "../event/create";
import { UpdateEventPayload, EventUpdateOperation } from "../event/update";
import { DeleteEventPayload, EventDeleteOperation } from "../event/delete";

const generateId = (): string => crypto.randomUUID();
const createDefaultMetadata = (metadata?: Partial<OperationMetadata>): OperationMetadata => ({
  timestamp: new Date().toISOString(),
  source: "builder",
  version: 1,
  ...metadata,
});

export const createEventOperation = (payload: CreateEventPayload, metadata?: Partial<OperationMetadata>): EventCreateOperation => ({
  id: generateId(),
  type: "event.create",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const updateEventOperation = (payload: UpdateEventPayload, metadata?: Partial<OperationMetadata>): EventUpdateOperation => ({
  id: generateId(),
  type: "event.update",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const deleteEventOperation = (payload: DeleteEventPayload, metadata?: Partial<OperationMetadata>): EventDeleteOperation => ({
  id: generateId(),
  type: "event.delete",
  payload,
  metadata: createDefaultMetadata(metadata),
});