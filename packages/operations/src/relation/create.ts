import { Relation } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type CreateRelationPayload = {
  relation: Relation;
};

export type RelationCreateOperation = ArchitectureOperation<
  "relation.create",
  CreateRelationPayload
>;