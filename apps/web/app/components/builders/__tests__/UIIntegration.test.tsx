/**
 * @vitest-environment jsdom
 */
import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import Home from "../../../page";
import { HistoryToolbar } from "../../HistoryToolbar";
import { useGraphStore } from "@repo/store";
import type { ArchitectureGraph, Entity } from "@repo/types";

const getEmptyGraph = (): ArchitectureGraph => ({
  metadata: {
    id: "ui-integration-test",
    name: "UI Integration Test",
    createdAt: "",
    updatedAt: "",
    compilerVersion: "1.0",
    schemaVersion: "1.0",
  },
  entities: {},
  relations: [],
  endpoints: [],
  events: {},
  workflows: [],
});

function addEntityToStore(
  name: string,
  fieldNames: string[] = ["id"],
) {
  const fields: Entity["fields"] = fieldNames.map((fieldName) => ({
    name: fieldName,
    type: "string",
    required: true,
  }));

  useGraphStore.getState().addEntity({
    name,
    primaryKey: "id",
    fields,
  });
}

/**
 * Open a section only when it is closed.
 * Entity Manager starts open by default.
 */
function openDetails(label: string): HTMLDetailsElement {
  const labelNode = screen.getByText(label, { exact: true });
  const details = labelNode.closest("details");

  if (!(details instanceof HTMLDetailsElement)) {
    throw new Error(`Could not find the "${label}" section`);
  }

  if (!details.open) {
    const summary = details.querySelector("summary");

    if (!summary) {
      throw new Error(`The "${label}" section has no summary`);
    }

    fireEvent.click(summary);
  }

  expect(details.open).toBe(true);
  return details;
}

/**
 * Manager rows contain the selection and delete buttons.
 */
function clickDeleteInManagerRow(selectionButton: HTMLElement) {
  const row = selectionButton.parentElement;

  if (!row) {
    throw new Error("Could not find the object's manager row");
  }

  const buttons = within(row).getAllByRole("button");

  if (buttons.length < 2) {
    throw new Error("Expected selection and delete controls");
  }

  const deleteButton = buttons[buttons.length - 1];

  if (!deleteButton) {
    throw new Error("Delete button was not found");
  }

  fireEvent.click(deleteButton);
}

function expectVisibleError() {
  const warning = screen.getByText(/⚠️/);
  const message = warning.textContent?.replace("⚠️", "").trim();

  expect(message).toBeTruthy();
}

function getAstPreview(container: HTMLElement): HTMLElement {
  const preview = container.querySelector("pre");

  if (!preview) {
    throw new Error("Could not find the AST preview element");
  }

  return preview;
}

