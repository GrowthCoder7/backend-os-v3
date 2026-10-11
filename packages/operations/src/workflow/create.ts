import { Workflow } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type CreateWorkflowPayload = { workflow: Workflow };
export type WorkflowCreateOperation = ArchitectureOperation<"workflow.create", CreateWorkflowPayload>;