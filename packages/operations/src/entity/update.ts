import { Entity } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type UpdateEntityPayload = {
  name: string;
  partialEntity: Partial<Entity>;
};

export type EntityUpdateOperation = ArchitectureOperation<
  "entity.update",
  UpdateEntityPayload
>;