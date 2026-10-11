import { ArchitectureOperation } from "../operation";

export type DeleteEventPayload = { name: string };
export type EventDeleteOperation = ArchitectureOperation<"event.delete", DeleteEventPayload>;