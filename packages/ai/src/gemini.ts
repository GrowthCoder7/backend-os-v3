import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIProvider, IntentRequest, IntentResponse } from "./types";
import { SYSTEM_PROMPT } from "./prompts";
import { IntentResponseSchema } from "./schema";

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    
    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
  }

  async generateIntent(request: IntentRequest): Promise<IntentResponse> {
    try {
      const result = await this.model.generateContent(request.prompt);
      const rawText = result.response.text();
      
      // Clean potential markdown blocks if the model ignores the mime type constraint
      const cleanedText = rawText.replace(/^```json/m, "").replace(/```$/m, "").trim();
      const rawJson = JSON.parse(cleanedText);

      // Validate structural safety
      const parsed = IntentResponseSchema.safeParse(rawJson);
      
      if (!parsed.success) {
        return {
          status: "error",
          message: `AI produced invalid architecture schema: ${parsed.error.message}`,
          operations: []
        };
      }

      return parsed.data as IntentResponse;
    } catch (error: any) {
      return {
        status: "error",
        message: `Failed to generate intent: ${error.message}`,
        operations: []
      };
    }
  }
}