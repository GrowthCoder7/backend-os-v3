import { describe, it, expect } from "vitest";
import { generateNestJSApp } from "./nestjsGenerator";
import { BackendIR } from "@repo/types";

describe("NestJS Generator MVP", () => {
  const mockIR: BackendIR = {
    database: { 
      models: [
        { 
          tableName: "user", 
          primaryKey: "id", 
          fields: [
            { name: "id", type: "string", required: true },
            { name: "email", type: "string", required: true },
            { name: "metadata", type: "json", required: false }
          ], 
          relations: [] 
        }
      ] 
    },
    apis: { 
      routes: [
        { method: "GET", path: "/users", handlerId: "get_users", entity: "User", action: "read" },
        { method: "GET", path: "/users/:id", handlerId: "get_user_by_id", entity: "User", action: "read" },
        { method: "POST", path: "/users", handlerId: "create_user", entity: "User", action: "create" },
        { method: "PUT", path: "/users/:id", handlerId: "update_user", entity: "User", action: "update" },
        { method: "DELETE", path: "/users/:id", handlerId: "delete_user", entity: "User", action: "delete" }
      ] 
    },
    workflows: { workflows: [] },
    events: {},
    metadata: { version: "1", generatedAt: "2026-08-17T00:00:00.000Z" }
  };

  it("generates exactly 7 files for a single-entity graph", () => {
    const fs = generateNestJSApp(mockIR);
    expect(Object.keys(fs).length).toBe(7);
    expect(fs["package.json"]).toBeDefined();
    expect(fs["tsconfig.json"]).toBeDefined();
    expect(fs["src/main.ts"]).toBeDefined();
    expect(fs["src/app.module.ts"]).toBeDefined();
    expect(fs["src/user/user.module.ts"]).toBeDefined();
    expect(fs["src/user/user.controller.ts"]).toBeDefined();
    expect(fs["src/user/user.service.ts"]).toBeDefined();
  });

  it("generates package.json with required build scripts and dependencies", () => {
    const fs = generateNestJSApp(mockIR);
    const pkg = JSON.parse(fs["package.json"]);
    expect(pkg.scripts.build).toBe("tsc");
    expect(pkg.scripts.start).toBe("node dist/main.js");
    expect(pkg.dependencies["@nestjs/core"]).toBeDefined();
    expect(pkg.dependencies["@nestjs/platform-express"]).toBeDefined();
    expect(pkg.devDependencies["typescript"]).toBeDefined();
  });

  it("generates tsconfig.json satisfying the source-to-dist boundary", () => {
    const fs = generateNestJSApp(mockIR);
    const tsconfig = JSON.parse(fs["tsconfig.json"]);
    expect(tsconfig.compilerOptions.outDir).toBe("./dist");
    expect(tsconfig.compilerOptions.rootDir).toBe("./src");
    expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
    expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
    expect(tsconfig.compilerOptions.module).toBe("nodenext");
  });

  it("main.ts establishes the readiness protocol extracting the actual bound port", () => {
    const fs = generateNestJSApp(mockIR);
    const main = fs["src/main.ts"];
    expect(main).toContain("process.env.PORT ?? 3000");
    expect(main).toContain("app.getHttpServer().address().port");
    expect(main).toContain("BACKEND_OS_READY:${actualPort}");
  });

  it("controllers correctly inject @Body and @Param based on route rules", () => {
    const fs = generateNestJSApp(mockIR);
    const controller = fs["src/user/user.controller.ts"];
    
    // Validates BadRequestException imports
    expect(controller).toContain("BadRequestException");

    // GET /users/:id
    expect(controller).toContain("@Param('id') id: string");
    
    // POST /users
    expect(controller).toContain("create_user(@Body() payload: Partial<UserInterface>)");
    
    // PUT /users/:id
    expect(controller).toContain("update_user(@Param('id') id: string, @Body() payload: Partial<UserInterface>)");

    // DELETE /users/:id
    expect(controller).toContain("delete_user(@Param('id') id: string)");
    expect(controller).not.toContain("delete_user(@Param('id') id: string, @Body()");
  });

  it("services implement Map, CRUD, HTTP Exceptions, and strict field validation", () => {
    const fs = generateNestJSApp(mockIR);
    const service = fs["src/user/user.service.ts"];
    
    expect(service).toContain("private records: Map<string, UserInterface> = new Map()");
    expect(service).toContain("import * as crypto from 'crypto'");
    expect(service).toContain("crypto.randomUUID()");
    expect(service).toContain("NotFoundException");
    expect(service).toContain("BadRequestException");
    
    expect(service).toContain("payload as Record<string, unknown>)[field] === undefined");
    
    expect(service).toContain("updated.id = existing.id");

    expect(service).toContain("metadata?: Record<string, unknown>");
  });

  it("guarantees output is byte-for-byte deterministic", () => {
    const fs1 = generateNestJSApp(mockIR);
    const fs2 = generateNestJSApp(mockIR);
    expect(JSON.stringify(fs1)).toBe(JSON.stringify(fs2));
  });

  it("does not contain unnecessary 'any' in service types", () => {
    const fs = generateNestJSApp(mockIR);
    expect(fs["src/user/user.service.ts"]).not.toContain(": any");
  });
});