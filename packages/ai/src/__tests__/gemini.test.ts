import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiProvider } from "../gemini";
import { ArchitectureGraph } from "@repo/types";

// Hoist mock state so it can be shared between the tests and the hoisted vi.mock block
const mockState = vi.hoisted(() => ({
  callCounter: 0,
  capturedRetryPrompt: ""
}));

// Mock the current @google/genai SDK boundary
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockImplementation(async (params: { contents: string, model?: string }) => {
          const prompt = params.contents;
          mockState.callCounter++;
          
          if (mockState.callCounter > 1) {
            mockState.capturedRetryPrompt = prompt;
          }

          // --- SPRINT 8 REGRESSION TEST FIXTURE ---
          if (prompt.includes("regression_payload_structure")) {
            if (mockState.callCounter === 1) {
              // ATTEMPT 1: Malformed output missing the 'payload' wrapper (3 operations)
              return {
                text: JSON.stringify({
                  status: "success",
                  operations: [
                    { type: "entity.create", entity: { name: "User", primaryKey: "id", fields: [] } },
                    { type: "relation.create", relation: { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-many" } },
                    { type: "endpoint.create", endpoint: { method: "GET", path: "/users", entity: "User", action: "read" } }
                  ]
                })
              };
            }
            if (mockState.callCounter === 2) {
              // ATTEMPT 2: Corrected output conforming to the Strict Zod Union (3 operations)
              return {
                text: JSON.stringify({
                  status: "success",
                  operations: [
                    { type: "entity.create", payload: { entity: { name: "User", primaryKey: "id", fields: [{ name: "id", type: "string", required: true }] } } },
                    { type: "relation.create", payload: { relation: { source: "User", sourceField: "id", target: "Post", targetField: "userId", type: "one-to-many" } } },
                    { type: "endpoint.create", payload: { endpoint: { method: "GET", path: "/users", entity: "User", action: "read" } } }
                  ]
                })
              };
            }
          }

          // --- RETRY LOOP FIXTURES ---
          if (prompt.includes("retry_success")) {
            if (mockState.callCounter === 1) return { text: "INVALID_JSON_STRING" };
            if (mockState.callCounter === 2) return { text: JSON.stringify({ status: "success", operations: [{ type: "entity.create", invalidPayload: true }] }) };
            return { text: JSON.stringify({ status: "success", operations: [{ type: "entity.delete", payload: { name: "User1" } }] }) };
          }

          if (prompt.includes("retry_fail")) {
            return { text: "ALWAYS_BAD_JSON" };
          }

          // --- FLAGSHIP CONTEXT FIXTURE ---
          if (prompt.includes("flagship")) {
            return {
              text: JSON.stringify({
                status: "success",
                operations: [
                  { type: "entity.create", payload: { entity: { name: "Posts", primaryKey: "postId", fields: [{ name: "postId", type: "string", required: true }] } } },
                  { type: "relation.create", payload: { relation: { source: "User1", sourceField: "id", target: "Posts", targetField: "userId", type: "one-to-many" } } },
                  { type: "endpoint.create", payload: { endpoint: { method: "GET", path: "/posts", entity: "Posts", action: "read" } } },
                  { type: "endpoint.create", payload: { endpoint: { method: "POST", path: "/post", entity: "Posts", action: "create" } } }
                ]
              })
            };
          }

          // Default fallback (Success)
          return {
            text: JSON.stringify({
              status: "success",
              operations: [{ type: "entity.delete", payload: { name: "User1" } }]
            })
          };
        })
      }
    }))
  };
});

describe("GeminiProvider - Sprint 8 Regression & Retries", () => {
  const mockGraph: ArchitectureGraph = {
    metadata: { id: "1", name: "t", createdAt: "1", updatedAt: "1", compilerVersion: "1", schemaVersion: "1" },
    entities: {
      "User1": {
        name: "User1", primaryKey: "id",
        fields: [{ name: "id", type: "string", required: true }, { name: "name", type: "string", required: true }, { name: "email", type: "string", required: true }]
      }
    },
    relations: [], endpoints: [], events: {}, workflows: []
  };

  beforeEach(() => {
    mockState.callCounter = 0;
    mockState.capturedRetryPrompt = "";
  });

  it("regression: recovers from the legacy missing-payload hallucination via strict Zod retry mechanism", async () => {
    const provider = new GeminiProvider("mock-key");
    
    const result = await provider.generateIntent({ 
      prompt: "regression_payload_structure", 
      graph: mockGraph 
    });

    // 1. Verify exactly 2 model calls occurred for this test
    expect(mockState.callCounter).toBe(2);
    
    // 2. Verify the final result was successfully extracted
    expect(result.status).toBe("success");
    
    // 3. Final result contains exactly 3 operations
    expect(result.operations.length).toBe(3);
    
    // 4. Verify final operations contain the correct nested payload structure
    expect(result.operations[0].type).toBe("entity.create");
    expect("payload" in result.operations[0]).toBe(true);
    expect(result.operations[1].type).toBe("relation.create");
    expect("payload" in result.operations[1]).toBe(true);
    expect(result.operations[2].type).toBe("endpoint.create");
    expect("payload" in result.operations[2]).toBe(true);

    // 5-10. Verify the retry prompt contains the necessary correction information robustly
    const retryPrompt = mockState.capturedRetryPrompt;
    
    // 5. Retry prompt contains "=== PREVIOUS ATTEMPT FAILED ==="
    expect(retryPrompt).toContain("=== PREVIOUS ATTEMPT FAILED ===");
    // 6. Retry prompt contains "Schema validation failed"
    expect(retryPrompt).toContain("Schema validation failed");
    // 7. Retry prompt contains the malformed previous output (using substring matching)
    expect(retryPrompt).toContain("previous malformed output");
    // 8. Retry prompt explicitly instructs the model to use "payload"
    expect(retryPrompt).toContain("payload");
    // 9. Retry prompt contains "entity.create" without relying on whitespace
    expect(retryPrompt).toMatch(/"type"\s*:\s*"entity\.create"/);
    // 10. Retry prompt contains the schema correction instruction
    expect(retryPrompt).toContain(`{ "type": "...", "payload": { ... } }`);
  });

  it("executes flagship test correctly avoiding recreation of existing entities", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "flagship", graph: mockGraph });

    expect(result.status).toBe("success");
    expect(result.operations.length).toBe(4);
    
    // User1 entity.create should not exist
    const hasUser1Create = result.operations.some(op => op.type === "entity.create" && (op.payload as any).entity?.name === "User1");
    expect(hasUser1Create).toBe(false);
  });

  it("retries up to 3 times and succeeds on the 3rd attempt", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "retry_success", graph: mockGraph });

    expect(mockState.callCounter).toBe(3);
    expect(result.status).toBe("success");
    expect(result.operations[0].type).toBe("entity.delete");
  });

  it("returns gracefully formatted error after 3 failed attempts", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "retry_fail", graph: mockGraph });

    expect(mockState.callCounter).toBe(3);
    expect(result.status).toBe("error");
    expect(result.message).toContain("Max Retries Exceeded");
    expect(result.message).toContain("Malformed JSON");
  });
});