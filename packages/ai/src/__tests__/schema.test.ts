import { describe, it, expect } from "vitest";
import { IntentResponseSchema } from "../schema";

describe("IntentResponseSchema — Event and Workflow Trust Boundary", () => {
  it("accepts valid payloads for all six Event and Workflow variants", () => {
    const validResponse = {
      status: "success",
      operations: [
        {
          type: "event.create",
          payload: { event: { name: "UserRegistered", payloadSchema: { email: "string", age: "number" } } }
        },
        {
          type: "event.update",
          payload: { name: "UserRegistered", partialEvent: { payloadSchema: { email: "string" } } }
        },
        {
          type: "event.delete",
          payload: { name: "UserRegistered" }
        },
        {
          type: "workflow.create",
          payload: {
            workflow: {
              triggerEvent: "UserRegistered",
              steps: [{ name: "sendEmail", type: "core", config: { template: "welcome" } }]
            }
          }
        },
        {
          type: "workflow.update",
          payload: {
            lookup: { triggerEvent: "UserRegistered" },
            partialWorkflow: { steps: [{ name: "notifyAdmin", type: "custom" }] }
          }
        },
        {
          type: "workflow.delete",
          payload: { lookup: { triggerEvent: "UserRegistered" } }
        }
      ]
    };

    const parsed = IntentResponseSchema.safeParse(validResponse);
    expect(parsed.success).toBe(true);
  });

  it("rejects event.create with invalid FieldTypeEnum value", () => {
    const invalid = {
      status: "success",
      operations: [
        {
          type: "event.create",
          payload: { event: { name: "InvalidEvent", payloadSchema: { field: "invalid_type" } } }
        }
      ]
    };
    expect(IntentResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects event.create missing nested payload object", () => {
    const invalid = {
      status: "success",
      operations: [{ type: "event.create", event: { name: "MissingPayload", payloadSchema: {} } }]
    };
    expect(IntentResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects workflow.create with invalid step type enum", () => {
    const invalid = {
      status: "success",
      operations: [
        {
          type: "workflow.create",
          payload: {
            workflow: { triggerEvent: "UserRegistered", steps: [{ name: "step", type: "unsupported" }] }
          }
        }
      ]
    };
    expect(IntentResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects workflow.delete containing unknown extraneous fields due to strict schema", () => {
    const invalid = {
      status: "success",
      operations: [
        {
          type: "workflow.delete",
          payload: { lookup: { triggerEvent: "UserRegistered" }, extraneousField: 123 }
        }
      ]
    };
    expect(IntentResponseSchema.safeParse(invalid).success).toBe(false);
  });
});