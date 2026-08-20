import { z } from "zod";

// Validates the raw JSON output to ensure structural safety before casting to IntentResponse
const FieldSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "datetime", "relation", "json", "enum"]),
  required: z.boolean()
});

const EntitySchema = z.object({
  name: z.string(),
  primaryKey: z.string(),
  fields: z.array(FieldSchema)
});

const EndpointSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  path: z.string(),
  entity: z.string(),
  action: z.enum(["create", "read", "update", "delete"])
});

const RelationSchema = z.object({
  source: z.string(),
  sourceField: z.string(),
  target: z.string(),
  targetField: z.string(),
  type: z.enum(["one-to-one", "one-to-many", "many-to-one", "many-to-many"])
});

export const IntentResponseSchema = z.object({
  status: z.enum(["success", "needs_clarification", "error"]),
  message: z.string().optional(),
  operations: z.array(z.object({
    type: z.string(),
    payload: z.any()
  }))
});