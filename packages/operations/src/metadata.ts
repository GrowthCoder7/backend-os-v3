export interface OperationMetadata {
  timestamp: string;
  source: "builder" | "ai" | "cli" | "import";
  version: number;
}