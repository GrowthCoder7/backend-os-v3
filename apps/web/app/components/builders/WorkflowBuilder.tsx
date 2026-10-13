"use client";

import React, { useState, useEffect } from "react";
import { useGraphStore } from "@repo/store";
import { Workflow } from "@repo/types";

type StepInput = { name: string; type: "core" | "custom"; configStr: string };

export function WorkflowBuilder({ initialData, onClose }: { initialData?: Workflow; onClose?: () => void }) {
  const isEdit = !!initialData;
  const addWorkflow = useGraphStore((state) => state.addWorkflow);
  const updateWorkflow = useGraphStore((state) => state.updateWorkflow);
  const graph = useGraphStore((state) => state.graph);

  const eventNames = Object.keys(graph.events);

  const initialSteps = initialData 
    ? initialData.steps.map(s => ({ name: s.name, type: s.type, configStr: s.config ? JSON.stringify(s.config, null, 2) : "" }))
    : [];

  const [triggerEvent, setTriggerEvent] = useState(initialData?.triggerEvent || "");
  const [steps, setSteps] = useState<StepInput[]>(initialSteps);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTriggerEvent(initialData.triggerEvent);
      setSteps(initialData.steps.map(s => ({ name: s.name, type: s.type, configStr: s.config ? JSON.stringify(s.config, null, 2) : "" })));
    }
  }, [initialData]);

  useEffect(() => {
    if (triggerEvent && !graph.events[triggerEvent]) setTriggerEvent("");
  }, [graph.events, triggerEvent]);

  const handleAddStep = () => setSteps([...steps, { name: "", type: "core", configStr: "" }]);
  
  const handleUpdateStep = (index: number, field: keyof StepInput, value: string) => {
    setSteps((prev) => 
      prev.map((step, i) => {
        if (i !== index) return step;
        return { ...step, [field]: value } as StepInput;
      })
    );
  };
  
  const handleRemoveStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));

  const handleSave = () => {
    if (!triggerEvent) { setError("Trigger event is required."); return; }

    const parsedSteps = [];
    for (const step of steps) {
      if (!step.name.trim()) { setError("All steps must have a name."); return; }
      let config = undefined;
      if (step.configStr.trim()) {
        try {
          config = JSON.parse(step.configStr);
          if (typeof config !== "object" || Array.isArray(config) || config === null) {
             throw new Error();
          }
        } catch (e) {
          setError(`Invalid JSON Object configuration in step '${step.name}'.`);
          return;
        }
      }
      parsedSteps.push({ name: step.name.trim(), type: step.type, config });
    }

    try {
      const payload: Workflow = { triggerEvent, steps: parsedSteps };
      if (isEdit && initialData) {
        updateWorkflow({ triggerEvent: initialData.triggerEvent }, payload);
      } else {
        addWorkflow(payload);
      }
      setError(null);
      if (!isEdit) { setTriggerEvent(""); setSteps([]); }
      if (onClose) onClose();
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Operation failed.");
    }
  };

  const inputStyle = { flex: 1, padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "0.875rem", background: "#fff" };

  return (
    <div style={{ background: "#ffffff", padding: "1.5rem", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
      <h2 style={{ marginBottom: "1.25rem", fontSize: "1.125rem", fontWeight: "600", color: "#111827" }}>{isEdit ? "Edit Workflow" : "Workflow Builder"}</h2>
      {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #fecaca" }}>⚠️ {error}</div>}

      <div style={{ marginBottom: "1.5rem" }}>
        <select value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
          <option value="">Select Trigger Event</option>
          {eventNames.map(evt => <option key={evt} value={evt}>{evt}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.75rem" }}>Pipeline Steps</h3>
        {steps.map((step, index) => (
          <div key={index} style={{ background: "#f9fafb", padding: "0.75rem", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <input placeholder="Step Name" value={step.name} onChange={(e) => handleUpdateStep(index, "name", e.target.value)} style={{ ...inputStyle, flex: 2 }} />
              <select value={step.type} onChange={(e) => handleUpdateStep(index, "type", e.target.value as "core" | "custom")} style={inputStyle}>
                <option value="core">Core</option>
                <option value="custom">Custom</option>
              </select>
              <button onClick={() => handleRemoveStep(index)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.2rem", padding: "0 0.5rem" }}>×</button>
            </div>
            <textarea placeholder='Optional JSON Config (e.g., {"template": "welcome"})' value={step.configStr} onChange={(e) => handleUpdateStep(index, "configStr", e.target.value)} style={{ ...inputStyle, width: "100%", height: "60px", fontFamily: "monospace", resize: "vertical" }} />
          </div>
        ))}
        <button onClick={handleAddStep} style={{ background: "#f3f4f6", border: "1px dashed #d1d5db", color: "#4b5563", padding: "0.6rem", borderRadius: "6px", cursor: "pointer", width: "100%", fontSize: "0.875rem", fontWeight: "500" }}>
          + Add Pipeline Step
        </button>
      </div>

      <button onClick={handleSave} style={{ width: "100%", padding: "0.75rem", background: "#111827", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
        {isEdit ? "Update Workflow" : "Inject Workflow to AST"}
      </button>
    </div>
  );
}