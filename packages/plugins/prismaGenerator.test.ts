import { describe, it, expect } from "vitest";
import { generateNestJSApp } from "./nestjsGenerator";
import { ProjectMaterializer } from "@repo/runtime/src/materializer";
import { RuntimeOrchestrator } from "@repo/runtime/src/orchestrator";
import { DatabaseIR } from "@repo/types";
import * as path from "path";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { execSync } from "child_process";

describe("Prisma Generation & Build Pipeline (Integration Guard)", () => {
  it("Rejects enum fallback silently", () => {
    const ir: DatabaseIR = {
      models: [{ tableName: "User", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }, { name: "role", type: "enum", required: true }] }],
      relations: []
    };
    const { generatePrismaSchema } = require("./prismaGenerator");
    expect(() => generatePrismaSchema(ir)).toThrow(/Enum types are not currently supported/);
  });

  it("Rejects relation field collisions", () => {
    const ir: DatabaseIR = {
      models: [
        { tableName: "user", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }, { name: "postList", type: "string", required: false }] },
        { tableName: "post", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }, { name: "authorId", type: "string", required: true }] }
      ],
      relations: [ { source: "user", sourceField: "id", target: "post", targetField: "authorId", type: "one-to-many" } ]
    };
    const { generatePrismaSchema } = require("./prismaGenerator");
    expect(() => generatePrismaSchema(ir)).toThrow(/Relation field collision. Model 'user' already contains field 'postList'/);
  });

  it("Validates schema and completes build via orchestrator", async () => {
    // Note: Due to explicit limitations, this block is marked BLOCKED/UNVERIFIED
    // and must be run natively in Docker to prove the Pinned Prisma CLI completes without error.
    const ir = {
      metadata: { id: "1", name: "t", createdAt: "1", updatedAt: "1", compilerVersion: "1.0", schemaVersion: "1.0" },
      database: { 
        models: [
          { tableName: "user", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }] },
          { tableName: "post", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }, { name: "authorId", type: "string", required: true }] }
        ],
        relations: [
          { source: "user", sourceField: "id", target: "post", targetField: "authorId", type: "one-to-many" }
        ]
      },
      apis: { routes: [] }, events: [], workflows: []
    };

    const targetDir = path.join(__dirname, ".temp_e2e_build_test");
    const virtualFs = generateNestJSApp(ir as any);

    try {
      await ProjectMaterializer.materialize(virtualFs, targetDir);
      
      const orchestrator = new RuntimeOrchestrator();
      await orchestrator.install(targetDir);
      await expect(orchestrator.build(targetDir)).resolves.toBeUndefined();
    } finally {
      await ProjectMaterializer.cleanup(targetDir);
    }
  }, 120000);

  it("Rejects relation collisions among multiple relations", () => {
    const ir: DatabaseIR = {
      models: [
        { tableName: "user", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }] },
        { tableName: "post", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }, { name: "authorId", type: "string", required: true }, { name: "editorId", type: "string", required: true }] }
      ],
      relations: [ 
        { source: "user", sourceField: "id", target: "post", targetField: "authorId", type: "one-to-many" },
        { source: "user", sourceField: "id", target: "post", targetField: "editorId", type: "one-to-many" }
      ]
    };
    
    const { generatePrismaSchema } = require("./prismaGenerator");
    expect(() => generatePrismaSchema(ir)).toThrow(/Relation field collision. Model 'user' already contains field 'postList'/);
  });
});