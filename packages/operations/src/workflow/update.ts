import { Workflow } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type UpdateWorkflowPayload = { lookup: { triggerEvent: string }; partialWorkflow: Partial<Workflow> };
export type WorkflowUpdateOperation = ArchitectureOperation<"workflow.update", UpdateWorkflowPayload>;