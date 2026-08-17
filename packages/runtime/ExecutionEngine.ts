import { CompilerManifest } from "@repo/compiler";

export class ExecutionEngine {
  private manifest: CompilerManifest | null = null;
  private isReady: boolean = false;

  /**
   * Ingests the Intermediate Representation (IR) from the Compiler.
   * Rejects malformed manifests at the boundary.
   */
  public ingest(manifest: CompilerManifest): void {
    if (!manifest.models || !manifest.routes || !manifest.workflows) {
      throw new Error("[Runtime Error] Invalid CompilerManifest structure. Ingestion halted.");
    }
    
    this.manifest = manifest;
    this.isReady = true;
    
    console.info(`[Runtime Registry] Successfully ingested:
      - Models: ${manifest.models.length}
      - Routes: ${manifest.routes.length}
      - Workflows: ${manifest.workflows.length}`);
  }

  /**
   * Simulates the mounting of the runtime execution loop.
   */
  public start(): void {
    if (!this.isReady || !this.manifest) {
      throw new Error("[Runtime Error] Cannot start engine: Manifest not ingested.");
    }
    
    console.info("[Execution Engine] Runtime started. Registry mounted and awaiting execution triggers.");
  }
}