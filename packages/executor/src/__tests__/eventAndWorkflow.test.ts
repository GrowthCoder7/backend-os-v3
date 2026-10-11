import { describe, it, expect } from "vitest";
import { ArchitectureGraph } from "@repo/types";
import { validateGraph } from "@repo/validation";

import { EventCreateHandler } from "../handlers/event/create";
import { EventUpdateHandler } from "../handlers/event/update";
import { EventDeleteHandler } from "../handlers/event/delete";

import { WorkflowCreateHandler } from "../handlers/workflow/create";
import { WorkflowUpdateHandler } from "../handlers/workflow/update";
import { WorkflowDeleteHandler } from "../handlers/workflow/delete";

import { 
  createEventOperation, updateEventOperation, deleteEventOperation, 
  createWorkflowOperation, updateWorkflowOperation, deleteWorkflowOperation 
} from "@repo/operations";

const getValidEmptyGraph = (): ArchitectureGraph => ({
  metadata: { id: "test", name: "test", createdAt: "1", updatedAt: "1", compilerVersion: "1.0.0", schemaVersion: "1.0.0" },
  entities: {}, 
  relations: [], 
  endpoints: [], 
  events: {}, 
  workflows: []
});

describe("Event and Workflow Handlers (Integration with @repo/validation)", () => {
  
  describe("Event Operations", () => {
    it("create succeeds and fails gracefully on duplicate", () => {
      const graph = getValidEmptyGraph();
      const ctx = { graph, services: {}, validation: { validate: validateGraph } };
      const handler = new EventCreateHandler();
      
      const op = createEventOperation({ event: { name: "UserSignedUp", payloadSchema: {} } });
      
      const res = handler.execute(op, ctx);
      expect(res.success).toBe(true);
      expect(res.graph).not.toBe(graph); 
      expect(graph.events["UserSignedUp"]).toBeUndefined(); 
      expect(res.graph.events["UserSignedUp"]).toBeDefined();
      
      const resFail = handler.execute(op, { ...ctx, graph: res.graph });
      expect(resFail.success).toBe(false);
      expect(resFail.graph).toBe(res.graph); 
      expect(resFail.graph.events["UserSignedUp"]).toBeDefined(); 
    });

    it("update succeeds, fails on missing or name collision", () => {
      const graph = getValidEmptyGraph();
      graph.events["EvtA"] = { name: "EvtA", payloadSchema: {} };
      graph.events["EvtB"] = { name: "EvtB", payloadSchema: {} };
      const ctx = { graph, services: {}, validation: { validate: validateGraph } };
      
      const handler = new EventUpdateHandler();
      
      const resMiss = handler.execute(updateEventOperation({ name: "EvtX", partialEvent: {} }), ctx);
      expect(resMiss.success).toBe(false);
      expect(resMiss.graph).toBe(graph); 
      expect(resMiss.graph.events["EvtA"]).toBeDefined();

      const resCol = handler.execute(updateEventOperation({ name: "EvtA", partialEvent: { name: "EvtB" } }), ctx);
      expect(resCol.success).toBe(false);
      expect(resCol.graph).toBe(graph); 
      expect(resCol.graph.events["EvtA"].name).toBe("EvtA"); 

      const resOk = handler.execute(updateEventOperation({ name: "EvtA", partialEvent: { name: "EvtA_New" } }), ctx);
      expect(resOk.success).toBe(true);
      expect(resOk.graph).not.toBe(graph); 
      expect(graph.events["EvtA"]).toBeDefined(); 
      expect(resOk.graph.events["EvtA_New"]).toBeDefined();
      expect(resOk.graph.events["EvtA"]).toBeUndefined();
    });

    it("delete succeeds, fails on missing", () => {
      const graph = getValidEmptyGraph();
      graph.events["EvtA"] = { name: "EvtA", payloadSchema: {} };
      const ctx = { graph, services: {}, validation: { validate: validateGraph } };
      
      const handler = new EventDeleteHandler();
      
      const resMiss = handler.execute(deleteEventOperation({ name: "Missing" }), ctx);
      expect(resMiss.success).toBe(false);
      expect(resMiss.graph).toBe(graph); 
      expect(resMiss.graph.events["EvtA"]).toBeDefined();

      const resOk = handler.execute(deleteEventOperation({ name: "EvtA" }), ctx);
      expect(resOk.success).toBe(true);
      expect(resOk.graph).not.toBe(graph); 
      expect(graph.events["EvtA"]).toBeDefined(); 
      expect(resOk.graph.events["EvtA"]).toBeUndefined();
    });

    it("fails to delete or rename an event referenced by a workflow and preserves graph", () => {
      const graph = getValidEmptyGraph();
      graph.events["UserSignedUp"] = { name: "UserSignedUp", payloadSchema: {} };
      graph.workflows.push({ triggerEvent: "UserSignedUp", steps: [] });
      
      const ctx = { graph, services: {}, validation: { validate: validateGraph } };
      
      const delHandler = new EventDeleteHandler();
      const updHandler = new EventUpdateHandler();
      
      const resDel = delHandler.execute(deleteEventOperation({ name: "UserSignedUp" }), ctx);
      expect(resDel.success).toBe(false);
      expect(resDel.diagnostics.some(d => d.type === "workflow" && d.severity === "error")).toBe(true);
      expect(resDel.graph).toBe(graph); 
      expect(resDel.graph.events["UserSignedUp"]).toBeDefined(); 
      
      const resRen = updHandler.execute(updateEventOperation({ name: "UserSignedUp", partialEvent: { name: "UserDeleted" } }), ctx);
      expect(resRen.success).toBe(false);
      expect(resRen.diagnostics.some(d => d.type === "workflow" && d.severity === "error")).toBe(true);
      expect(resRen.graph).toBe(graph); 
      expect(resRen.graph.events["UserSignedUp"].name).toBe("UserSignedUp"); 
    });
  });

  describe("Workflow Operations", () => {
    it("create succeeds, but fails on duplicate or missing trigger event", () => {
      const graph = getValidEmptyGraph();
      graph.events["TriggerA"] = { name: "TriggerA", payloadSchema: {} };
      const ctx = { graph, services: {}, validation: { validate: validateGraph } };
      
      const handler = new WorkflowCreateHandler();
      const opValid = createWorkflowOperation({ workflow: { triggerEvent: "TriggerA", steps: [] } });
      const opInvalid = createWorkflowOperation({ workflow: { triggerEvent: "MissingTrigger", steps: [] } });
      
      const resMiss = handler.execute(opInvalid, ctx);
      expect(resMiss.success).toBe(false);
      expect(resMiss.graph).toBe(graph); 
      expect(resMiss.graph.workflows.length).toBe(0);

      const resOk = handler.execute(opValid, ctx);
      expect(resOk.success).toBe(true);
      expect(resOk.graph).not.toBe(graph); 
      expect(graph.workflows.length).toBe(0); 
      expect(resOk.graph.workflows.length).toBe(1);

      const resDup = handler.execute(opValid, { ...ctx, graph: resOk.graph });
      expect(resDup.success).toBe(false);
      expect(resDup.graph).toBe(resOk.graph); 
    });

    it("update succeeds, fails on ambiguity, missing, or collision", () => {
      const graph = getValidEmptyGraph();
      graph.events["Evt1"] = { name: "Evt1", payloadSchema: {} };
      graph.events["Evt2"] = { name: "Evt2", payloadSchema: {} };
      graph.workflows.push({ triggerEvent: "Evt1", steps: [{ name: "Original", type: "core" }] });
      graph.workflows.push({ triggerEvent: "Evt2", steps: [] });
      const ctx = { graph, services: {}, validation: { validate: validateGraph } };
      
      const handler = new WorkflowUpdateHandler();
      
      const resOk = handler.execute(updateWorkflowOperation({ lookup: { triggerEvent: "Evt1" }, partialWorkflow: { steps: [{ name: "Updated", type: "core" }] } }), ctx);
      expect(resOk.success).toBe(true);
      expect(resOk.graph).not.toBe(graph);
      expect(graph.workflows.find(w => w.triggerEvent === "Evt1")?.steps[0].name).toBe("Original"); 
      expect(resOk.graph.workflows.find(w => w.triggerEvent === "Evt1")?.steps[0].name).toBe("Updated");

      const resMiss = handler.execute(updateWorkflowOperation({ lookup: { triggerEvent: "Evt3" }, partialWorkflow: {} }), ctx);
      expect(resMiss.success).toBe(false);
      expect(resMiss.graph).toBe(graph); 

      const resCol = handler.execute(updateWorkflowOperation({ lookup: { triggerEvent: "Evt1" }, partialWorkflow: { triggerEvent: "Evt2" } }), ctx);
      expect(resCol.success).toBe(false);
      expect(resCol.graph).toBe(graph); 

      const resBadValidation = handler.execute(updateWorkflowOperation({ lookup: { triggerEvent: "Evt1" }, partialWorkflow: { triggerEvent: "NonExistent" } }), ctx);
      expect(resBadValidation.success).toBe(false);
      expect(resBadValidation.graph).toBe(graph); 

      const ambiguousGraph = getValidEmptyGraph();
      ambiguousGraph.workflows.push({ triggerEvent: "DupTrigger", steps: [] }, { triggerEvent: "DupTrigger", steps: [] });
      const resAmbiguous = handler.execute(
        updateWorkflowOperation({ lookup: { triggerEvent: "DupTrigger" }, partialWorkflow: { steps: [{ name: "U", type: "core" }] } }), 
        { ...ctx, graph: ambiguousGraph }
      );
      expect(resAmbiguous.success).toBe(false);
      expect(resAmbiguous.graph).toBe(ambiguousGraph);
      expect(resAmbiguous.diagnostics[0].message).toContain("Ambiguous");
    });

    it("delete succeeds, fails on missing or ambiguity", () => {
      const graph = getValidEmptyGraph();
      graph.events["Evt1"] = { name: "Evt1", payloadSchema: {} };
      graph.workflows.push({ triggerEvent: "Evt1", steps: [] });
      const ctx = { graph, services: {}, validation: { validate: validateGraph } };
      
      const handler = new WorkflowDeleteHandler();
      
      const resFail = handler.execute(deleteWorkflowOperation({ lookup: { triggerEvent: "Evt2" } }), ctx);
      expect(resFail.success).toBe(false);
      expect(resFail.graph).toBe(graph); 
      expect(resFail.graph.workflows.length).toBe(1);

      const resOk = handler.execute(deleteWorkflowOperation({ lookup: { triggerEvent: "Evt1" } }), ctx);
      expect(resOk.success).toBe(true);
      expect(resOk.graph).not.toBe(graph); 
      expect(graph.workflows.length).toBe(1); 
      expect(resOk.graph.workflows.length).toBe(0);

      // Ambiguity
      const ambiguousGraph = getValidEmptyGraph();
      ambiguousGraph.workflows.push({ triggerEvent: "DupTrigger", steps: [] }, { triggerEvent: "DupTrigger", steps: [] });
      const resAmbiguous = handler.execute(
        deleteWorkflowOperation({ lookup: { triggerEvent: "DupTrigger" } }), 
        { ...ctx, graph: ambiguousGraph }
      );
      expect(resAmbiguous.success).toBe(false);
      expect(resAmbiguous.graph).toBe(ambiguousGraph);
      expect(resAmbiguous.diagnostics[0].message).toContain("Ambiguous");
    });
  });
});