"use client";

import { useState, useEffect } from "react";
import { useGraphStore } from "@repo/store";
import { validateGraph } from "@repo/validation";
import { ArchitectureGraph, Entity, Field, FieldType } from "@repo/types";

export function EntityBuilder({ initialData, onClose }: { initialData?: Entity; onClose?: () => void }) {
  const isEdit = !!initialData;
  const addEntity = useGraphStore((state) => state.addEntity);
  const updateEntity = useGraphStore((state) => state.updateEntity);
  const currentGraph = useGraphStore((state) => state.graph);

  const [name, setName] = useState(initialData?.name || "");
  const [primaryKey, setPrimaryKey] = useState(initialData?.primaryKey || "id");
  const [fields, setFields] = useState<Field[]>(initialData?.fields || [{ name: "id", type: "string", required: true }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPrimaryKey(initialData.primaryKey);
      setFields(initialData.fields);
    } else {
      setName("");
      setPrimaryKey("id");
      setFields([{ name: "id", type: "string", required: true }]);
    }
  }, [initialData]);

  const handleAddField = () => setFields([...fields, { name: "", type: "string", required: false }]);
  const handleUpdateField = (index: number, key: keyof Field, value: string | boolean) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value } as Field;
    setFields(newFields);
  };
  const handleRemoveField = (index: number) => setFields(fields.filter((_, i) => i !== index));

  const handleSave = () => {
    const cleanName = name.trim();
    const cleanFields = fields.filter((f) => f.name.trim() !== "");

    if (!cleanName) { setError("Entity name is required."); return; }

    const newEntity: Entity = { name: cleanName, primaryKey: primaryKey.trim(), fields: cleanFields };
    const provisionalGraph: ArchitectureGraph = { 
      ...currentGraph, 
      entities: { ...currentGraph.entities, [cleanName]: newEntity } 
    };

    const issues = validateGraph(provisionalGraph);
    const fatalErrors = issues.filter(issue => issue.severity === "error" && issue.nodeId === cleanName);

    if (fatalErrors.length > 0) {
      setError(fatalErrors.map(e => e.message).join(" | "));
      return;
    }

    try {
      if (isEdit && initialData) {
        updateEntity(initialData.name, { primaryKey: newEntity.primaryKey, fields: newEntity.fields });
      } else {
        addEntity(newEntity);
      }
      setError(null);
      if (!isEdit) {
        setName("");
        setPrimaryKey("id");
        setFields([{ name: "id", type: "string", required: true }]);
      }
      if (onClose) onClose();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const inputStyle = { flex: 1, padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "0.875rem", background: "#fff" };

  return (
    <div style={{ background: "#ffffff", padding: "1.5rem", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
      <h2 style={{ marginBottom: "1.25rem", fontSize: "1.125rem", fontWeight: "600", color: "#111827" }}>{isEdit ? `Edit Entity: ${initialData?.name}` : "Create Entity"}</h2>
      
      {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #fecaca" }}>⚠️ {error}</div>}

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <input placeholder="Entity Name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} disabled={isEdit} />
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
            <button type="button" onClick={() => handleRemoveField(index)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.2rem", padding: "0 0.5rem" }} title="Remove Field">×</button>
          </div>
        ))}
        <button type="button" onClick={handleAddField} style={{ background: "#f3f4f6", border: "1px dashed #d1d5db", color: "#4b5563", padding: "0.6rem", borderRadius: "6px", cursor: "pointer", width: "100%", fontSize: "0.875rem", fontWeight: "500", marginTop: "0.5rem" }}>
          + Add Field
        </button>
      </div>

      <button type="button" onClick={handleSave} style={{ width: "100%", padding: "0.75rem", background: "#111827", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
        {isEdit ? "Update Entity" : "Inject Entity to AST"}
      </button>
    </div>
  );
}