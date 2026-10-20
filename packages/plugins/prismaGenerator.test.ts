import { describe, expect, it } from "vitest";
import { CompiledModel, DatabaseIR, Field, Relation } from "@repo/types";
import { generatePrismaSchema } from "./prismaGenerator";

const field = (name: string, type: Field["type"], required = true): Field => ({ name, type, required });
const model = (
  tableName: string,
  fields: Field[],
  relations: Relation[] = [],
  primaryKey = "id",
): CompiledModel => ({ tableName, primaryKey, fields, relations });
const database = (...models: CompiledModel[]): DatabaseIR => ({ models });

const userToPost: Relation = {
  source: "UserProfile",
  sourceField: "id",
  target: "Post",
  targetField: "authorId",
  type: "one-to-many",
};

const validUserPostDatabase = (): DatabaseIR => database(
  model("UserProfile", [field("id", "string"), field("email", "string", false)], [userToPost]),
  model("Post", [field("id", "number"), field("authorId", "string", false), field("title", "string")], [userToPost]),
);

describe("Prisma schema generator", () => {
  it("generates models, scalar fields, and primary-key annotations", () => {
    const schema = generatePrismaSchema(database(
      model("User", [field("email", "string"), field("id", "string")]),
    ));

    expect(schema).toContain("model User {");
    expect(schema).toContain("  email String");
    expect(schema).toContain("  id String @id @default(uuid())");
  });

  it("generates an explicit one-to-many relation and deduplicates duplicate declarations", () => {
    const schema = generatePrismaSchema(validUserPostDatabase());
    expect(schema).toContain('postList Post[] @relation("Rel_UserProfile_Post_authorId")');
    expect(schema).toContain('userProfileRef UserProfile? @relation("Rel_UserProfile_Post_authorId", fields: [authorId], references: [id])');
    expect(schema.match(/postList Post\[\]/g)?.length).toBe(1);
    expect(schema.match(/userProfileRef UserProfile\?/g)?.length).toBe(1);
  });

  it("produces byte-for-byte identical output when model and relation declaration order changes", () => {
    const relationA: Relation = {
      source: "A",
      sourceField: "id",
      target: "B",
      targetField: "aId",
      type: "one-to-many",
    };
    const relationB: Relation = {
      source: "A",
      sourceField: "id",
      target: "C",
      targetField: "aId",
      type: "one-to-many",
    };

    const a1 = model("A", [field("id", "string"), field("name", "string")], [relationA, relationB]);
    const b1 = model("B", [field("aId", "string"), field("id", "string")], [relationA]);
    const c1 = model("C", [field("aId", "string"), field("id", "string")], [relationB]);

    const a2 = model("A", [field("name", "string"), field("id", "string")], [relationB, relationA]);
    const b2 = model("B", [field("id", "string"), field("aId", "string")], [relationA]);
    const c2 = model("C", [field("id", "string"), field("aId", "string")], [relationB]);

    expect(generatePrismaSchema(database(a1, b1, c1))).toBe(generatePrismaSchema(database(c2, a2, b2)));
  });

  it("normalizes relation endpoint casing to the canonical model names", () => {
    const relation: Relation = {
      source: "userprofile",
      sourceField: "id",
      target: "post",
      targetField: "authorId",
      type: "one-to-many",
    };
    const schema = generatePrismaSchema(database(
      model("UserProfile", [field("id", "string")], [relation]),
      model("Post", [field("id", "string"), field("authorId", "string")], [relation]),
    ));
    expect(schema).toContain('postList Post[] @relation("Rel_UserProfile_Post_authorId")');
  });

  it("rejects conflicting relation types for identical endpoints", () => {
    const conflict: Relation = { ...userToPost, type: "many-to-many" };
    expect(() => generatePrismaSchema(database(
      model("UserProfile", [field("id", "string")], [userToPost]),
      model("Post", [field("id", "string"), field("authorId", "string")], [conflict]),
    ))).toThrow(/Conflicting relation types/);
  });

  it("rejects unsupported relation types", () => {
    const relation: Relation = { ...userToPost, type: "many-to-many" };
    expect(() => generatePrismaSchema(database(
      model("UserProfile", [field("id", "string")], [relation]),
      model("Post", [field("id", "string"), field("authorId", "string")]),
    ))).toThrow(/Unsupported relation type/);
  });

  it("rejects a model with no declared primary-key field", () => {
    expect(() => generatePrismaSchema(database(
      model("User", [field("email", "string")], [], "id"),
    ))).toThrow(/Primary key 'id'.*does not exist/);
  });

  it("rejects unsupported primary-key types", () => {
    expect(() => generatePrismaSchema(database(
      model("User", [field("id", "boolean")]),
    ))).toThrow(/must be string or number/);
  });

  it("rejects duplicate field names", () => {
    expect(() => generatePrismaSchema(database(
      model("User", [field("id", "string"), field("id", "string")]),
    ))).toThrow(/Duplicate field 'id'/);
  });

  it("rejects model-name collisions ignoring case", () => {
    expect(() => generatePrismaSchema(database(
      model("User", [field("id", "string")]),
      model("user", [field("id", "string")]),
    ))).toThrow(/collision|Duplicate model name/i);
  });

  it("rejects a relation whose source or target model does not exist", () => {
    const relation: Relation = { ...userToPost, source: "Missing" };
    expect(() => generatePrismaSchema(database(
      model("Post", [field("id", "string"), field("authorId", "string")], [relation]),
    ))).toThrow(/Relation source model 'Missing' not found/);
  });

  it("requires relations to reference the source primary key", () => {
    const relation: Relation = { ...userToPost, sourceField: "email" };
    expect(() => generatePrismaSchema(database(
      model("UserProfile", [field("id", "string"), field("email", "string")], [relation]),
      model("Post", [field("id", "string"), field("authorId", "string")]),
    ))).toThrow(/must reference source primary key/);
  });

  it("rejects missing foreign-key fields and foreign-key type mismatches", () => {
    const missingFk = { ...userToPost, targetField: "missingAuthorId" };
    expect(() => generatePrismaSchema(database(
      model("UserProfile", [field("id", "string")], [missingFk]),
      model("Post", [field("id", "string")]),
    ))).toThrow(/Target foreign-key field 'missingAuthorId' is missing/);

    expect(() => generatePrismaSchema(database(
      model("UserProfile", [field("id", "string")], [userToPost]),
      model("Post", [field("id", "number"), field("authorId", "number")]),
    ))).toThrow(/type .* does not match referenced primary key/);
  });

  it("rejects generated relation-field collisions with scalar fields", () => {
    expect(() => generatePrismaSchema(database(
      model("UserProfile", [field("id", "string"), field("postList", "string")], [userToPost]),
      model("Post", [field("id", "string"), field("authorId", "string")]),
    ))).toThrow(/Relation field collision/);
  });

  it("rejects unsupported enum fields", () => {
    expect(() => generatePrismaSchema(database(
      model("User", [field("id", "string"), field("state", "enum")]),
    ))).toThrow(/Enum types are not currently supported/);
  });
});
