import { ArchitectureOperation } from "../operation";

export type DeleteWorkflowPayload = { lookup: { triggerEvent: string } };
export type WorkflowDeleteOperation = ArchitectureOperation<"workflow.delete", DeleteWorkflowPayload>;