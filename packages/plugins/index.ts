import { BackendIR, GeneratedArtifacts } from "@repo/types";
import { generatePrismaSchema } from "./prismaGenerator";
// Import Dev A's generator. Adjust the local path if Dev A placed it elsewhere in the package.
import { generateNestJSApp } from "./nestjsGenerator"; 

/**
 * The Plugin Registry executes all enabled generators against the BackendIR.
 */
export const executeGenerators = (ir: BackendIR): GeneratedArtifacts => {
  const artifacts: GeneratedArtifacts = {};

  // 1. Prisma Generator (Existing functionality preserved)
  if (ir.database && ir.database.models.length > 0) {
    artifacts.prisma = generatePrismaSchema(ir.database);
  }

  // 2. NestJS Generator (Sprint 4)
  // Invoked directly without try/catch to ensure exceptions remain observable to the caller.
  const rawFileSystem = generateNestJSApp(ir);

  // 3. Guarantee POSIX-style relative paths for cross-platform determinism
  const posixFileSystem: Record<string, string> = {};
  for (const [filePath, content] of Object.entries(rawFileSystem)) {
    const posixPath = filePath.replace(/\\/g, '/');
    posixFileSystem[posixPath] = content;
  }

  // Assign to the canonical framework-agnostic contract field
  artifacts.fileSystem = posixFileSystem;

  return artifacts;
};