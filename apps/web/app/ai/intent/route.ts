import { NextResponse } from "next/server";
import { GeminiProvider } from "@repo/ai";

export async function POST(request: Request) {
  try {
    // Ensure API key is configured on the server
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { status: "error", message: "Server configuration error: GEMINI_API_KEY missing." },
        { status: 500 }
      );
    }

    // Parse and validate the request payload
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: "error", message: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { status: "error", message: "Invalid request: 'prompt' must be a non-empty string." },
        { status: 400 }
      );
    }

    // Safely instantiate and invoke the provider server-side
    const provider = new GeminiProvider();
    const intentResponse = await provider.generateIntent({ prompt });

    // Return the IntentResponse object to the client
    return NextResponse.json(intentResponse);
    
  } catch (error: any) {
    console.error("[API/AI Intent Error]:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error during intent generation." },
      { status: 500 }
    );
  }
}