import { ArchitectureGraph } from "@repo/types";
import {
  CreateEntityPayload, UpdateEntityPayload, DeleteEntityPayload,
  CreateEndpointPayload, UpdateEndpointPayload, DeleteEndpointPayload,
  CreateRelationPayload, UpdateRelationPayload, DeleteRelationPayload,
  CreateEventPayload, UpdateEventPayload, DeleteEventPayload,
  CreateWorkflowPayload, UpdateWorkflowPayload, DeleteWorkflowPayload
} from "@repo/operations";

export interface IntentRequest {
  prompt: string;
  graph: ArchitectureGraph;
}

export type IntentOperation =
  | { type: "entity.create"; payload: CreateEntityPayload }
  | { type: "entity.update"; payload: UpdateEntityPayload }
  | { type: "entity.delete"; payload: DeleteEntityPayload }
  | { type: "endpoint.create"; payload: CreateEndpointPayload }
  | { type: "endpoint.update"; payload: UpdateEndpointPayload }
  | { type: "endpoint.delete"; payload: DeleteEndpointPayload }
  | { type: "relation.create"; payload: CreateRelationPayload }
  | { type: "relation.update"; payload: UpdateRelationPayload }
  | { type: "relation.delete"; payload: DeleteRelationPayload }
  | { type: "event.create"; payload: CreateEventPayload }
  | { type: "event.update"; payload: UpdateEventPayload }
  | { type: "event.delete"; payload: DeleteEventPayload }
  | { type: "workflow.create"; payload: CreateWorkflowPayload }
  | { type: "workflow.update"; payload: UpdateWorkflowPayload }
  | { type: "workflow.delete"; payload: DeleteWorkflowPayload };

export interface IntentResponse {
  status: "success" | "needs_clarification" | "error";
  message?: string;
  operations: IntentOperation[];
}

export interface AIProvider {
  generateIntent(request: IntentRequest): Promise<IntentResponse>;
}