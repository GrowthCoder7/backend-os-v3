"use client";

import { useState } from "react";
import { useGraphStore } from "@repo/store";
import { validateGraph } from "@repo/validation";
import { ArchitectureGraph, Entity, Field, FieldType } from "@repo/types";

export function EntityBuilder() {
  const addEntity = useGraphStore((state) => state.addEntity);
  const currentGraph = useGraphStore((state) => state.graph);

  const [name, setName] = useState("");
  const [primaryKey, setPrimaryKey] = useState("id");
  const [fields, setFields] = useState<Field[]>([{ name: "id", type: "string", required: true }]);
  const [error, setError] = useState<string | null>(null);

  const handleAddField = () => setFields([...fields, { name: "", type: "string", required: false }]);
  const handleUpdateField = (index: number, key: keyof Field, value: string | boolean) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value } as Field;
    setFields(newFields);
  };
  const handleRemoveField = (index: number) => setFields(fields.filter((_, i) => i !== index));

  const handleCreate = () => {
    const cleanName = name.trim();
    const cleanFields = fields.filter((f) => f.name.trim() !== "");

    if (!cleanName) { setError("Entity name is required."); return; }

    const newEntity: Entity = { name: cleanName, primaryKey: primaryKey.trim(), fields: cleanFields };
    const provisionalGraph: ArchitectureGraph = { ...currentGraph, entities: { ...currentGraph.entities, [cleanName]: newEntity } };

    const issues = validateGraph(provisionalGraph);
    const fatalErrors = issues.filter(issue => issue.severity === "error" && issue.nodeId === cleanName);

    if (fatalErrors.length > 0) {
      setError(fatalErrors.map(e => e.message).join(" | "));
      return;
    }

    try {
      addEntity(newEntity);
      setError(null);
      setName("");
      setPrimaryKey("id");
      setFields([{ name: "id", type: "string", required: true }]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const inputStyle = { flex: 1, padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "0.875rem" };

  return (
    <div style={{ background: "#ffffff", padding: "1.5rem", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}>
      <h2 style={{ marginBottom: "1.25rem", fontSize: "1.125rem", fontWeight: "600", color: "#111827" }}>Manual Entity Builder</h2>
      
      {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #fecaca" }}>⚠️ {error}</div>}

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <input placeholder="Entity Name (e.g., User)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input placeholder="Primary Key" value={primaryKey} onChange={(e) => setPrimaryKey(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.75rem", textTransform: "uppercase" }}>Fields</h3>
        {fields.map((field, index) => (
          <div key={index} style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", alignItems: "center" }}>
            <input placeholder="Field Name" value={field.name} onChange={(e) => handleUpdateField(index, "name", e.target.value)} style={{ ...inputStyle, flex: 2 }} />
            <select value={field.type} onChange={(e) => handleUpdateField(index, "type", e.target.value as FieldType)} style={inputStyle}>
              <option value="string">string</option><option value="number">number</option>
              <option value="boolean">boolean</option><option value="datetime">datetime</option>
              <option value="relation">relation</option><option value="json">json</option><option value="enum">enum</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.875rem", color: "#4b5563", cursor: "pointer" }}>
              <input type="checkbox" checked={field.required} onChange={(e) => handleUpdateField(index, "required", e.target.checked)} /> Req
            </label>
            <button onClick={() => handleRemoveField(index)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.2rem", padding: "0 0.5rem" }} title="Remove Field">×</button>
          </div>
        ))}
        <button onClick={handleAddField} style={{ background: "#f3f4f6", border: "1px dashed #d1d5db", color: "#4b5563", padding: "0.6rem", borderRadius: "6px", cursor: "pointer", width: "100%", fontSize: "0.875rem", fontWeight: "500", marginTop: "0.5rem", transition: "background 0.2s" }}>
          + Add Field
        </button>
      </div>

      <button onClick={handleCreate} style={{ width: "100%", padding: "0.75rem", background: "#111827", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", transition: "background 0.2s" }}>
        Inject Entity to AST
      </button>
    </div>
  );
}