import { describe, it, expect, vi } from "vitest";
import { GeminiProvider } from "../gemini";

// Mock the Google SDK to prevent live network calls during unit tests
vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockImplementation(async (prompt: string) => {
          if (prompt.includes("ambiguous")) {
            return { response: { text: () => JSON.stringify({ status: "needs_clarification", message: "What fields?", operations: [] }) } };
          }
          if (prompt.includes("invalid")) {
            return { response: { text: () => JSON.stringify({ status: "success", operations: [{ type: "made_up_type", payload: {} }] }) } }; // Will pass loose schema, but let's test strict parsing if we added it
          }
          if (prompt.includes("broken_json")) {
            return { response: { text: () => "not a json object" } };
          }
          // Success mock
          return {
            response: {
              text: () => JSON.stringify({
                status: "success",
                operations: [{ type: "entity.create", payload: { entity: { name: "User", primaryKey: "id", fields: [] } } }]
              })
            }
          };
        })
      })
    }))
  };
});

describe("GeminiProvider", () => {
  it("throws if no API key is provided and env is empty", () => {
    const originalEnv = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(() => new GeminiProvider()).toThrow("GEMINI_API_KEY is not set.");
    process.env.GEMINI_API_KEY = originalEnv; // Restore
  });

  it("parses successful structured output safely", async () => {
    const provider = new GeminiProvider("dummy-key");
    const result = await provider.generateIntent({ prompt: "Create a user" });
    
    expect(result.status).toBe("success");
    expect(result.operations.length).toBe(1);
    expect(result.operations[0].type).toBe("entity.create");
  });

  it("handles ambiguous requests by returning needs_clarification", async () => {
    const provider = new GeminiProvider("dummy-key");
    const result = await provider.generateIntent({ prompt: "ambiguous request" });
    
    expect(result.status).toBe("needs_clarification");
    expect(result.message).toBeDefined();
  });

  it("catches malformed JSON output and returns a safe error status", async () => {
    const provider = new GeminiProvider("dummy-key");
    const result = await provider.generateIntent({ prompt: "broken_json" });
    
    expect(result.status).toBe("error");
    expect(result.message).toContain("Failed to generate intent");
  });
});