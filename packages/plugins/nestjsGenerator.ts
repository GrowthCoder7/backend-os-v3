import { BackendIR, CompiledModel, CompiledRoute } from "@repo/types";

// Deterministic type mapping for the MVP
const mapFieldType = (type: string): string => {
  switch (type) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "datetime": return "string";
    case "json": return "Record<string, unknown>";
    case "enum": return "string";
    case "relation": return "string";
    default: return "string";
  }
};

// Deterministic route parameter extraction
const extractParams = (path: string): string[] => {
  return path.split("/").filter(segment => segment.startsWith(":")).map(segment => segment.slice(1));
};

export const generateNestJSApp = (ir: BackendIR): Record<string, string> => {
  const fs: Record<string, string> = {};

  // 1. Generate package.json (Deterministic string)
  fs["package.json"] = JSON.stringify({
    name: "backend-os-generated-mvp",
    version: "1.0.0",
    private: true,
    scripts: {
      "build": "tsc",
      "start": "node dist/main.js"
    },
    dependencies: {
      "@nestjs/common": "^10.0.0",
      "@nestjs/core": "^10.0.0",
      "@nestjs/platform-express": "^10.0.0",
      "reflect-metadata": "^0.2.0",
      "rxjs": "^7.8.1",
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      "typescript": "^5.0.0"
    }
  }, null, 2);

  // 2. Generate tsconfig.json (Source-to-dist boundary)
  fs["tsconfig.json"] = JSON.stringify({
  compilerOptions: {
    module: "nodenext",
    target: "es2022",
    outDir: "./dist",
    rootDir: "./src",
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    moduleResolution: "nodenext",
    strict: true,
    skipLibCheck: true,
    types: ["node"]
  },
  include: ["src/**/*"]
}, null, 2);

  // 3. Generate main.ts (Dynamic port binding & Actual Port Readiness Protocol)
  fs["src/main.ts"] = `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  
  // Extract actual bound port (required when PORT=0)
  const actualPort = app.getHttpServer().address().port;
  console.log(\`BACKEND_OS_READY:\${actualPort}\`);
}
bootstrap();
`;

  const activeModules: string[] = [];

  // Deterministic sorting of models
  const sortedModels = [...ir.database.models].sort((a, b) => a.tableName.localeCompare(b.tableName));

  for (const model of sortedModels) {
    const entityLower = model.tableName.toLowerCase();
    const entityCapital = entityLower.charAt(0).toUpperCase() + entityLower.slice(1);
    
    // Deterministic sorting of routes
    const routes = ir.apis.routes
      .filter(r => r.entity.toLowerCase() === entityLower)
      .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    
    if (routes.length === 0 && model.fields.length === 0) continue; 
    
    activeModules.push(`${entityCapital}Module`);

    const sortedFields = [...model.fields].sort((a, b) => a.name.localeCompare(b.name));
    const pkField = model.primaryKey;
    const requiredFields = sortedFields.filter(f => f.required && f.name !== pkField).map(f => f.name);

    // -- SERVICE GENERATION --
    let serviceContent = `import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface ${entityCapital}Interface {
${sortedFields.map(f => `  ${f.name}${f.required ? '' : '?'}: ${mapFieldType(f.type)};`).join('\n')}
}

@Injectable()
export class ${entityCapital}Service {
  private records: Map<string, ${entityCapital}Interface> = new Map();

  createRecord(payload: Partial<${entityCapital}Interface>): ${entityCapital}Interface {
    const requiredFields = ${JSON.stringify(requiredFields)};
    for (const field of requiredFields) {
      if ((payload as Record<string, unknown>)[field] === undefined) {
        throw new BadRequestException(\`Field '\${field}' is required.\`);
      }
    }
    
    if (payload.${pkField} === undefined) {
      payload.${pkField} = crypto.randomUUID();
    }
    
    this.records.set(payload.${pkField} as string, payload as ${entityCapital}Interface);
    return payload as ${entityCapital}Interface;
  }

  readAll(): ${entityCapital}Interface[] {
    return Array.from(this.records.values());
  }

  readOne(id: string): ${entityCapital}Interface {
    const record = this.records.get(id);
    if (!record) throw new NotFoundException();
    return record;
  }

  updateRecord(id: string, payload: Partial<${entityCapital}Interface>): ${entityCapital}Interface {
    const existing = this.records.get(id);
    if (!existing) throw new NotFoundException();
    
    const updated = { ...existing, ...payload };
    updated.${pkField} = existing.${pkField}; // Preserve primary key
    
    this.records.set(id, updated);
    return updated;
  }

  deleteRecord(id: string): void {
    const existing = this.records.get(id);
    if (!existing) throw new NotFoundException();
    this.records.delete(id);
  }
}
`;
    fs[`src/${entityLower}/${entityLower}.service.ts`] = serviceContent;

    // -- CONTROLLER GENERATION --
    // BadRequestException is explicitly imported for safe parameterized handler generation
    let controllerContent = `import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode, BadRequestException } from '@nestjs/common';
import { ${entityCapital}Service, ${entityCapital}Interface } from './${entityLower}.service';

@Controller()
export class ${entityCapital}Controller {
  constructor(private readonly service: ${entityCapital}Service) {}
`;

    for (const route of routes) {
      const decorator = route.method.charAt(0).toUpperCase() + route.method.slice(1).toLowerCase();
      const routePath = route.path.replace(/^\//, ''); // Strip leading slash
      const pathArg = routePath ? `'${routePath}'` : '';
      
      const params = extractParams(route.path);
      const paramArgs = params.map(p => `@Param('${p}') ${p}: string`);
      const hasBody = route.method === "POST" || route.method === "PUT";
      
      if (hasBody) {
        paramArgs.push(`@Body() payload: Partial<${entityCapital}Interface>`);
      }

      const methodSignature = paramArgs.join(', ');

      let serviceCall = '';
      if (route.action === 'create') {
        serviceCall = `return this.service.createRecord(${hasBody ? 'payload' : '{}'});`;
      } else if (route.action === 'read') {
        serviceCall = params.length > 0 
          ? `return this.service.readOne(${params[0]});` 
          : `return this.service.readAll();`;
      } else if (route.action === 'update') {
        serviceCall = params.length > 0 
          ? `return this.service.updateRecord(${params[0]}, ${hasBody ? 'payload' : '{}'});`
          : `throw new BadRequestException('Missing lookup parameter');`;
      } else if (route.action === 'delete') {
        serviceCall = params.length > 0 
          ? `this.service.deleteRecord(${params[0]});`
          : `throw new BadRequestException('Missing lookup parameter');`;
      }

      controllerContent += `
  @${decorator}(${pathArg})${route.method === 'POST' && route.action === 'create' ? '\n  @HttpCode(201)' : ''}
  ${route.handlerId}(${methodSignature}) {
    ${serviceCall}
  }
`;
    }
    controllerContent += `}\n`;
    fs[`src/${entityLower}/${entityLower}.controller.ts`] = controllerContent;

    // -- MODULE GENERATION --
    fs[`src/${entityLower}/${entityLower}.module.ts`] = `import { Module } from '@nestjs/common';
import { ${entityCapital}Controller } from './${entityLower}.controller';
import { ${entityCapital}Service } from './${entityLower}.service';

@Module({
  controllers: [${entityCapital}Controller],
  providers: [${entityCapital}Service],
})
export class ${entityCapital}Module {}
`;
  }

  // 4. Generate app.module.ts
  const importsStr = sortedModels
    .filter(m => activeModules.includes(`${m.tableName.charAt(0).toUpperCase() + m.tableName.slice(1)}Module`))
    .map(m => `import { ${m.tableName.charAt(0).toUpperCase() + m.tableName.slice(1)}Module } from './${m.tableName.toLowerCase()}/${m.tableName.toLowerCase()}.module';`)
    .join('\n');
    
  fs['src/app.module.ts'] = `import { Module } from '@nestjs/common';
${importsStr}

@Module({
  imports: [${activeModules.join(', ')}],
})
export class AppModule {}
`;

  return fs;
};