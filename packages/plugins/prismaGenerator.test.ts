import { describe, expect, it } from "vitest";
import type { CompiledModel, DatabaseIR, Field, Relation } from "@repo/types";
import { generatePrismaSchema } from "./prismaGenerator";

const makeModel = (
  tableName: string,
  fields: Field[],
  relations: Relation[] = [],
  primaryKey = "id",
): CompiledModel => ({ tableName, primaryKey, fields, relations });

const makeDatabase = (...models: CompiledModel[]): DatabaseIR => ({ models });

const userFields: Field[] = [
  { name: "id", type: "string", required: true },
  { name: "email", type: "string", required: true },
];

const postFieldsOptionalFk: Field[] = [
  { name: "id", type: "number", required: true },
  { name: "title", type: "string", required: true },
  { name: "authorId", type: "string", required: false },
];

const userPosts: Relation = {
  source: "user",
  sourceField: "id",
  target: "post",
  targetField: "authorId",
  type: "one-to-many",
};

describe("Prisma Schema Generator — Sprint 11 relationship integrity", () => {
  it("generates both sides of the relation and deduplicates symmetric indexes", () => {
    const ir = makeDatabase(
      makeModel("user", userFields, [userPosts]),
      makeModel("post", postFieldsOptionalFk, [userPosts]),
    );

    const schema = generatePrismaSchema(ir);

    expect(schema).toContain('postList Post[] @relation("Rel_User_Post_authorId")');
    expect(schema).toContain(
      'userRef User? @relation("Rel_User_Post_authorId", fields: [authorId], references: [id])',
    );
    expect(schema.match(/\bpostList\b/g)).toHaveLength(1);
    expect(schema.match(/\buserRef\b/g)).toHaveLength(1);
    expect(schema).toContain("authorId String?");
  });

  it("emits a required owning-side relation when the foreign-key field is required", () => {
    const postFields: Field[] = [
      { name: "id", type: "number", required: true },
      { name: "authorId", type: "string", required: true },
    ];
    const schema = generatePrismaSchema(
      makeDatabase(makeModel("user", userFields, [userPosts]), makeModel("post", postFields, [userPosts])),
    );

    expect(schema).toContain(
      'userRef User @relation("Rel_User_Post_authorId", fields: [authorId], references: [id])',
    );
    expect(schema).toContain("authorId String");
    expect(schema).not.toContain("userRef User? @relation");
  });

  it("rejects a missing primary-key field", () => {
    const ir = makeDatabase(
      makeModel("category", [{ name: "id", type: "string", required: true }], [], "categoryId"),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(
      /Primary key 'categoryId' declared on model 'category' does not exist in its fields/,
    );
  });

  it("rejects a relation that references a non-primary source field", () => {
    const invalidRelation: Relation = { ...userPosts, sourceField: "email", targetField: "authorEmail" };
    const ir = makeDatabase(
      makeModel("user", userFields),
      makeModel("post", [
        { name: "id", type: "string", required: true },
        { name: "authorEmail", type: "string", required: true },
      ], [invalidRelation]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(
      /must reference the source's primary key \('id'\)/,
    );
  });

  it("rejects mismatched primary-key and foreign-key types", () => {
    const numericUserFields: Field[] = [{ name: "id", type: "number", required: true }];
    const ir = makeDatabase(
      makeModel("user", numericUserFields),
      makeModel("post", postFieldsOptionalFk, [userPosts]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(
      /Foreign key 'authorId' type \(string\) does not match referenced primary key 'id' type \(number\)/,
    );
  });

  it("rejects a relation whose target foreign-key field is missing", () => {
    const ir = makeDatabase(
      makeModel("user", userFields, [userPosts]),
      makeModel("post", [{ name: "id", type: "string", required: true }], [userPosts]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(
      /Target foreign key field 'authorId' is missing from model 'post'/,
    );
  });

  it("rejects unsupported relation types instead of silently ignoring them", () => {
    const unsupported: Relation = { ...userPosts, type: "many-to-many" };
    const ir = makeDatabase(
      makeModel("user", userFields, [unsupported]),
      makeModel("post", postFieldsOptionalFk, [unsupported]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(/Unsupported relation type 'many-to-many'/);
  });

  it("rejects conflicting types for otherwise identical relationship endpoints", () => {
    const conflicting: Relation = { ...userPosts, type: "many-to-one" };
    const ir = makeDatabase(
      makeModel("user", userFields, [userPosts]),
      makeModel("post", postFieldsOptionalFk, [conflicting]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(/Conflicting relation types for identical endpoints/);
  });

  it("rejects collisions with explicitly declared field names", () => {
    const ir = makeDatabase(
      makeModel("user", [
        ...userFields,
        { name: "postList", type: "string", required: false },
      ], [userPosts]),
      makeModel("post", postFieldsOptionalFk, [userPosts]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(
      /Relation field collision\. Model 'user' already contains field 'postList'/,
    );
  });

  it("rejects duplicate relation aliases for multiple relationships between the same models", () => {
    const editorRelation: Relation = { ...userPosts, targetField: "editorId" };
    const postFields: Field[] = [
      { name: "id", type: "number", required: true },
      { name: "authorId", type: "string", required: true },
      { name: "editorId", type: "string", required: true },
    ];
    const ir = makeDatabase(
      makeModel("user", userFields, [userPosts, editorRelation]),
      makeModel("post", postFields, [userPosts, editorRelation]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(/Relation field collision/);
  });

  it("rejects enum fields rather than silently converting them", () => {
    const ir = makeDatabase(
      makeModel("user", [
        ...userFields,
        { name: "role", type: "enum", required: true },
      ]),
    );
    expect(() => generatePrismaSchema(ir)).toThrow(/Enum types are not currently supported/);
  });

  it("produces byte-for-byte deterministic output when scoped relation order changes", () => {
    const categoryFields: Field[] = [{ name: "id", type: "string", required: true }];
    const postFields: Field[] = [
      { name: "id", type: "number", required: true },
      { name: "authorId", type: "string", required: true },
      { name: "categoryId", type: "string", required: true },
    ];
    const postCategory: Relation = {
      source: "category",
      sourceField: "id",
      target: "post",
      targetField: "categoryId",
      type: "one-to-many",
    };
    const irA = makeDatabase(
      makeModel("user", userFields, [userPosts]),
      makeModel("category", categoryFields, [postCategory]),
      makeModel("post", postFields, [userPosts, postCategory]),
    );
    const irB = makeDatabase(
      makeModel("user", userFields, [userPosts]),
      makeModel("category", categoryFields, [postCategory]),
      makeModel("post", postFields, [postCategory, userPosts]),
    );

    expect(generatePrismaSchema(irA)).toBe(generatePrismaSchema(irB));
  });
});
