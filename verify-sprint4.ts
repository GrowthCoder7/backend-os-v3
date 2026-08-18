import { ArchitectureGraph } from "@repo/types";
import { compileGraph } from "@repo/compiler";
import { executeGenerators } from "@repo/plugins";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const graph: ArchitectureGraph = {
  metadata: {
    id: "sprint-4-mvp",
    name: "Sprint 4 MVP",
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    compilerVersion: "1.0.0",
    schemaVersion: "1.0.0"
  },
  entities: {
    "User": {
      name: "User",
      primaryKey: "id",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "email", type: "string", required: true }
      ]
    }
  },
  relations: [],
  endpoints: [
    { method: "GET", path: "/users", entity: "User", action: "read" },
    { method: "POST", path: "/users", entity: "User", action: "create" }
  ],
  events: {},
  workflows: []
};

const invalidGraph: ArchitectureGraph = {
  ...graph,
  entities: { "BadEntity": { name: "BadEntity", primaryKey: "id", fields: [] } }
};

function runVerification() {
  console.log("=== SPRINT 4 VERIFICATION START ===\n");

  const invalidResult = compileGraph(invalidGraph);
  if (invalidResult.success !== false || invalidResult.ir !== null) {
    console.error("FAIL: Invalid graph was not rejected.");
    process.exit(1);
  }
  console.log("PASS: Invalid graph is correctly rejected.");

  const result1 = compileGraph(graph);
  if (!result1.success || !result1.ir) {
    console.error("FAIL: Valid graph failed to compile.");
    process.exit(1);
  }
  console.log("PASS: Valid graph successfully compiles to BackendIR.");

  const result2 = compileGraph(graph);
  if (JSON.stringify(result1.ir) !== JSON.stringify(result2.ir)) {
    console.error("FAIL: Compilation is not deterministic.");
    process.exit(1);
  }
  console.log("PASS: BackendIR is deterministic upon repeated compilation.");

  const artifacts1 = executeGenerators(result1.ir);
  const artifacts2 = executeGenerators(result2.ir);

  if (!artifacts1.fileSystem || !artifacts2.fileSystem) {
    console.error("FAIL: executeGenerators did not produce fileSystem.");
    process.exit(1);
  }
  
  const fileSystem1 = artifacts1.fileSystem;
  const fileSystem2 = artifacts2.fileSystem;

  if (JSON.stringify(fileSystem1) !== JSON.stringify(fileSystem2)) {
    console.error("FAIL: NestJS Generation is not deterministic.");
    process.exit(1);
  }
  console.log("PASS: NestJS output generation is deterministic.");

  const requiredFiles = [
    "src/main.ts",
    "src/app.module.ts",
    "src/user/user.module.ts",
    "src/user/user.controller.ts",
    "src/user/user.service.ts"
  ];
  for (const file of requiredFiles) {
    if (!fileSystem1[file]) {
      console.error(`FAIL: Missing generated file: ${file}`);
      process.exit(1);
    }
  }
  console.log("PASS: All 5 canonical files exist.");

  const controllerCode = fileSystem1["src/user/user.controller.ts"];
  if (!controllerCode.includes("@Get('users')")) {
    console.error("FAIL: Controller is missing expected @Get('users')");
    process.exit(1);
  }
  if (!controllerCode.includes("@Post('users')")) {
    console.error("FAIL: Controller is missing expected @Post('users')");
    process.exit(1);
  }
  if (!controllerCode.includes("get_user()") || !controllerCode.includes("post_user()")) {
    console.error("FAIL: Controller is missing expected IR handler IDs.");
    process.exit(1);
  }
  console.log("PASS: GET /users, POST /users, and IR handler IDs correctly represented in controller.");

  const appModule = fileSystem1["src/app.module.ts"];
  if (!appModule.includes("UserModule")) {
    console.error("FAIL: AppModule does not wire UserModule.");
    process.exit(1);
  }
  const userModule = fileSystem1["src/user/user.module.ts"];
  if (!userModule.includes("UserController") || !userModule.includes("UserService")) {
    console.error("FAIL: UserModule does not wire Controller or Service.");
    process.exit(1);
  }
  console.log("PASS: NestJS Module wiring is correct.\n");

  console.log("Attempting Generated Project Build...");
  const outDir = path.join(process.cwd(), "generated-mvp");
  fs.mkdirSync(outDir, { recursive: true });
  
  for (const [relPath, content] of Object.entries(fileSystem1)) {
    const fullPath = path.join(outDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  fs.writeFileSync(path.join(outDir, "package.json"), JSON.stringify({ name: "mvp", dependencies: {} }));
  fs.writeFileSync(path.join(outDir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "es2022", module: "nodenext", moduleResolution: "nodenext", experimentalDecorators: true, emitDecoratorMetadata: true , types:["node"]} }));

  let dependenciesResolved = false;
  try {
    execSync("npm install @nestjs/common @nestjs/core reflect-metadata rxjs typescript @types/node --no-save --silent", { cwd: outDir, stdio: "ignore" });
    dependenciesResolved = true;
  } catch (err) {
    console.log("GENERATED PROJECT BUILD:\nBLOCKED");
    console.log("REASON: Failed to install required dependency tooling via npm.\n");
  }

  if (dependenciesResolved) {
    try {
      const tscBin = process.platform === "win32"
        ? path.join(outDir, "node_modules", ".bin", "tsc.CMD")
        : path.join(outDir, "node_modules", ".bin", "tsc");
      execSync(`"${tscBin}" --noEmit`, { cwd: outDir, stdio: "pipe" });
      console.log("GENERATED PROJECT BUILD:\nSUCCESS");
    } catch (err: any) {
      console.log("GENERATED PROJECT BUILD:\nFAILED");
      console.log("--- TSC OUTPUT ---");
      console.log(err.stdout?.toString());
      console.log(err.stderr?.toString());
      console.log("------------------");
      process.exit(1);
    }
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  console.log("\n=== SPRINT 4 VERIFICATION COMPLETE ===");
}

runVerification();