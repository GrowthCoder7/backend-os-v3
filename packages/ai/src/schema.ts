import { z } from "zod";

// Exact FieldType mapping from @repo/types
export const FieldTypeEnum = z.enum([
  "string",
  "number",
  "boolean",
  "datetime",
  "relation",
  "json",
  "enum",
]);

// Exact HttpMethod mapping from @repo/types
export const HttpMethodEnum = z.enum(["GET", "POST", "PUT", "DELETE"]);

// Exact EndpointAction mapping from @repo/types
export const EndpointActionEnum = z.enum(["create", "read", "update", "delete"]);

// Exact RelationType mapping from @repo/types
export const RelationTypeEnum = z.enum([
  "one-to-one",
  "one-to-many",
  "many-to-one",
  "many-to-many",
]);

export const FieldSchema = z
  .object({
    name: z.string().min(1),
    type: FieldTypeEnum,
    required: z.boolean(),
  })
  .strict();

export const EntitySchema = z
  .object({
    name: z.string().min(1),
    primaryKey: z.string().min(1),
    fields: z.array(FieldSchema),
  })
  .strict();

export const PartialEntitySchema = z
  .object({
    name: z.string().min(1).optional(),
    primaryKey: z.string().min(1).optional(),
    fields: z.array(FieldSchema).optional(),
  })
  .strict();

export const EndpointSchema = z
  .object({
    method: HttpMethodEnum,
    path: z.string().min(1),
    entity: z.string().min(1),
    action: EndpointActionEnum,
  })
  .strict();

export const PartialEndpointSchema = z
  .object({
    method: HttpMethodEnum.optional(),
    path: z.string().min(1).optional(),
    entity: z.string().min(1).optional(),
    action: EndpointActionEnum.optional(),
  })
  .strict();

export const RelationSchema = z
  .object({
    source: z.string().min(1),
    sourceField: z.string().min(1),
    target: z.string().min(1),
    targetField: z.string().min(1),
    type: RelationTypeEnum,
  })
  .strict();

export const PartialRelationSchema = z
  .object({
    source: z.string().min(1).optional(),
    sourceField: z.string().min(1).optional(),
    target: z.string().min(1).optional(),
    targetField: z.string().min(1).optional(),
    type: RelationTypeEnum.optional(),
  })
  .strict();

// 9 Discriminator Schemas mirroring @repo/operations payloads exactly
export const EntityCreateIntentSchema = z
  .object({
    type: z.literal("entity.create"),
    payload: z.object({ entity: EntitySchema }).strict(),
  })
  .strict();

export const EntityUpdateIntentSchema = z
  .object({
    type: z.literal("entity.update"),
    payload: z
      .object({
        name: z.string().min(1),
        partialEntity: PartialEntitySchema,
      })
      .strict(),
  })
  .strict();

export const EntityDeleteIntentSchema = z
  .object({
    type: z.literal("entity.delete"),
    payload: z.object({ name: z.string().min(1) }).strict(),
  })
  .strict();

export const EndpointCreateIntentSchema = z
  .object({
    type: z.literal("endpoint.create"),
    payload: z.object({ endpoint: EndpointSchema }).strict(),
  })
  .strict();

export const EndpointUpdateIntentSchema = z
  .object({
    type: z.literal("endpoint.update"),
    payload: z
      .object({
        lookup: z
          .object({
            method: HttpMethodEnum,
            path: z.string().min(1),
          })
          .strict(),
        partialEndpoint: PartialEndpointSchema,
      })
      .strict(),
  })
  .strict();

export const EndpointDeleteIntentSchema = z
  .object({
    type: z.literal("endpoint.delete"),
    payload: z
      .object({
        lookup: z
          .object({
            method: HttpMethodEnum,
            path: z.string().min(1),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const RelationCreateIntentSchema = z
  .object({
    type: z.literal("relation.create"),
    payload: z.object({ relation: RelationSchema }).strict(),
  })
  .strict();

export const RelationUpdateIntentSchema = z
  .object({
    type: z.literal("relation.update"),
    payload: z
      .object({
        lookup: z
          .object({
            source: z.string().min(1),
            sourceField: z.string().min(1),
            target: z.string().min(1),
            targetField: z.string().min(1),
          })
          .strict(),
        partialRelation: PartialRelationSchema,
      })
      .strict(),
  })
  .strict();

export const RelationDeleteIntentSchema = z
  .object({
    type: z.literal("relation.delete"),
    payload: z
      .object({
        lookup: z
          .object({
            source: z.string().min(1),
            sourceField: z.string().min(1),
            target: z.string().min(1),
            targetField: z.string().min(1),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const IntentOperationSchema = z.discriminatedUnion("type", [
  EntityCreateIntentSchema,
  EntityUpdateIntentSchema,
  EntityDeleteIntentSchema,
  EndpointCreateIntentSchema,
  EndpointUpdateIntentSchema,
  EndpointDeleteIntentSchema,
  RelationCreateIntentSchema,
  RelationUpdateIntentSchema,
  RelationDeleteIntentSchema,
]);

export const IntentResponseSchema = z
  .object({
    status: z.enum(["success", "needs_clarification", "error"]),
    message: z.string().optional(),
    operations: z.array(IntentOperationSchema),
  })
  .strict();