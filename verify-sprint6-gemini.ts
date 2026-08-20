import { IntentAdapter } from "@repo/intent";
import { OperationRegistry, OperationExecutor } from "@repo/executor";
import { validateGraph } from "@repo/validation";
// import { AIProvider } from "@repo/ai"; // DEV A's PACKAGE

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ Skipping live Gemini test: GEMINI_API_KEY missing.");
  process.exit(0);
}

async function run() {
  console.log("🚀 SPRINT 6 VERIFICATION (LIVE GEMINI)");
  console.log("Ensure Dev A's AIProvider is correctly wired and exported to run this test fully.");
  
  /*
  const ai = new AIProvider();
  const intent = await ai.parseIntent({ prompt: "Create a User entity with id and add GET /users." });
  
  // Setup executor registry...
  const adapter = new IntentAdapter(executor);
  const result = adapter.applyIntent(intent, context);
  
  console.log(result.success ? "✅ Live Integration Succeeded" : "❌ Live Integration Failed");
  */
}
run();