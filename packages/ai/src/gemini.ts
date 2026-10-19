import { GoogleGenAI } from "@google/genai";
import { AIProvider, IntentRequest, IntentResponse } from "./types";
import { SYSTEM_PROMPT } from "./prompts";
import { IntentResponseSchema } from "./schema";
import { AIError } from "./errors";
import { withRetry } from "./retry";
import { serializeGraphContext } from "./context";

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    this.client = new GoogleGenAI({ apiKey: key });
  }

  async generateIntent(request: IntentRequest): Promise<IntentResponse> {
    const contextStr = serializeGraphContext(request.graph);
    
    try {
      return await withRetry(async (attempt: number, lastError?: AIError) => {
        let promptText = `User Request: ${request.prompt}\n\nCurrent Architecture Context:\n${contextStr}`;

        if (attempt > 1 && lastError) {
          promptText += `\n\n=== PREVIOUS ATTEMPT FAILED ===\nError Type: ${lastError.kind}\nMessage: ${lastError.message}\n`;
          if (lastError.rawOutput) {
            promptText += `Your previous malformed output:\n${lastError.rawOutput}\n`;
          }
          promptText += `\nPlease correct the output to strictly conform to the JSON schema. Ensure operations use exactly { "type": "...", "payload": { ... } } without extraneous fields.`;
        }

        let response;
        try {
          response = await this.client.models.generateContent({
            model: DEFAULT_GEMINI_MODEL,
            contents: promptText,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              responseMimeType: "application/json",
            },
          });
        } catch (apiErr) {
          throw new AIError("api", getErrorMessage(apiErr));
        }

        const rawText = response.text ?? "";
        const cleanedText = rawText.replace(/^```json/m, "").replace(/```$/m, "").trim();

        if (!cleanedText) {
          throw new AIError("api", "Empty response received from model.");
        }

        let rawJson: unknown;
        try {
          rawJson = JSON.parse(cleanedText);
        } catch (parseErr) {
          throw new AIError("json", `Malformed JSON: ${getErrorMessage(parseErr)}`, cleanedText);
        }

        const parseResult = IntentResponseSchema.safeParse(rawJson);
        if (!parseResult.success) {
          throw new AIError("schema", `Schema validation failed: ${parseResult.error.message}`, cleanedText);
        }

        const data = parseResult.data;

        if (data.status === "success" && data.operations.length === 0) {
          throw new AIError("invariant", "Status 'success' requires >= 1 operations.", cleanedText);
        }
        if ((data.status === "needs_clarification" || data.status === "error") && data.operations.length > 0) {
          throw new AIError("invariant", `Status '${data.status}' must contain zero operations.`, cleanedText);
        }
        if ((data.status === "needs_clarification" || data.status === "error") && (!data.message || data.message.trim() === "")) {
          throw new AIError("invariant", `Status '${data.status}' requires a non-empty message.`, cleanedText);
        }

        return data as IntentResponse;
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        message: `AI Intent Generation Failed (Max Retries Exceeded): ${msg}`,
        operations: [],
      };
    }
  }
}