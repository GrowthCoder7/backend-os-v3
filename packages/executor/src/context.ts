import { ArchitectureGraph } from "@repo/types";
import { ValidationIssue } from "@repo/validation";

export interface ExecutionServices {
  // Extensible record for future injected services (logging, metrics, telemetry)
  [key: string]: unknown;
}

export interface ValidationService {
  validate: (graph: ArchitectureGraph) => ValidationIssue[];
}

export interface ExecutionContext {
  graph: ArchitectureGraph;
  services: ExecutionServices;
  validation: ValidationService;
}