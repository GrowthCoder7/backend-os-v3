import { EntityBuilder } from "./components/EntityBuilder";
import { CompilerPreview } from "./components/CompilerPreview";

export default function Home() {
  return (
    <main style={{ display: "flex", height: "100vh", width: "100vw", backgroundColor: "#f9fafb", overflow: "hidden", fontFamily: "sans-serif" }}>
      
      {/* Left Pane: Visual Builder UI */}
      <section style={{ width: "50%", height: "100%", borderRight: "1px solid #e5e7eb", overflowY: "auto" }}>
        <div style={{ padding: "2rem" }}>
          <header style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "1.875rem", fontWeight: "900", margin: 0, letterSpacing: "-0.025em" }}>Backend OS</h1>
            <p style={{ color: "#6b7280", margin: "0.5rem 0 0 0" }}>Visual Architecture Builder</p>
          </header>
          
          <div style={{ maxWidth: "600px" }}>
            <EntityBuilder />
          </div>
        </div>
      </section>

      {/* Right Pane: Compiler Pipeline / Debugger */}
      <section style={{ width: "50%", height: "100%" }}>
        <CompilerPreview />
      </section>

    </main>
  );
}