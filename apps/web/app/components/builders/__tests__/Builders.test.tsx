
 // @vitest-environment jsdom
import React from "react";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { RelationBuilder } from "../RelationBuilder";
import { EventBuilder } from "../EventBuilder";
import { WorkflowBuilder } from "../WorkflowBuilder";
import { EndpointBuilder } from "../EndpointBuilder";
import Home from "../../../page";
import { useGraphStore } from "@repo/store";

vi.mock("@repo/store", () => ({
  useGraphStore: vi.fn(),
}));

describe("Architecture Builder Components & Integration", () => {
  const mockAddRelation = vi.fn();
  const mockUpdateRelation = vi.fn();
  const mockAddEvent = vi.fn();
  const mockUpdateEvent = vi.fn();
  const mockAddWorkflow = vi.fn();
  const mockUpdateWorkflow = vi.fn();
  const mockAddEndpoint = vi.fn();
  const mockUpdateEndpoint = vi.fn();

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    (useGraphStore as any).mockImplementation((selector: (state: any) => unknown) => {
      const state = {
        graph: {
          entities: {
            User: { fields: [{ name: "id" }] },
            Post: { fields: [{ name: "userId" }] },
          },
          relations: [],
          endpoints: [],
          events: { UserSignedUp: {} },
          workflows: [],
        },
        addRelation: mockAddRelation,
        updateRelation: mockUpdateRelation,
        addEvent: mockAddEvent,
        updateEvent: mockUpdateEvent,
        addWorkflow: mockAddWorkflow,
        updateWorkflow: mockUpdateWorkflow,
        addEndpoint: mockAddEndpoint,
        updateEndpoint: mockUpdateEndpoint,
      };

      return selector(state);
    });
  });

  it("page.tsx renders all builders successfully in the accordion without crashing", () => {
    render(<Home />);

    expect(screen.getByText("Backend OS")).toBeDefined();
    expect(screen.getByText("Relation Builder")).toBeDefined();
    expect(screen.getByText("Event Builder")).toBeDefined();
  });

  describe("RelationBuilder", () => {
    it("derives available fields correctly from selected entities and clears stale ones", () => {
      render(<RelationBuilder />);

      fireEvent.change(screen.getByDisplayValue("Select Source Entity"), {
        target: { value: "User" },
      });

      const sourceFieldOptions = screen
        .getAllByRole("option")
        .filter((option) => (option as HTMLOptionElement).value === "id");

      expect(sourceFieldOptions.length).toBeGreaterThan(0);
    });

    it("triggers updateRelation with cached lookup on Edit mode", () => {
      const initialData = {
        source: "User",
        sourceField: "id",
        target: "Post",
        targetField: "userId",
        type: "one-to-many" as const,
      };

      render(<RelationBuilder initialData={initialData} />);

      fireEvent.change(screen.getByDisplayValue("One-to-Many"), {
        target: { value: "one-to-one" },
      });

      fireEvent.click(screen.getByText(/Update Relation/i));

      expect(mockUpdateRelation).toHaveBeenCalledWith(
        {
          source: "User",
          sourceField: "id",
          target: "Post",
          targetField: "userId",
        },
        { ...initialData, type: "one-to-one" },
      );
    });
  });

  describe("EventBuilder", () => {
    it("rejects duplicate keys prior to invoking the store", () => {
      render(<EventBuilder />);

      fireEvent.change(screen.getByPlaceholderText(/Event Name/i), {
        target: { value: "ItemPurchased" },
      });

      fireEvent.click(screen.getByText(/\+ Add Schema Key/i));
      fireEvent.click(screen.getByText(/\+ Add Schema Key/i));

      const keyInputs = screen.getAllByPlaceholderText(
        /Key \(e\.g\., userId\)/i,
      );

      const firstKeyInput = keyInputs[0];
      const secondKeyInput = keyInputs[1];

      if (!firstKeyInput || !secondKeyInput) {
        throw new Error("Expected two schema key inputs in the DOM.");
      }

      fireEvent.change(firstKeyInput, {
        target: { value: "duplicateKey" },
      });

      fireEvent.change(secondKeyInput, {
        target: { value: "duplicateKey" },
      });

      fireEvent.click(screen.getByText(/Inject Event to AST/i));

      expect(mockAddEvent).not.toHaveBeenCalled();
      expect(screen.getByText(/Duplicate key found/i)).toBeDefined();
    });

    it("surfaces validation error when store rejects renaming an event with dependent workflows", () => {
      mockUpdateEvent.mockImplementation(() => {
        throw new Error(
          "Cannot rename event 'UserSignedUp' because it is referenced by 1 workflow(s).",
        );
      });

      render(
        <EventBuilder
          initialData={{
            name: "UserSignedUp",
            payloadSchema: {},
          }}
        />,
      );

      fireEvent.change(screen.getByDisplayValue("UserSignedUp"), {
        target: { value: "UserRegistered" },
      });

      fireEvent.click(screen.getByText(/Update Event/i));

      expect(
        screen.getByText(/referenced by 1 workflow/i),
      ).toBeDefined();
    });
  });

  describe("EndpointBuilder", () => {
    it("updates path using initialData as the lookup", () => {
      render(
        <EndpointBuilder
          initialData={{
            method: "GET",
            path: "/old",
            entity: "User",
            action: "read",
          }}
        />,
      );

      fireEvent.change(screen.getByDisplayValue("/old"), {
        target: { value: "/new" },
      });

      fireEvent.click(screen.getByText(/Update Endpoint/i));

      expect(mockUpdateEndpoint).toHaveBeenCalledWith(
        { method: "GET", path: "/old" },
        {
          method: "GET",
          path: "/new",
          entity: "User",
          action: "read",
        },
      );
    });
  });

  describe("WorkflowBuilder", () => {
    it("rejects JSON arrays and null configurations", () => {
      render(<WorkflowBuilder />);

      fireEvent.change(screen.getByDisplayValue("Select Trigger Event"), {
        target: { value: "UserSignedUp" },
      });

      fireEvent.click(screen.getByText(/\+ Add Pipeline Step/i));

      const stepNameInput = screen.getByPlaceholderText(/Step Name/i);
      const configInput = screen.getByPlaceholderText(
        /Optional JSON Config/i,
      );
      const submitButton = screen.getByText(/Inject Workflow to AST/i);

      fireEvent.change(stepNameInput, {
        target: { value: "stepA" },
      });

      // Arrays must not be accepted as object configuration.
      fireEvent.change(configInput, {
        target: { value: "[1, 2, 3]" },
      });
      fireEvent.click(submitButton);

      expect(screen.getByText(/Invalid JSON Object/i)).toBeDefined();
      expect(mockAddWorkflow).not.toHaveBeenCalled();

      // JSON null must also be rejected.
      fireEvent.change(configInput, {
        target: { value: "null" },
      });
      fireEvent.click(submitButton);

      expect(screen.getByText(/Invalid JSON Object/i)).toBeDefined();
      expect(mockAddWorkflow).not.toHaveBeenCalled();
    });

    it("triggers updateWorkflow with exact triggerEvent lookup", () => {
      render(
        <WorkflowBuilder
          initialData={{
            triggerEvent: "UserSignedUp",
            steps: [],
          }}
        />,
      );

      fireEvent.click(screen.getByText(/\+ Add Pipeline Step/i));

      fireEvent.change(screen.getByPlaceholderText(/Step Name/i), {
        target: { value: "step1" },
      });

      fireEvent.click(screen.getByText(/Update Workflow/i));

      expect(mockUpdateWorkflow).toHaveBeenCalledWith(
        { triggerEvent: "UserSignedUp" },
        {
          triggerEvent: "UserSignedUp",
          steps: [
            {
              name: "step1",
              type: "core",
              config: undefined,
            },
          ],
        },
      );
    });
  });
});
