// Next.js calls register() once per server instance. Tracing for hint calls is registered only when
// both Langfuse keys are set (LANGFUSE_BASE_URL is optional); without them nothing is sent anywhere.
// Setup follows Langfuse's guide for AI SDK 7: the Langfuse span processor exports spans, and
// Langfuse's AI SDK integration turns each model call into a generation with model, tokens and cost.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return;

  const [{ LangfuseSpanProcessor }, { NodeTracerProvider }, { resourceFromAttributes }, { registerTelemetry }, { LangfuseVercelAiSdkIntegration }, telemetry] =
    await Promise.all([
      import("@langfuse/otel"),
      import("@opentelemetry/sdk-trace-node"),
      import("@opentelemetry/resources"),
      import("ai"),
      import("@langfuse/vercel-ai-sdk"),
      import("@/hints/telemetry"),
    ]);

  // "immediate" sends each span as it ends: serverless instances can be frozen right after a response.
  // The processor's default filter exports only Langfuse and AI spans, not Next.js's own route spans.
  const processor = new LangfuseSpanProcessor({
    exportMode: "immediate",
    // An empty LANGFUSE_BASE_URL (copied from .env.example) means "the SDK's default".
    baseUrl: process.env.LANGFUSE_BASE_URL || undefined,
    environment: telemetry.tracingEnvironment(),
  });
  // Without a name the resource reads "unknown_service" plus the Node path of the machine running it.
  new NodeTracerProvider({
    resource: resourceFromAttributes({ "service.name": "merge-crew" }),
    spanProcessors: [new telemetry.StableSpanNames(), processor],
  }).register();
  registerTelemetry(new LangfuseVercelAiSdkIntegration());
  telemetry.rememberProcessor(processor);
}