describe("Sprint 10 UI integration", () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph(getEmptyGraph());
  });

  afterEach(() => {
    cleanup();
  });

  // ---------------------------------------------------------
  // History toolbar and AST preview
  // ---------------------------------------------------------

  describe("History toolbar", () => {
    it("disables Undo and Redo when history is empty", () => {
      render(<HistoryToolbar />);

      const undoButton = screen.getByRole("button", {
        name: /undo/i,
      });
      const redoButton = screen.getByRole("button", {
        name: /redo/i,
      });

      expect((undoButton as HTMLButtonElement).disabled).toBe(true);
      expect((redoButton as HTMLButtonElement).disabled).toBe(true);
    });

    it("updates the rendered AST when Undo and Redo are clicked", async () => {
      addEntityToStore("LedgerRecord");

      const { container } = render(<Home />);

      expect(getAstPreview(container).textContent).toContain(
        '"LedgerRecord"',
      );

      const undoButton = screen.getByRole("button", {
        name: /undo/i,
      });

      expect((undoButton as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(undoButton);

      await waitFor(() => {
        expect(
          useGraphStore.getState().graph.entities.LedgerRecord,
        ).toBeUndefined();

        expect(getAstPreview(container).textContent).not.toContain(
          '"LedgerRecord"',
        );
      });

      const redoButton = screen.getByRole("button", {
        name: /redo/i,
      });

      expect((redoButton as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(redoButton);

      await waitFor(() => {
        expect(
          useGraphStore.getState().graph.entities.LedgerRecord,
        ).toBeDefined();

        expect(getAstPreview(container).textContent).toContain(
          '"LedgerRecord"',
        );
      });
    });

    it("clears the edit form when Undo removes its selected entity", async () => {
      addEntityToStore("TransientNode");

      render(<Home />);
      openDetails("Entity Manager");

      fireEvent.click(
        screen.getByRole("button", {
          name: "TransientNode",
        }),
      );

      expect(
        screen.getByText("Edit Entity: TransientNode"),
      ).toBeTruthy();

      fireEvent.click(
        screen.getByRole("button", { name: /undo/i }),
      );

      await waitFor(() => {
        expect(
          useGraphStore.getState().graph.entities.TransientNode,
        ).toBeUndefined();

        expect(
          screen.queryByText("Edit Entity: TransientNode"),
        ).toBeNull();
      });
    });
  });

  // ---------------------------------------------------------
  // Entity
  // ---------------------------------------------------------

  describe("Entity Builder", () => {
    it("creates, edits, and deletes an entity without duplication", () => {
      render(<Home />);
      openDetails("Entity Manager");

      fireEvent.change(
        screen.getByPlaceholderText("Entity Name"),
        { target: { value: "Customer" } },
      );

      fireEvent.click(screen.getByText("Inject Entity to AST"));

      expect(
        useGraphStore.getState().graph.entities.Customer,
      ).toBeDefined();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Customer",
        }),
      );

      // Keep the primary key and its field definition consistent.
      fireEvent.change(
        screen.getByPlaceholderText("Primary Key"),
        { target: { value: "customerId" } },
      );

      fireEvent.change(
        screen.getByPlaceholderText("Field Name"),
        { target: { value: "customerId" } },
      );

      fireEvent.click(screen.getByText("Update Entity"));

      const graph = useGraphStore.getState().graph;
      const customer = graph.entities.Customer;

      expect(Object.keys(graph.entities)).toEqual(["Customer"]);
      expect(customer).toBeDefined();

      if (!customer) {
        throw new Error("Customer entity was not created");
      }

      expect(customer.primaryKey).toBe("customerId");
      expect(
        customer.fields.some(
          (field) => field.name === "customerId",
        ),
      ).toBe(true);

      clickDeleteInManagerRow(
        screen.getByRole("button", {
          name: "Customer",
        }),
      );

      expect(
        useGraphStore.getState().graph.entities.Customer,
      ).toBeUndefined();
    });

    it("rejects an invalid primary key and preserves the entity", () => {
      addEntityToStore("Product");

      render(<Home />);
      openDetails("Entity Manager");

      fireEvent.click(
        screen.getByRole("button", {
          name: "Product",
        }),
      );

      fireEvent.change(
        screen.getByPlaceholderText("Primary Key"),
        { target: { value: "missingField" } },
      );

      fireEvent.click(screen.getByText("Update Entity"));

      const product = useGraphStore.getState().graph.entities.Product;

      expect(product).toBeDefined();

      if (!product) {
        throw new Error("Product entity was unexpectedly removed");
      }

      expect(product.primaryKey).toBe("id");
      expectVisibleError();
    });
  });

  // ---------------------------------------------------------
  // Relation
  // ---------------------------------------------------------

  describe("Relation Builder", () => {
    it("creates, edits, and deletes a relation without duplication", () => {
      addEntityToStore("User", ["id"]);
      addEntityToStore("Posts", ["id", "userId"]);

      render(<Home />);
      openDetails("Relation Manager");

      fireEvent.change(
        screen.getByDisplayValue("Select Source Entity"),
        { target: { value: "User" } },
      );

      fireEvent.change(
        screen.getByDisplayValue("Select Target Entity"),
        { target: { value: "Posts" } },
      );

      fireEvent.change(
        screen.getByDisplayValue("Select Source Field"),
        { target: { value: "id" } },
      );

      fireEvent.change(
        screen.getByDisplayValue("Select Target Field"),
        { target: { value: "userId" } },
      );

      fireEvent.click(screen.getByText("Inject Relation to AST"));

      const createdRelations =
        useGraphStore.getState().graph.relations;

      expect(createdRelations).toHaveLength(1);

      const createdRelation = createdRelations[0];
      expect(createdRelation).toBeDefined();

      if (!createdRelation) {
        throw new Error("Relation was not created");
      }

      fireEvent.click(
        screen.getByRole("button", {
          name: /User\.id.*Posts\.userId/,
        }),
      );

      fireEvent.change(screen.getByDisplayValue("One-to-Many"), {
        target: { value: "one-to-one" },
      });

      fireEvent.click(screen.getByText("Update Relation"));

      const relationsAfterEdit =
        useGraphStore.getState().graph.relations;

      expect(relationsAfterEdit).toHaveLength(1);

      const updatedRelation = relationsAfterEdit[0];
      expect(updatedRelation).toBeDefined();

      if (!updatedRelation) {
        throw new Error("Updated relation was not found");
      }

      expect(updatedRelation.type).toBe("one-to-one");

      clickDeleteInManagerRow(
        screen.getByRole("button", {
          name: /User\.id.*Posts\.userId/,
        }),
      );

      expect(
        useGraphStore.getState().graph.relations,
      ).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------
  // Endpoint
  // ---------------------------------------------------------

  describe("Endpoint Builder", () => {
    it("creates, edits, and deletes an endpoint without duplication", () => {
      addEntityToStore("User");

      render(<Home />);
      openDetails("Endpoint Manager");

      fireEvent.change(
        screen.getByPlaceholderText("Path (e.g., /api/users)"),
        { target: { value: "/api/users" } },
      );

      fireEvent.change(screen.getByDisplayValue("Target Entity"), {
        target: { value: "User" },
      });

      fireEvent.click(screen.getByText("Inject Endpoint to AST"));

      expect(
        useGraphStore.getState().graph.endpoints,
      ).toHaveLength(1);

      fireEvent.click(
        screen.getByRole("button", {
          name: "GET /api/users",
        }),
      );

      fireEvent.change(screen.getByDisplayValue("/api/users"), {
        target: { value: "/api/v1/users" },
      });

      fireEvent.click(screen.getByText("Update Endpoint"));

      const endpointsAfterEdit =
        useGraphStore.getState().graph.endpoints;

      expect(endpointsAfterEdit).toHaveLength(1);

      const updatedEndpoint = endpointsAfterEdit[0];
      expect(updatedEndpoint).toBeDefined();

      if (!updatedEndpoint) {
        throw new Error("Updated endpoint was not found");
      }

      expect(updatedEndpoint.path).toBe("/api/v1/users");

      clickDeleteInManagerRow(
        screen.getByRole("button", {
          name: "GET /api/v1/users",
        }),
      );

      expect(
        useGraphStore.getState().graph.endpoints,
      ).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------
  // Event
  // ---------------------------------------------------------

  describe("Event Builder", () => {
    it("creates, edits, and deletes an unreferenced event", () => {
      render(<Home />);
      openDetails("Event Manager");

      fireEvent.change(
        screen.getByPlaceholderText(
          "Event Name (e.g., UserSignedUp)",
        ),
        { target: { value: "CustomerCreated" } },
      );

      fireEvent.click(screen.getByText("Inject Event to AST"));

      expect(
        useGraphStore.getState().graph.events.CustomerCreated,
      ).toBeDefined();

      fireEvent.click(
        screen.getByRole("button", {
          name: "CustomerCreated",
        }),
      );

      fireEvent.change(
        screen.getByPlaceholderText(
          "Event Name (e.g., UserSignedUp)",
        ),
        { target: { value: "CustomerRegistered" } },
      );

      fireEvent.click(screen.getByText("Update Event"));

      const eventsAfterEdit =
        useGraphStore.getState().graph.events;

      expect(eventsAfterEdit.CustomerCreated).toBeUndefined();
      expect(eventsAfterEdit.CustomerRegistered).toBeDefined();
      expect(Object.keys(eventsAfterEdit)).toHaveLength(1);

      clickDeleteInManagerRow(
        screen.getByRole("button", {
          name: "CustomerRegistered",
        }),
      );

      expect(
        useGraphStore.getState().graph.events.CustomerRegistered,
      ).toBeUndefined();
    });

    it("rejects deletion when a workflow references the event", () => {
      const store = useGraphStore.getState();

      store.addEvent({
        name: "InvoiceGenerated",
        payloadSchema: {},
      });

      store.addWorkflow({
        triggerEvent: "InvoiceGenerated",
        steps: [],
      });

      render(<Home />);
      openDetails("Event Manager");

      fireEvent.click(
        screen.getByTitle(
          "Deletion rejected if referenced by workflow",
        ),
      );

      expect(
        useGraphStore.getState().graph.events.InvoiceGenerated,
      ).toBeDefined();

      expectVisibleError();
    });
  });

  // ---------------------------------------------------------
  // Workflow
  // ---------------------------------------------------------

  describe("Workflow Builder", () => {
    it("creates, edits, and deletes a workflow without duplication", () => {
      useGraphStore.getState().addEvent({
        name: "PostCreated",
        payloadSchema: {},
      });

      render(<Home />);
      const workflowDetails = openDetails("Workflow Manager");

      fireEvent.change(
        screen.getByDisplayValue("Select Trigger Event"),
        { target: { value: "PostCreated" } },
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: /\+ Add Pipeline Step/i,
        }),
      );

      fireEvent.change(screen.getByPlaceholderText("Step Name"), {
        target: { value: "RecordPost" },
      });

      fireEvent.click(screen.getByText("Inject Workflow to AST"));

      const createdWorkflows =
        useGraphStore.getState().graph.workflows;

      expect(createdWorkflows).toHaveLength(1);

      const createdWorkflow = createdWorkflows[0];
      expect(createdWorkflow).toBeDefined();

      if (!createdWorkflow) {
        throw new Error("Workflow was not created");
      }

      const createdStep = createdWorkflow.steps[0];
      expect(createdStep).toBeDefined();

      if (!createdStep) {
        throw new Error("Workflow step was not created");
      }

      expect(createdStep.name).toBe("RecordPost");

      fireEvent.click(
        within(workflowDetails).getByRole("button", {
  name: "PostCreated",
})
      );

      fireEvent.change(screen.getByPlaceholderText("Step Name"), {
        target: { value: "PublishPost" },
      });

      fireEvent.click(screen.getByText("Update Workflow"));

      const workflowsAfterEdit =
        useGraphStore.getState().graph.workflows;

      expect(workflowsAfterEdit).toHaveLength(1);

      const updatedWorkflow = workflowsAfterEdit[0];
      expect(updatedWorkflow).toBeDefined();

      if (!updatedWorkflow) {
        throw new Error("Updated workflow was not found");
      }

      const updatedStep = updatedWorkflow.steps[0];
      expect(updatedStep).toBeDefined();

      if (!updatedStep) {
        throw new Error("Updated workflow step was not found");
      }

      expect(updatedStep.name).toBe("PublishPost");

      clickDeleteInManagerRow(
        within(workflowDetails).getByRole("button", {
  name: "PostCreated",
})
      );

      expect(
        useGraphStore.getState().graph.workflows,
      ).toHaveLength(0);
    });
  });
});