import { OperationMetadata } from "../metadata";
import { CreateWorkflowPayload, WorkflowCreateOperation } from "../workflow/create";
import { UpdateWorkflowPayload, WorkflowUpdateOperation } from "../workflow/update";
import { DeleteWorkflowPayload, WorkflowDeleteOperation } from "../workflow/delete";

const generateId = (): string => crypto.randomUUID();
const createDefaultMetadata = (metadata?: Partial<OperationMetadata>): OperationMetadata => ({
  timestamp: new Date().toISOString(),
  source: "builder",
  version: 1,
  ...metadata,
});

export const createWorkflowOperation = (payload: CreateWorkflowPayload, metadata?: Partial<OperationMetadata>): WorkflowCreateOperation => ({
  id: generateId(),
  type: "workflow.create",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const updateWorkflowOperation = (payload: UpdateWorkflowPayload, metadata?: Partial<OperationMetadata>): WorkflowUpdateOperation => ({
  id: generateId(),
  type: "workflow.update",
  payload,
  metadata: createDefaultMetadata(metadata),
});

export const deleteWorkflowOperation = (payload: DeleteWorkflowPayload, metadata?: Partial<OperationMetadata>): WorkflowDeleteOperation => ({
  id: generateId(),
  type: "workflow.delete",
  payload,
  metadata: createDefaultMetadata(metadata),
});