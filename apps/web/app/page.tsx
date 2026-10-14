"use client";

import React, { useState } from "react";
import { useGraphStore } from "@repo/store";
import { EntityBuilder } from "./components/EntityBuilder";
import { RelationBuilder } from "./components/builders/RelationBuilder";
import { EndpointBuilder } from "./components/builders/EndpointBuilder";
import { EventBuilder } from "./components/builders/EventBuilder";
import { WorkflowBuilder } from "./components/builders/WorkflowBuilder";
import { CompilerPreview } from "./components/CompilerPreview";
import { AIPromptBar } from "./components/AIPromptBar";
import { HistoryToolbar } from "./components/HistoryToolbar";
import { Entity, Relation, Endpoint, Event, Workflow } from "@repo/types";

export default function Home() {
  const graph = useGraphStore((state) => state.graph);
  
  const removeEntity = useGraphStore((state) => state.removeEntity);
  const removeRelation = useGraphStore((state) => state.removeRelation);
  const removeEndpoint = useGraphStore((state) => state.removeEndpoint);
  const removeEvent = useGraphStore((state) => state.removeEvent);
  const removeWorkflow = useGraphStore((state) => state.removeWorkflow);

  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(null);
  const [selectedEndpointKey, setSelectedEndpointKey] = useState<string | null>(null);
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);
  const [selectedWorkflowEvent, setSelectedWorkflowEvent] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const getRelationKey = (r: Relation) => `${r.source}.${r.sourceField}->${r.target}.${r.targetField}`;
  const getEndpointKey = (e: Endpoint) => `${e.method}:${e.path}`;

  const selectedEntity = selectedEntityName ? graph.entities[selectedEntityName] || null : null;
  const selectedRelation = selectedRelationKey ? graph.relations.find(r => getRelationKey(r) === selectedRelationKey) || null : null;
  const selectedEndpoint = selectedEndpointKey ? graph.endpoints.find(e => getEndpointKey(e) === selectedEndpointKey) || null : null;
  const selectedEvent = selectedEventName ? graph.events[selectedEventName] || null : null;
  const selectedWorkflow = selectedWorkflowEvent ? graph.workflows.find(w => w.triggerEvent === selectedWorkflowEvent) || null : null;

  const handleDeleteEntity = (name: string) => {
    try {
      removeEntity(name);
      if (selectedEntityName === name) setSelectedEntityName(null);
      setError(null);
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteRelation = (rel: Relation) => {
    try {
      const key = getRelationKey(rel);
      removeRelation({ source: rel.source, sourceField: rel.sourceField, target: rel.target, targetField: rel.targetField });
      if (selectedRelationKey === key) setSelectedRelationKey(null);
      setError(null);
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteEndpoint = (ep: Endpoint) => {
    try {
      const key = getEndpointKey(ep);
      removeEndpoint({ method: ep.method, path: ep.path });
      if (selectedEndpointKey === key) setSelectedEndpointKey(null);
      setError(null);
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteEvent = (name: string) => {
    try {
      removeEvent(name);
      if (selectedEventName === name) setSelectedEventName(null);
      setError(null);
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteWorkflow = (triggerEvent: string) => {
    try {
      removeWorkflow({ triggerEvent });
      if (selectedWorkflowEvent === triggerEvent) setSelectedWorkflowEvent(null);
      setError(null);
    } catch (e: any) { setError(e.message); }
  };

  return (
    <main style={{ display: "flex", height: "100vh", width: "100vw", backgroundColor: "#f3f4f6", overflow: "hidden", fontFamily: "sans-serif" }}>
      <section style={{ width: "50%", height: "100%", borderRight: "1px solid #e5e7eb", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "2rem", flex: 1 }}>
          <header style={{ marginBottom: "1.5rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: "800", margin: 0, letterSpacing: "-0.025em", color: "#111827" }}>Backend OS</h1>
            <p style={{ color: "#4b5563", margin: "0.5rem 0 0 0", fontSize: "1rem" }}>Architecture-Driven Backend Compiler</p>
          </header>
          
          <div style={{ maxWidth: "800px" }}>
            <HistoryToolbar />
            <AIPromptBar />
            
            <div style={{ display: "flex", alignItems: "center", margin: "2rem 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }}></div>
              <span style={{ padding: "0 1rem", color: "#6b7280", fontSize: "0.875rem", fontWeight: "500", textTransform: "uppercase" }}>Manual Adjustments & Editors</span>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }}></div>
            </div>

            {error && <div style={{ background: "#fef2f2", color: "#991b1b", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", border: "1px solid #fecaca" }}>⚠️ {error}</div>}

            {/* Entity Manager */}
            <details style={{ marginBottom: "0.75rem", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb" }} open>
              <summary style={{ cursor: "pointer", fontWeight: "600", color: "#374151" }}>Entity Manager</summary>
              <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setSelectedEntityName(null)} style={{ padding: "0.4rem 0.8rem", background: !selectedEntityName ? "#111827" : "#f3f4f6", color: !selectedEntityName ? "#fff" : "#374151", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>+ Create New</button>
                {Object.values(graph.entities).map(ent => (
                  <div key={ent.name} style={{ display: "flex", alignItems: "center", background: selectedEntityName === ent.name ? "#e5e7eb" : "#f9fafb", border: "1px solid #d1d5db", borderRadius: "4px", padding: "0.2rem 0.5rem" }}>
                    <button type="button" onClick={() => setSelectedEntityName(ent.name)} style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "500", fontSize: "0.8rem" }}>{ent.name}</button>
                    <button type="button" onClick={() => handleDeleteEntity(ent.name)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: "0.4rem", fontSize: "1rem" }}>×</button>
                  </div>
                ))}
              </div>
              <EntityBuilder initialData={selectedEntity || undefined} onClose={() => setSelectedEntityName(null)} />
            </details>

            {/* Relation Manager */}
            <details style={{ marginBottom: "0.75rem", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <summary style={{ cursor: "pointer", fontWeight: "600", color: "#374151" }}>Relation Manager</summary>
              <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setSelectedRelationKey(null)} style={{ padding: "0.4rem 0.8rem", background: selectedRelationKey === null ? "#111827" : "#f3f4f6", color: selectedRelationKey === null ? "#fff" : "#374151", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>+ Create New</button>
                {graph.relations.map((rel) => {
                  const key = getRelationKey(rel);
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", background: selectedRelationKey === key ? "#e5e7eb" : "#f9fafb", border: "1px solid #d1d5db", borderRadius: "4px", padding: "0.2rem 0.5rem" }}>
                      <button type="button" onClick={() => setSelectedRelationKey(key)} style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "500", fontSize: "0.8rem" }}>{rel.source}.{rel.sourceField} → {rel.target}.{rel.targetField}</button>
                      <button type="button" onClick={() => handleDeleteRelation(rel)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: "0.4rem", fontSize: "1rem" }}>×</button>
                    </div>
                  );
                })}
              </div>
              <RelationBuilder initialData={selectedRelation || undefined} onClose={() => setSelectedRelationKey(null)} />
            </details>

            {/* Endpoint Manager */}
            <details style={{ marginBottom: "0.75rem", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <summary style={{ cursor: "pointer", fontWeight: "600", color: "#374151" }}>Endpoint Manager</summary>
              <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setSelectedEndpointKey(null)} style={{ padding: "0.4rem 0.8rem", background: selectedEndpointKey === null ? "#111827" : "#f3f4f6", color: selectedEndpointKey === null ? "#fff" : "#374151", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>+ Create New</button>
                {graph.endpoints.map((ep) => {
                  const key = getEndpointKey(ep);
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", background: selectedEndpointKey === key ? "#e5e7eb" : "#f9fafb", border: "1px solid #d1d5db", borderRadius: "4px", padding: "0.2rem 0.5rem" }}>
                      <button type="button" onClick={() => setSelectedEndpointKey(key)} style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "500", fontSize: "0.8rem" }}>{ep.method} {ep.path}</button>
                      <button type="button" onClick={() => handleDeleteEndpoint(ep)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: "0.4rem", fontSize: "1rem" }}>×</button>
                    </div>
                  );
                })}
              </div>
              <EndpointBuilder initialData={selectedEndpoint || undefined} onClose={() => setSelectedEndpointKey(null)} />
            </details>

            {/* Event Manager */}
            <details style={{ marginBottom: "0.75rem", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <summary style={{ cursor: "pointer", fontWeight: "600", color: "#374151" }}>Event Manager</summary>
              <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setSelectedEventName(null)} style={{ padding: "0.4rem 0.8rem", background: !selectedEventName ? "#111827" : "#f3f4f6", color: !selectedEventName ? "#fff" : "#374151", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>+ Create New</button>
                {Object.values(graph.events).map(evt => (
                  <div key={evt.name} style={{ display: "flex", alignItems: "center", background: selectedEventName === evt.name ? "#e5e7eb" : "#f9fafb", border: "1px solid #d1d5db", borderRadius: "4px", padding: "0.2rem 0.5rem" }}>
                    <button type="button" onClick={() => setSelectedEventName(evt.name)} style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "500", fontSize: "0.8rem" }}>{evt.name}</button>
                    <button type="button" onClick={() => handleDeleteEvent(evt.name)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: "0.4rem", fontSize: "1rem" }} title="Deletion rejected if referenced by workflow">×</button>
                  </div>
                ))}
              </div>
              <EventBuilder initialData={selectedEvent || undefined} onClose={() => setSelectedEventName(null)} />
            </details>

            {/* Workflow Manager */}
            <details style={{ marginBottom: "0.75rem", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <summary style={{ cursor: "pointer", fontWeight: "600", color: "#374151" }}>Workflow Manager</summary>
              <div style={{ margin: "1rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setSelectedWorkflowEvent(null)} style={{ padding: "0.4rem 0.8rem", background: selectedWorkflowEvent === null ? "#111827" : "#f3f4f6", color: selectedWorkflowEvent === null ? "#fff" : "#374151", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>+ Create New</button>
                {graph.workflows.map((wf) => (
                  <div key={wf.triggerEvent} style={{ display: "flex", alignItems: "center", background: selectedWorkflowEvent === wf.triggerEvent ? "#e5e7eb" : "#f9fafb", border: "1px solid #d1d5db", borderRadius: "4px", padding: "0.2rem 0.5rem" }}>
                    <button type="button" onClick={() => setSelectedWorkflowEvent(wf.triggerEvent)} style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "500", fontSize: "0.8rem" }}>{wf.triggerEvent}</button>
                    <button type="button" onClick={() => handleDeleteWorkflow(wf.triggerEvent)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: "0.4rem", fontSize: "1rem" }}>×</button>
                  </div>
                ))}
              </div>
              <WorkflowBuilder initialData={selectedWorkflow || undefined} onClose={() => setSelectedWorkflowEvent(null)} />
            </details>

          </div>
        </div>
      </section>

      <section style={{ width: "50%", height: "100%", backgroundColor: "#1e1e1e" }}>
        <CompilerPreview />
      </section>
    </main>
  );
}