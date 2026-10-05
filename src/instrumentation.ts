// Next.js calls register() once per server instance. Tracing for hint calls is registered only when
// both Langfuse keys are set (LANGFUSE_BASE_URL is optional); without them nothing is sent anywhere.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) return;

  const [{ LangfuseSpanProcessor }, { NodeTracerProvider }, { rememberProcessor }] = await Promise.all([
    import("@langfuse/otel"),
    import("@opentelemetry/sdk-trace-node"),
    import("@/hints/telemetry"),
  ]);

  // "immediate" sends each span as it ends: serverless instances can be frozen right after a response.
  const processor = new LangfuseSpanProcessor({
    exportMode: "immediate",
    // An empty LANGFUSE_BASE_URL (copied from .env.example) means "the SDK's default".
    baseUrl: process.env.LANGFUSE_BASE_URL || undefined,
  });
  new NodeTracerProvider({ spanProcessors: [processor] }).register();
  rememberProcessor(processor);
}
