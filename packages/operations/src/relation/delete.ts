import { ArchitectureOperation } from "../operation";

export type DeleteRelationPayload = {
  lookup: {
    source: string;
    sourceField: string;
    target: string;
    targetField: string;
  };
};

export type RelationDeleteOperation = ArchitectureOperation<
  "relation.delete",
  DeleteRelationPayload
>;