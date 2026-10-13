"use client";

import React, { useState, useEffect } from "react";
import { useGraphStore } from "@repo/store";
import { Relation } from "@repo/types";

export function RelationBuilder({ initialData, onClose }: { initialData?: Relation; onClose?: () => void }) {
  const isEdit = !!initialData;
  const addRelation = useGraphStore((state) => state.addRelation);
  const updateRelation = useGraphStore((state) => state.updateRelation);
  const graph = useGraphStore((state) => state.graph);

  const entities = Object.keys(graph.entities);

  const [source, setSource] = useState(initialData?.source || "");
  const [sourceField, setSourceField] = useState(initialData?.sourceField || "");
  const [target, setTarget] = useState(initialData?.target || "");
  const [targetField, setTargetField] = useState(initialData?.targetField || "");
  const [type, setType] = useState<Relation["type"]>(initialData?.type || "one-to-many");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setSource(initialData.source); setSourceField(initialData.sourceField);
      setTarget(initialData.target); setTargetField(initialData.targetField);
      setType(initialData.type);
    }
  }, [initialData]);

  useEffect(() => {
    if (source && !graph.entities[source]) { setSource(""); setSourceField(""); }
    if (target && !graph.entities[target]) { setTarget(""); setTargetField(""); }
  }, [graph.entities, source, target]);

  const sourceFields = source && graph.entities[source] ? graph.entities[source].fields.map(f => f.name) : [];
  const targetFields = target && graph.entities[target] ? graph.entities[target].fields.map(f => f.name) : [];

  useEffect(() => { if (sourceField && !sourceFields.includes(sourceField)) setSourceField(""); }, [sourceFields, sourceField]);
  useEffect(() => { if (targetField && !targetFields.includes(targetField)) setTargetField(""); }, [targetFields, targetField]);

  const handleSave = () => {
    if (!source || !sourceField || !target || !targetField) {
      setError("Source, Target, and their respective fields are required.");
      return;
    }

    try {
      const payload: Relation = { source, sourceField, target, targetField, type };
      if (isEdit && initialData) {
        updateRelation({
          source: initialData.source, sourceField: initialData.sourceField,
          target: initialData.target, targetField: initialData.targetField
        }, payload);
      } else {
        addRelation(payload);
      }
      setError(null);
      if (!isEdit) { setSourceField(""); setTargetField(""); }
      if (onClose) onClose();
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred.");
    }
  };

  const inputStyle = { flex: 1, padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "0.875rem", background: "#fff" };

  return (
    <div style={{ background: "#ffffff", padding: "1.5rem", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
      <h2 style={{ marginBottom: "1.25rem", fontSize: "1.125rem", fontWeight: "600", color: "#111827" }}>{isEdit ? "Edit Relation" : "Create Relation"}</h2>
      {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #fecaca" }}>⚠️ {error}</div>}

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
          <option value="">Select Source Entity</option>
          {entities.map(ent => <option key={`src-${ent}`} value={ent}>{ent}</option>)}
        </select>
        <select value={sourceField} onChange={(e) => setSourceField(e.target.value)} style={inputStyle} disabled={!source}>
          <option value="">Select Source Field</option>
          {sourceFields.map(f => <option key={`srcf-${f}`} value={f}>{f}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle}>
          <option value="">Select Target Entity</option>
          {entities.map(ent => <option key={`tgt-${ent}`} value={ent}>{ent}</option>)}
        </select>
        <select value={targetField} onChange={(e) => setTargetField(e.target.value)} style={inputStyle} disabled={!target}>
          <option value="">Select Target Field</option>
          {targetFields.map(f => <option key={`tgtf-${f}`} value={f}>{f}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <select value={type} onChange={(e) => setType(e.target.value as Relation["type"])} style={{ ...inputStyle, width: "100%" }}>
          <option value="one-to-one">One-to-One</option>
          <option value="one-to-many">One-to-Many</option>
          <option value="many-to-one">Many-to-One</option>
          <option value="many-to-many">Many-to-Many</option>
        </select>
      </div>

      <button onClick={handleSave} style={{ width: "100%", padding: "0.75rem", background: "#111827", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
        {isEdit ? "Update Relation" : "Inject Relation to AST"}
      </button>
    </div>
  );
}