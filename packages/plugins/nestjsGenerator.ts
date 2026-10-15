import { BackendIR, CompiledModel, CompiledRoute } from "@repo/types";
import { generatePrismaSchema } from "./prismaGenerator";

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

const extractParams = (path: string): string[] => {
  return path.split("/").filter(segment => segment.startsWith(":")).map(segment => segment.slice(1));
};

const toPascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const toCamel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const generateNestJSApp = (ir: BackendIR): Record<string, string> => {
  const fs: Record<string, string> = {};

  fs["package.json"] = JSON.stringify({
    name: "backend-os-generated-mvp",
    version: "1.0.0",
    private: true,
    scripts: {
      "prebuild": "prisma generate", 
      "build": "tsc",
      "start": "node dist/main.js",
      "db:push": "prisma db push"
    },
    dependencies: {
      "@nestjs/common": "^10.0.0",
      "@nestjs/core": "^10.0.0",
      "@nestjs/platform-express": "^10.0.0",
      "@prisma/client": "^5.0.0",
      "dotenv": "^16.3.1",
      "reflect-metadata": "^0.2.0",
      "rxjs": "^7.8.1",
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      "prisma": "^5.0.0",
      "typescript": "^5.0.0"
    }
  }, null, 2);

  fs["tsconfig.json"] = JSON.stringify({
    compilerOptions: {
      module: "nodenext", target: "es2022", outDir: "./dist", rootDir: "./src",
      experimentalDecorators: true, emitDecoratorMetadata: true,
      moduleResolution: "nodenext", strict: true, skipLibCheck: true, types: ["node"]
    },
    include: ["src/**/*"]
  }, null, 2);

  fs[".env.example"] = `DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"\nPORT=3000\n`;
  fs["prisma/schema.prisma"] = generatePrismaSchema(ir.database);
  
  fs["src/prisma/prisma.service.ts"] = `import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
`;

  fs["src/prisma/prisma.module.ts"] = `import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
`;

  fs["src/app.controller.ts"] = `import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  getHealth() { return { status: "ok", timestamp: new Date().toISOString() }; }
}
`;

  fs["src/main.ts"] = `require('dotenv').config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  
  const actualPort = app.getHttpServer().address().port;
  console.log(\`BACKEND_OS_READY:\${actualPort}\`);
}
bootstrap();
`;

  const activeModules: string[] = [];
  const sortedModels = [...ir.database.models].sort((a, b) => a.tableName.localeCompare(b.tableName));

  for (const model of sortedModels) {
    if (!model.primaryKey) {
      throw new Error(`Code Generation Failed: Model '${model.tableName}' lacks a defined primary key.`);
    }

    const pascalName = toPascal(model.tableName);
    const camelName = toCamel(model.tableName);
    const delegate = camelName; 
    
    const pkFieldInfo = model.fields.find(f => f.name === model.primaryKey);
    if (!pkFieldInfo) {
      throw new Error(`Code Generation Failed: Model '${model.tableName}' declares primary key '${model.primaryKey}', but no such field exists.`);
    }
    if (pkFieldInfo.type !== "string" && pkFieldInfo.type !== "number") {
      throw new Error(`Code Generation Failed: Unsupported primary key type '${pkFieldInfo.type}' on model '${model.tableName}'. Only string and number are supported.`);
    }

    const routes = ir.apis.routes
      .filter(r => r.entity.toLowerCase() === model.tableName.toLowerCase())
      .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    
    if (routes.length === 0 && model.fields.length === 0) continue; 
    
    activeModules.push(`${pascalName}Module`);

    const sortedFields = [...model.fields].sort((a, b) => a.name.localeCompare(b.name));
    const pkField = model.primaryKey;
    const isNumericPk = pkFieldInfo.type === "number";
    const requiredFields = sortedFields.filter(f => f.required && f.name !== pkField).map(f => f.name);

    let serviceContent = `import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface ${pascalName}Interface {
${sortedFields.map(f => `  ${f.name}${f.required ? '' : '?'}: ${mapFieldType(f.type)};`).join('\n')}
}

@Injectable()
export class ${pascalName}Service {
  constructor(private prisma: PrismaService) {}

  private handleError(error: unknown) {
    if (error instanceof HttpException) throw error; 
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('Unique constraint violation.');
      if (error.code === 'P2025') throw new NotFoundException('Record not found.');
    }
    console.error('[Prisma Error]', error);
    throw new InternalServerErrorException('Database operation failed.');
  }

  async createRecord(payload: Partial<${pascalName}Interface>): Promise<${pascalName}Interface> {
    const requiredFields = ${JSON.stringify(requiredFields)};
    for (const field of requiredFields) {
      if ((payload as Record<string, unknown>)[field] === undefined) {
        throw new BadRequestException(\`Field '\${field}' is required.\`);
      }
    }
    
    try {
      return await this.prisma.${delegate}.create({ data: payload as any }) as unknown as ${pascalName}Interface;
    } catch (error) {
      this.handleError(error);
    }
    throw new InternalServerErrorException();
  }

  async readAll(): Promise<${pascalName}Interface[]> {
    try {
      return await this.prisma.${delegate}.findMany() as unknown as ${pascalName}Interface[];
    } catch (error) {
      this.handleError(error);
    }
    return [];
  }

  async readOne(id: string): Promise<${pascalName}Interface> {
    const parsedId = ${isNumericPk ? 'Number(id)' : 'id'};
    ${isNumericPk ? `if (isNaN(parsedId as number)) throw new BadRequestException('Invalid ID format');` : ''}

    try {
      const record = await this.prisma.${delegate}.findUnique({ where: { ${pkField}: parsedId } });
      if (!record) throw new NotFoundException(); 
      return record as unknown as ${pascalName}Interface;
    } catch (error) {
      this.handleError(error);
    }
    throw new InternalServerErrorException();
  }

  async updateRecord(id: string, payload: Partial<${pascalName}Interface>): Promise<${pascalName}Interface> {
    const parsedId = ${isNumericPk ? 'Number(id)' : 'id'};
    ${isNumericPk ? `if (isNaN(parsedId as number)) throw new BadRequestException('Invalid ID format');` : ''}

    try {
      return await this.prisma.${delegate}.update({
        where: { ${pkField}: parsedId },
        data: payload as any,
      }) as unknown as ${pascalName}Interface;
    } catch (error) {
      this.handleError(error);
    }
    throw new InternalServerErrorException();
  }

  async deleteRecord(id: string): Promise<void> {
    const parsedId = ${isNumericPk ? 'Number(id)' : 'id'};
    ${isNumericPk ? `if (isNaN(parsedId as number)) throw new BadRequestException('Invalid ID format');` : ''}

    try {
      await this.prisma.${delegate}.delete({ where: { ${pkField}: parsedId } });
    } catch (error) {
      this.handleError(error);
    }
  }
}
`;
    fs[`src/${camelName}/${camelName}.service.ts`] = serviceContent;

    let controllerContent = `import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { ${pascalName}Service, ${pascalName}Interface } from './${camelName}.service';

@Controller()
export class ${pascalName}Controller {
  constructor(private readonly service: ${pascalName}Service) {}
`;

    for (const route of routes) {
      const decorator = route.method.charAt(0).toUpperCase() + route.method.slice(1).toLowerCase();
      const routePath = route.path.replace(/^\//, ''); 
      const pathArg = routePath ? `'${routePath}'` : '';
      
      const params = extractParams(route.path);
      const paramArgs = params.map(p => `@Param('${p}') ${p}: string`);
      const hasBody = route.method === "POST" || route.method === "PUT";
      
      if (hasBody) paramArgs.push(`@Body() payload: Partial<${pascalName}Interface>`);
      const methodSignature = paramArgs.join(', ');

      let serviceCall = '';
      if (route.action === 'create') {
        serviceCall = `return await this.service.createRecord(${hasBody ? 'payload' : '{}'});`;
      } else if (route.action === 'read') {
        serviceCall = params.length > 0 ? `return await this.service.readOne(${params[0]});` : `return await this.service.readAll();`;
      } else if (route.action === 'update') {
        serviceCall = `return await this.service.updateRecord(${params[0]}, ${hasBody ? 'payload' : '{}'});`;
      } else if (route.action === 'delete') {
        serviceCall = `await this.service.deleteRecord(${params[0]});`;
      }

      controllerContent += `
  @${decorator}(${pathArg})${route.method === 'POST' && route.action === 'create' ? '\n  @HttpCode(201)' : ''}
  async ${route.handlerId}(${methodSignature}) {
    ${serviceCall}
  }
`;
    }
    controllerContent += `}\n`;
    fs[`src/${camelName}/${camelName}.controller.ts`] = controllerContent;

    fs[`src/${camelName}/${camelName}.module.ts`] = `import { Module } from '@nestjs/common';
import { ${pascalName}Controller } from './${camelName}.controller';
import { ${pascalName}Service } from './${camelName}.service';

@Module({
  controllers: [${pascalName}Controller],
  providers: [${pascalName}Service],
})
export class ${pascalName}Module {}
`;
  }

  const importsStr = sortedModels
    .filter(m => activeModules.includes(`${toPascal(m.tableName)}Module`))
    .map(m => `import { ${toPascal(m.tableName)}Module } from './${toCamel(m.tableName)}/${toCamel(m.tableName)}.module';`)
    .join('\n');
    
  fs['src/app.module.ts'] = `import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
${importsStr}

@Module({
  imports: [PrismaModule, ${activeModules.join(', ')}],
  controllers: [AppController],
})
export class AppModule {}
`;

  return fs;
};