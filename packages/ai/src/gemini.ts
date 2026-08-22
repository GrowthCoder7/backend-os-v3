import { GoogleGenAI } from "@google/genai";
import { AIProvider, IntentRequest, IntentResponse } from "./types";
import { SYSTEM_PROMPT } from "./prompts";
import { IntentResponseSchema } from "./schema";

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
    try {
      const response = await this.client.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: request.prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      });

      const rawText = response.text ?? "";
      const cleanedText = rawText.replace(/^```json/m, "").replace(/```$/m, "").trim();

      if (!cleanedText) {
        return {
          status: "error",
          message: "Empty response received from Gemini model.",
          operations: [],
        };
      }

      let rawJson: unknown;
      try {
        rawJson = JSON.parse(cleanedText);
      } catch (parseError) {
        return {
          status: "error",
          message: `Malformed JSON from model: ${getErrorMessage(parseError)}`,
          operations: [],
        };
      }

      const parseResult = IntentResponseSchema.safeParse(rawJson);
      if (!parseResult.success) {
        return {
          status: "error",
          message: `AI output failed strict schema validation: ${parseResult.error.message}`,
          operations: [],
        };
      }

      const data = parseResult.data;

      // Enforce Status Invariants
      if (data.status === "success") {
        if (data.operations.length === 0) {
          return {
            status: "error",
            message: "Invariant violation: status 'success' requires at least one operation.",
            operations: [],
          };
        }
      } else if (data.status === "needs_clarification" || data.status === "error") {
        if (data.operations.length > 0) {
          return {
            status: "error",
            message: `Invariant violation: status '${data.status}' must contain zero operations.`,
            operations: [],
          };
        }
        if (!data.message || data.message.trim() === "") {
          return {
            status: "error",
            message: `Invariant violation: status '${data.status}' requires a non-empty message.`,
            operations: [],
          };
        }
      }

      return data as IntentResponse;
    } catch (error: unknown) {
      return {
        status: "error",
        message: `Failed to generate intent: ${getErrorMessage(error)}`,
        operations: [],
      };
    }
  }
}