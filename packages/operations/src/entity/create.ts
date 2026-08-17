import { Entity } from "@repo/types";
import {ArchitectureOperation} from "../operation"

export type CreateEntityPayload = {
  entity: Entity;
};

export type EntityCreateOperation = ArchitectureOperation<
  "entity.create",
  CreateEntityPayload
>;