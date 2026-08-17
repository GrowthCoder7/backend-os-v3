import { describe, it, expect } from "vitest";
import { generateNestJSApp } from "./nestjsGenerator";
import { BackendIR } from "@repo/types";

describe("NestJS Generator", () => {
  const mockIR: BackendIR = {
    database: { models: [{ tableName: "user", primaryKey: "id", fields: [], relations: [] }] },
    apis: { routes: [
      { method: "GET", path: "/users", handlerId: "get_user", entity: "User", action: "read" },
      { method: "POST", path: "/users", handlerId: "post_user", entity: "User", action: "create" }
    ] },
    workflows: { workflows: [] },
    events: {},
    metadata: { version: "1", generatedAt: "2026-08-17" }
  };

  it("generates the 5 canonical application files", () => {
    const fs = generateNestJSApp(mockIR);
    expect(fs["src/main.ts"]).toBeDefined();
    expect(fs["src/app.module.ts"]).toBeDefined();
    expect(fs["src/user/user.module.ts"]).toBeDefined();
    expect(fs["src/user/user.controller.ts"]).toBeDefined();
    expect(fs["src/user/user.service.ts"]).toBeDefined();
  });

  it("properly maps IR paths to routing decorators", () => {
    const fs = generateNestJSApp(mockIR);
    const controller = fs["src/user/user.controller.ts"];
    expect(controller).toContain("@Get('users')");
    expect(controller).toContain("@Post('users')");
  });

  it("preserves authoritative IR handler identifiers", () => {
    const fs = generateNestJSApp(mockIR);
    const controller = fs["src/user/user.controller.ts"];
    // Do not invent handler names; use BackendIR `handlerId`
    expect(controller).toContain("get_user()");
    expect(controller).toContain("post_user()");
  });

  it("generates deterministic output", () => {
    const fs1 = generateNestJSApp(mockIR);
    const fs2 = generateNestJSApp(mockIR);
    expect(fs1).toEqual(fs2);
  });
});