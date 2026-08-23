import { EntityBuilder } from "./components/EntityBuilder";
import { CompilerPreview } from "./components/CompilerPreview";
import { AIPromptBar } from "./components/AIPromptBar";

export default function Home() {
  return (
    <main style={{ display: "flex", height: "100vh", width: "100vw", backgroundColor: "#f3f4f6", overflow: "hidden", fontFamily: "sans-serif" }}>
      
      {/* Left Pane: Intent & Manual Builder UI */}
      <section style={{ width: "50%", height: "100%", borderRight: "1px solid #e5e7eb", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "2rem", flex: 1 }}>
          <header style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: "800", margin: 0, letterSpacing: "-0.025em", color: "#111827" }}>Backend OS</h1>
            <p style={{ color: "#4b5563", margin: "0.5rem 0 0 0", fontSize: "1rem" }}>Architecture-Driven Backend Compiler</p>
          </header>
          
          <div style={{ maxWidth: "800px" }}>
            <AIPromptBar />
            
            <div style={{ display: "flex", alignItems: "center", margin: "2rem 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }}></div>
              <span style={{ padding: "0 1rem", color: "#6b7280", fontSize: "0.875rem", fontWeight: "500", textTransform: "uppercase" }}>Manual Adjustments</span>
              <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }}></div>
            </div>

            <EntityBuilder />
          </div>
        </div>
      </section>

      {/* Right Pane: Compiler Pipeline / Debugger */}
      <section style={{ width: "50%", height: "100%", backgroundColor: "#1e1e1e" }}>
        <CompilerPreview />
      </section>

    </main>
  );
}