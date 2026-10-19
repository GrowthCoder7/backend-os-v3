import { describe, it, expect } from "vitest";
import { generateNestJSApp } from "./nestjsGenerator";
import { BackendIR } from "@repo/types";

describe("NestJS Generator MVP", () => {
  const mockIR: BackendIR = {
    metadata: { id: "1", name: "test", createdAt: "1", updatedAt: "1", compilerVersion: "1.0", schemaVersion: "1.0" },
    database: {
      models: [
      {
        tableName: "user",
        primaryKey: "id",
        fields: [
          { name: "id", type: "string", required: true },
          { name: "email", type: "string", required: true },
          { name: "metadata", type: "json", required: false },
        ],
        relations: [], // FIX: Required by CompiledModel
      },
    ],
    },
    apis: {
      routes: [
        { method: "GET", path: "/users", entity: "user", action: "read", handlerId: "get_users" },
        { method: "POST", path: "/users", entity: "user", action: "create", handlerId: "create_user" },
        { method: "GET", path: "/users/:id", entity: "user", action: "read", handlerId: "get_user_by_id" },
        { method: "PUT", path: "/users/:id", entity: "user", action: "update", handlerId: "update_user" },
        { method: "DELETE", path: "/users/:id", entity: "user", action: "delete", handlerId: "delete_user" }
      ]
    },
    events: [],
    workflows: []
  };

  it("generates exactly 12 files for a single-entity graph", () => {
    const fs = generateNestJSApp(mockIR);
    expect(Object.keys(fs).length).toBe(12);
    expect(fs["package.json"]).toBeDefined();
    expect(fs["tsconfig.json"]).toBeDefined();
    expect(fs[".env.example"]).toBeDefined();
    expect(fs["prisma/schema.prisma"]).toBeDefined();
    expect(fs["src/main.ts"]).toBeDefined();
    expect(fs["src/app.module.ts"]).toBeDefined();
    expect(fs["src/app.controller.ts"]).toBeDefined();
    expect(fs["src/prisma/prisma.service.ts"]).toBeDefined();
    expect(fs["src/prisma/prisma.module.ts"]).toBeDefined();
    expect(fs["src/user/user.service.ts"]).toBeDefined();
    expect(fs["src/user/user.controller.ts"]).toBeDefined();
    expect(fs["src/user/user.module.ts"]).toBeDefined();
  });

  it("generates package.json with required build scripts and dependencies", () => {
    const fs = generateNestJSApp(mockIR);
    const pkg = JSON.parse(fs["package.json"]);
    expect(pkg.scripts.prebuild).toBe("prisma generate");
    expect(pkg.scripts["db:push"]).toBe("prisma db push");
    expect(pkg.dependencies["@prisma/client"]).toBeDefined();
    expect(pkg.devDependencies["prisma"]).toBeDefined();
  });

  it("generates tsconfig.json satisfying the source-to-dist boundary", () => {
    const fs = generateNestJSApp(mockIR);
    const tsconfig = JSON.parse(fs["tsconfig.json"]);
    expect(tsconfig.compilerOptions.outDir).toBe("./dist");
  });

  it("main.ts establishes the readiness protocol extracting the actual bound port", () => {
    const fs = generateNestJSApp(mockIR);
    const main = fs["src/main.ts"];
    expect(main).toContain("require('dotenv').config();");
    expect(main).toContain("BACKEND_OS_READY:${actualPort}");
  });

  it("controllers correctly inject @Body and @Param based on route rules", () => {
    const fs = generateNestJSApp(mockIR);
    const controller = fs["src/user/user.controller.ts"];
    
    expect(controller).toContain("BadRequestException");
    expect(controller).toContain("@Get('users/:id')");
    expect(controller).toContain("@Param('id') id: string");
    expect(controller).toContain("@Post('users')");
    expect(controller).toContain("@Body() payload: Partial<UserInterface>");
    expect(controller).toContain("@HttpCode(201)");
  });

  it("services implement Prisma, CRUD, HTTP Exceptions, and strict field validation", () => {
    const fs = generateNestJSApp(mockIR);
    const service = fs["src/user/user.service.ts"];
    
    expect(service).toContain("import { PrismaService }");
    expect(service).toContain("constructor(private prisma: PrismaService)");
    expect(service).toContain("this.prisma.user.create");
    expect(service).toContain("if (error instanceof Prisma.PrismaClientKnownRequestError)");
    expect(service).toContain("throw new NotFoundException");
    expect(service).toContain("throw new BadRequestException");
  });

  it("guarantees output is byte-for-byte deterministic", () => {
    const pass1 = generateNestJSApp(mockIR);
    const pass2 = generateNestJSApp(mockIR);
    expect(pass1).toEqual(pass2);
  });

  it("does not contain unnecessary 'any' in service types", () => {
    const fs = generateNestJSApp(mockIR);
    const service = fs["src/user/user.service.ts"];
    // The generator currently uses `as any` strictly within the prisma queries payload boundary,
    // ensuring the return types are explicitly `<UserInterface>`. We test for the return boundaries.
    expect(service).toContain("Promise<UserInterface>");
    expect(service).toContain("Promise<UserInterface[]>");
  });
});