import { describe, it, expect, vi } from "vitest";
import { GeminiProvider } from "../gemini";

// Mock @google/genai current SDK API
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockImplementation(async (params: { contents: string }) => {
          const prompt = params.contents;

          if (prompt.includes("ambiguous")) {
            return {
              text: JSON.stringify({
                status: "needs_clarification",
                message: "Please specify fields for the entity.",
                operations: [],
              }),
            };
          }

          if (prompt.includes("broken_json")) {
            return { text: "INVALID_JSON_STRING" };
          }

          if (prompt.includes("unsupported_op")) {
            return {
              text: JSON.stringify({
                status: "success",
                operations: [{ type: "unsupported.op", payload: {} }],
              }),
            };
          }

          if (prompt.includes("invalid_field_type")) {
            return {
              text: JSON.stringify({
                status: "success",
                operations: [
                  {
                    type: "entity.create",
                    payload: {
                      entity: {
                        name: "User",
                        primaryKey: "id",
                        fields: [{ name: "id", type: "uuid_invalid", required: true }],
                      },
                    },
                  },
                ],
              }),
            };
          }

          if (prompt.includes("invalid_http_method")) {
            return {
              text: JSON.stringify({
                status: "success",
                operations: [
                  {
                    type: "endpoint.create",
                    payload: {
                      endpoint: {
                        method: "PATCH",
                        path: "/users",
                        entity: "User",
                        action: "update",
                      },
                    },
                  },
                ],
              }),
            };
          }

          if (prompt.includes("unexpected_payload_property")) {
            return {
              text: JSON.stringify({
                status: "success",
                operations: [
                  {
                    type: "entity.delete",
                    payload: {
                      name: "User",
                      unexpectedHallucination: true,
                    },
                  },
                ],
              }),
            };
          }

          if (prompt.includes("contradictory_clarification")) {
            return {
              text: JSON.stringify({
                status: "needs_clarification",
                message: "What fields?",
                operations: [
                  {
                    type: "entity.delete",
                    payload: { name: "User" },
                  },
                ],
              }),
            };
          }

          if (prompt.includes("empty_success")) {
            return {
              text: JSON.stringify({
                status: "success",
                operations: [],
              }),
            };
          }

          if (prompt.includes("all_operations")) {
            return {
              text: JSON.stringify({
                status: "success",
                operations: [
                  {
                    type: "entity.create",
                    payload: {
                      entity: {
                        name: "User",
                        primaryKey: "id",
                        fields: [{ name: "id", type: "string", required: true }],
                      },
                    },
                  },
                  {
                    type: "entity.update",
                    payload: {
                      name: "User",
                      partialEntity: { primaryKey: "uuid" },
                    },
                  },
                  {
                    type: "entity.delete",
                    payload: { name: "User" },
                  },
                  {
                    type: "endpoint.create",
                    payload: {
                      endpoint: {
                        method: "GET",
                        path: "/users",
                        entity: "User",
                        action: "read",
                      },
                    },
                  },
                  {
                    type: "endpoint.update",
                    payload: {
                      lookup: { method: "GET", path: "/users" },
                      partialEndpoint: { path: "/all-users" },
                    },
                  },
                  {
                    type: "endpoint.delete",
                    payload: {
                      lookup: { method: "GET", path: "/all-users" },
                    },
                  },
                  {
                    type: "relation.create",
                    payload: {
                      relation: {
                        source: "User",
                        sourceField: "id",
                        target: "Post",
                        targetField: "userId",
                        type: "one-to-many",
                      },
                    },
                  },
                  {
                    type: "relation.update",
                    payload: {
                      lookup: {
                        source: "User",
                        sourceField: "id",
                        target: "Post",
                        targetField: "userId",
                      },
                      partialRelation: { type: "many-to-many" },
                    },
                  },
                  {
                    type: "relation.delete",
                    payload: {
                      lookup: {
                        source: "User",
                        sourceField: "id",
                        target: "Post",
                        targetField: "userId",
                      },
                    },
                  },
                ],
              }),
            };
          }

          // Default single create
          return {
            text: JSON.stringify({
              status: "success",
              operations: [
                {
                  type: "entity.create",
                  payload: {
                    entity: {
                      name: "User",
                      primaryKey: "id",
                      fields: [{ name: "id", type: "string", required: true }],
                    },
                  },
                },
              ],
            }),
          };
        }),
      },
    })),
  };
});

describe("GeminiProvider (Unit Tests - Network Free)", () => {
  it("throws deterministically if API key is not provided", () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(() => new GeminiProvider()).toThrow("GEMINI_API_KEY is not set.");
    process.env.GEMINI_API_KEY = originalKey;
  });

  it("accepts valid entity.create, update, delete, endpoints, and relations across all 9 operations", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "all_operations" });

    expect(result.status).toBe("success");
    expect(result.operations.length).toBe(9);

    const types = result.operations.map((op) => op.type);
    expect(types).toEqual([
      "entity.create",
      "entity.update",
      "entity.delete",
      "endpoint.create",
      "endpoint.update",
      "endpoint.delete",
      "relation.create",
      "relation.update",
      "relation.delete",
    ]);
  });

  it("rejects unsupported operation types via strict discriminated union", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "unsupported_op" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("AI output failed strict schema validation");
    expect(result.operations).toEqual([]);
  });

  it("rejects invalid FieldType enums", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "invalid_field_type" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("AI output failed strict schema validation");
  });

  it("rejects invalid HTTP methods", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "invalid_http_method" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("AI output failed strict schema validation");
  });

  it("rejects unexpected payload properties via .strict()", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({
      prompt: "unexpected_payload_property",
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("AI output failed strict schema validation");
  });

  it("returns error on malformed JSON", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "broken_json" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Malformed JSON from model");
  });

  it("enforces status invariant: needs_clarification requires zero operations", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({
      prompt: "contradictory_clarification",
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Invariant violation");
  });

  it("enforces status invariant: success requires at least 1 operation", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "empty_success" });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Invariant violation");
  });

  it("handles valid needs_clarification prompts", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "ambiguous" });

    expect(result.status).toBe("needs_clarification");
    expect(result.message).toBe("Please specify fields for the entity.");
    expect(result.operations).toEqual([]);
  });

  it("guarantees provider produces pure intent without id or OperationMetadata", async () => {
    const provider = new GeminiProvider("mock-key");
    const result = await provider.generateIntent({ prompt: "create user" });

    expect(result.status).toBe("success");
    const op = result.operations[0];
    expect(op).not.toHaveProperty("id");
    expect(op).not.toHaveProperty("metadata");
  });
});