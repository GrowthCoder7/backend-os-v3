import { Relation } from "@repo/types";
import { ArchitectureOperation } from "../operation";

export type UpdateRelationPayload = {
  lookup: {
    source: string;
    sourceField: string;
    target: string;
    targetField: string;
  };
  partialRelation: Partial<Relation>;
};

export type RelationUpdateOperation = ArchitectureOperation<
  "relation.update",
  UpdateRelationPayload
>;