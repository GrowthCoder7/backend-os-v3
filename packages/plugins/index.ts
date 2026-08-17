import { BackendIR, GeneratedArtifacts } from "@repo/types";
import { generatePrismaSchema } from "./prismaGenerator";

/**
 * The Plugin Registry executes all enabled generators against the BackendIR.
 */
export const executeGenerators = (ir: BackendIR): GeneratedArtifacts => {
  const artifacts: GeneratedArtifacts = {};

  // Execute Prisma Plugin
  if (ir.database && ir.database.models.length > 0) {
    artifacts.prisma = generatePrismaSchema(ir.database);
  }

  // Future: Execute REST Plugin, OpenAPI Plugin, etc.

  return artifacts;
};