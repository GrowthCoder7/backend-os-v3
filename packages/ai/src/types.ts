import {
  CreateEntityPayload, UpdateEntityPayload, DeleteEntityPayload,
  CreateEndpointPayload, UpdateEndpointPayload, DeleteEndpointPayload,
  CreateRelationPayload, UpdateRelationPayload, DeleteRelationPayload
} from "@repo/operations";

export interface IntentRequest {
  prompt: string;
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
  | { type: "relation.delete"; payload: DeleteRelationPayload };

export interface IntentResponse {
  status: "success" | "needs_clarification" | "error";
  message?: string;
  operations: IntentOperation[];
}

export interface AIProvider {
  generateIntent(request: IntentRequest): Promise<IntentResponse>;
}