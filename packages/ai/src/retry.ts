import { AIError } from "./errors";

export const MAX_AI_ATTEMPTS = 3;

export async function withRetry<T>(
  operation: (attempt: number, lastError?: AIError) => Promise<T>
): Promise<T> {
  let lastError: AIError | undefined;
  
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    try {
      return await operation(attempt, lastError);
    } catch (error: unknown) {
      if (error instanceof AIError) {
        lastError = error;
        if (attempt === MAX_AI_ATTEMPTS) {
          throw lastError; // Max retries exceeded
        }
      } else {
        // Unhandled non-AI system errors shouldn't be retried
        throw error;
      }
    }
  }
  
  throw lastError;
}