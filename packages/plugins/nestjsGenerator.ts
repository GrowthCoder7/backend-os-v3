import { BackendIR } from "@repo/types";

export const generateNestJSApp = (ir: BackendIR): Record<string, string> => {
  const fs: Record<string, string> = {};
  
  fs['src/main.ts'] = `import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\n\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  await app.listen(3000);\n}\nbootstrap();\n`;

  const activeModules: string[] = [];

  for (const model of ir.database.models) {
    const entityLower = model.tableName.toLowerCase();
    const entityCapital = entityLower.charAt(0).toUpperCase() + entityLower.slice(1);
    
    const routes = ir.apis.routes.filter(r => r.entity.toLowerCase() === entityLower);
    
    if (routes.length === 0 && model.fields.length === 0) continue; 
    
    activeModules.push(`${entityCapital}Module`);

    fs[`src/${entityLower}/${entityLower}.service.ts`] = `import { Injectable } from '@nestjs/common';\n\n@Injectable()\nexport class ${entityCapital}Service {\n}\n`;

    let controllerContent = `import { Controller, Get, Post, Put, Delete } from '@nestjs/common';\nimport { ${entityCapital}Service } from './${entityLower}.service';\n\n@Controller()\nexport class ${entityCapital}Controller {\n  constructor(private readonly service: ${entityCapital}Service) {}\n`;

    for (const route of routes) {
      const decorator = route.method.charAt(0).toUpperCase() + route.method.slice(1).toLowerCase();
      const routePath = route.path.replace(/^\//, '');
      const pathArg = routePath ? `'${routePath}'` : '';
      
      controllerContent += `\n  @${decorator}(${pathArg})\n  ${route.handlerId}() {\n    return 'Action: ${route.action}';\n  }\n`;
    }
    controllerContent += `}\n`;
    fs[`src/${entityLower}/${entityLower}.controller.ts`] = controllerContent;

    fs[`src/${entityLower}/${entityLower}.module.ts`] = `import { Module } from '@nestjs/common';\nimport { ${entityCapital}Controller } from './${entityLower}.controller';\nimport { ${entityCapital}Service } from './${entityLower}.service';\n\n@Module({\n  controllers: [${entityCapital}Controller],\n  providers: [${entityCapital}Service],\n})\nexport class ${entityCapital}Module {}\n`;
  }

  const importsStr = ir.database.models
    .filter(m => activeModules.includes(`${m.tableName.charAt(0).toUpperCase() + m.tableName.slice(1)}Module`))
    .map(m => `import { ${m.tableName.charAt(0).toUpperCase() + m.tableName.slice(1)}Module } from './${m.tableName.toLowerCase()}/${m.tableName.toLowerCase()}.module';`)
    .join('\n');
    
  fs['src/app.module.ts'] = `import { Module } from '@nestjs/common';\n${importsStr}\n\n@Module({\n  imports: [${activeModules.join(', ')}],\n})\nexport class AppModule {}\n`;

  return fs;
};