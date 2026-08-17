import { BackendIR, GeneratedArtifacts } from "@repo/types";
import { generatePrismaSchema } from "./prismaGenerator";
import { generateNestJSApp } from "./nestjsGenerator";

export { generateNestJSApp } from "./nestjsGenerator";

export const executeGenerators = (ir: BackendIR): GeneratedArtifacts => {
  const artifacts: GeneratedArtifacts = {};

  if (ir.database && ir.database.models.length > 0) {
    artifacts.prisma = generatePrismaSchema(ir.database);
  }

  artifacts.fileSystem = generateNestJSApp(ir);

  return artifacts;
};