"use client";

import React, { useState, useEffect } from "react";
import { useGraphStore } from "@repo/store";
import { Endpoint } from "@repo/types";

export function EndpointBuilder({ initialData, onClose }: { initialData?: Endpoint; onClose?: () => void }) {
  const isEdit = !!initialData;
  const addEndpoint = useGraphStore((state) => state.addEndpoint);
  const updateEndpoint = useGraphStore((state) => state.updateEndpoint);
  const graph = useGraphStore((state) => state.graph);

  const entities = Object.keys(graph.entities);

  const [method, setMethod] = useState<Endpoint["method"]>(initialData?.method || "GET");
  const [path, setPath] = useState(initialData?.path || "");
  const [entity, setEntity] = useState(initialData?.entity || "");
  const [action, setAction] = useState<Endpoint["action"]>(initialData?.action || "read");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setMethod(initialData.method); setPath(initialData.path);
      setEntity(initialData.entity); setAction(initialData.action);
    }
  }, [initialData]);

  useEffect(() => {
    if (entity && !graph.entities[entity]) setEntity("");
  }, [graph.entities, entity]);

  const handleSave = () => {
    const cleanPath = path.trim();
    if (!cleanPath || !entity) { setError("Path and target entity are required."); return; }

    try {
      const payload: Endpoint = { method, path: cleanPath, entity, action };
      if (isEdit && initialData) {
        updateEndpoint({ method: initialData.method, path: initialData.path }, payload);
      } else {
        addEndpoint(payload);
      }
      setError(null);
      if (!isEdit) setPath("");
      if (onClose) onClose();
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Operation failed.");
    }
  };

  const inputStyle = { flex: 1, padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "0.875rem", background: "#fff" };

  return (
    <div style={{ background: "#ffffff", padding: "1.5rem", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
      <h2 style={{ marginBottom: "1.25rem", fontSize: "1.125rem", fontWeight: "600", color: "#111827" }}>{isEdit ? "Edit Endpoint" : "Create Endpoint"}</h2>
      {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #fecaca" }}>⚠️ {error}</div>}

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <select value={method} onChange={(e) => setMethod(e.target.value as Endpoint["method"])} style={inputStyle}>
          <option value="GET">GET</option><option value="POST">POST</option>
          <option value="PUT">PUT</option><option value="DELETE">DELETE</option>
        </select>
        <input placeholder="Path (e.g., /api/users)" value={path} onChange={(e) => setPath(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} style={inputStyle}>
          <option value="">Target Entity</option>
          {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value as Endpoint["action"])} style={inputStyle}>
          <option value="create">Create</option><option value="read">Read</option>
          <option value="update">Update</option><option value="delete">Delete</option>
        </select>
      </div>

      <button onClick={handleSave} style={{ width: "100%", padding: "0.75rem", background: "#111827", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
        {isEdit ? "Update Endpoint" : "Inject Endpoint to AST"}
      </button>
    </div>
  );
}