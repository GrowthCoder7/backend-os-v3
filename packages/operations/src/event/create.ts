import { Event } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type CreateEventPayload = { event: Event };
export type EventCreateOperation = ArchitectureOperation<"event.create", CreateEventPayload>;