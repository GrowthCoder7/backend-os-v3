import { NextResponse } from "next/server";
import { GeminiProvider } from "@repo/ai";
import type { ArchitectureGraph } from "@repo/types";

export async function POST(request: Request) {
  try {
    // 1. Server-side API key validation
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { status: "error", message: "Server configuration error: GEMINI_API_KEY missing." },
        { status: 500 }
      );
    }

    // 2. Safely parse JSON payload
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: "error", message: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    const prompt = body?.prompt;
    const rawGraph = body?.graph;

    // 3. Prompt validation
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { status: "error", message: "Invalid request: 'prompt' must be a non-empty string." },
        { status: 400 }
      );
    }

    // 4. Graph context validation
    if (!rawGraph || typeof rawGraph !== "object") {
      return NextResponse.json(
        { status: "error", message: "Invalid request: 'graph' must be provided." },
        { status: 400 }
      );
    }

    const graph = rawGraph as ArchitectureGraph;

    // 5. Instantiate and call provider securely
    const provider = new GeminiProvider();
    const intentResponse = await provider.generateIntent({
      prompt,
      graph
    });

    return NextResponse.json(intentResponse);
    
  } catch (error: any) {
    console.error("[API/AI Intent Error]:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error during intent generation." },
      { status: 500 }
    );
  }
}