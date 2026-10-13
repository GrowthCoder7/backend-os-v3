"use client";

import React, { useState, useEffect } from "react";
import { useGraphStore } from "@repo/store";
import { Event, FieldType } from "@repo/types";

export function EventBuilder({ initialData, onClose }: { initialData?: Event; onClose?: () => void }) {
  const isEdit = !!initialData;
  const addEvent = useGraphStore((state) => state.addEvent);
  const updateEvent = useGraphStore((state) => state.updateEvent);

  const initialFields = initialData 
    ? Object.entries(initialData.payloadSchema).map(([k, v]) => ({ key: k, type: v })) 
    : [];

  const [name, setName] = useState(initialData?.name || "");
  const [schemaFields, setSchemaFields] = useState<{ key: string; type: FieldType }[]>(initialFields);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setSchemaFields(Object.entries(initialData.payloadSchema).map(([k, v]) => ({ key: k, type: v })));
    }
  }, [initialData]);

  const handleAddField = () => setSchemaFields([...schemaFields, { key: "", type: "string" }]);
  
  const handleUpdateField = (index: number, fieldKey: "key" | "type", value: string) => {
    setSchemaFields((prev) => 
      prev.map((field, i) => {
        if (i !== index) return field;
        return { ...field, [fieldKey]: value } as { key: string; type: FieldType };
      })
    );
  };
  
  const handleRemoveField = (index: number) => setSchemaFields(schemaFields.filter((_, i) => i !== index));

  const handleSave = () => {
    const cleanName = name.trim();
    if (!cleanName) { setError("Event name is required."); return; }

    const payloadSchema: Record<string, FieldType> = {};
    const keys = new Set<string>();

    for (const f of schemaFields) {
      const cleanKey = f.key.trim();
      if (cleanKey) {
        if (keys.has(cleanKey)) { setError(`Duplicate key found in payload schema: '${cleanKey}'.`); return; }
        keys.add(cleanKey);
        payloadSchema[cleanKey] = f.type;
      }
    }

    try {
      const payload: Event = { name: cleanName, payloadSchema };
      if (isEdit && initialData) {
        updateEvent(initialData.name, payload);
      } else {
        addEvent(payload);
      }
      setError(null);
      if (!isEdit) { setName(""); setSchemaFields([]); }
      if (onClose) onClose();
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Validation failed.");
    }
  };

  const inputStyle = { flex: 1, padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "0.875rem", background: "#fff" };

  return (
    <div style={{ background: "#ffffff", padding: "1.5rem", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
      <h2 style={{ marginBottom: "1.25rem", fontSize: "1.125rem", fontWeight: "600", color: "#111827" }}>{isEdit ? "Edit Event" : "Create Event"}</h2>
      {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #fecaca" }}>⚠️ {error}</div>}

      <div style={{ marginBottom: "1.5rem" }}>
        <input placeholder="Event Name (e.g., UserSignedUp)" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: "600", color: "#4b5563", marginBottom: "0.75rem" }}>Payload Schema</h3>
        {schemaFields.map((field, index) => (
          <div key={index} style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", alignItems: "center" }}>
            <input placeholder="Key (e.g., userId)" value={field.key} onChange={(e) => handleUpdateField(index, "key", e.target.value)} style={{ ...inputStyle, flex: 2 }} />
            <select value={field.type} onChange={(e) => handleUpdateField(index, "type", e.target.value)} style={inputStyle}>
              <option value="string">string</option><option value="number">number</option>
              <option value="boolean">boolean</option><option value="datetime">datetime</option>
              <option value="json">json</option>
            </select>
            <button onClick={() => handleRemoveField(index)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.2rem", padding: "0 0.5rem" }}>×</button>
          </div>
        ))}
        <button onClick={handleAddField} style={{ background: "#f3f4f6", border: "1px dashed #d1d5db", color: "#4b5563", padding: "0.6rem", borderRadius: "6px", cursor: "pointer", width: "100%", fontSize: "0.875rem", fontWeight: "500" }}>
          + Add Schema Key
        </button>
      </div>

      <button onClick={handleSave} style={{ width: "100%", padding: "0.75rem", background: "#111827", color: "#ffffff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
        {isEdit ? "Update Event" : "Inject Event to AST"}
      </button>
    </div>
  );
}