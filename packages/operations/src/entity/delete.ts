import { ArchitectureOperation } from "../operation";

export type DeleteEntityPayload = {
  name: string;
};

export type EntityDeleteOperation = ArchitectureOperation<
  "entity.delete",
  DeleteEntityPayload
>;