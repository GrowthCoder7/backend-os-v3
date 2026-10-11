import { Event } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type UpdateEventPayload = { name: string; partialEvent: Partial<Event> };
export type EventUpdateOperation = ArchitectureOperation<"event.update", UpdateEventPayload>;