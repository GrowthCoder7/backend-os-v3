import { promises as fs } from "fs";
import * as path from "path";

export class ProjectMaterializer {
  public static async materialize(virtualFs: Record<string, string>, targetDir: string): Promise<void> {
    const absoluteTargetDir = path.resolve(targetDir);

    // PHASE 1: Strict Security Validation
    for (const virtualPath of Object.keys(virtualFs)) {
      if (
        virtualPath.startsWith("/") ||
        /^[a-zA-Z]:[\\/]/.test(virtualPath) ||
        virtualPath.startsWith("\\\\")
      ) {
        throw new Error(`Security Exception: Absolute path rejected -> ${virtualPath}`);
      }

      if (virtualPath.includes("../") || virtualPath.includes("..\\")) {
        throw new Error(`Security Exception: Traversal string rejected -> ${virtualPath}`);
      }

      const resolvedPath = path.resolve(absoluteTargetDir, virtualPath);
      const relativeToTarget = path.relative(absoluteTargetDir, resolvedPath);

      if (relativeToTarget.startsWith("..") || path.isAbsolute(relativeToTarget)) {
        throw new Error(`Security Exception: Path escapes target directory -> ${virtualPath}`);
      }
    }

    // PHASE 2: Materialization
    try {
      for (const [virtualPath, content] of Object.entries(virtualFs)) {
        const resolvedPath = path.resolve(absoluteTargetDir, virtualPath);
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content, "utf-8");
      }
    } catch (error) {
      await this.cleanup(targetDir);
      throw new Error(`Materialization failed during file writing. Partial directory cleaned. Original error: ${error}`);
    }
  }

  public static async cleanup(targetDir: string): Promise<void> {
    try {
      await fs.rm(path.resolve(targetDir), { recursive: true, force: true });
    } catch (e) {
      // safe to ignore if directory doesn't exist
    }
  }
}