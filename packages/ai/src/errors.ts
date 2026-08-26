export type AIErrorKind = "api" | "json" | "schema" | "invariant";

export class AIError extends Error {
  constructor(
    public kind: AIErrorKind,
    message: string,
    public rawOutput?: string
  ) {
    super(message);
    this.name = "AIError";
  }
}