import { buildSkill } from "@/server/pipeline";
import type { BuildEvent } from "@/lib/types";

// Search + generation can take a minute or two with Pro models
export const maxDuration = 300;

const MAX_DESCRIPTION = 4000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const forceGenerate = body?.forceGenerate === true;
  if (description.length < 10) {
    return Response.json({ error: "Describe the skill in at least a sentence." }, { status: 400 });
  }
  if (description.length > MAX_DESCRIPTION) {
    return Response.json({ error: `Keep the description under ${MAX_DESCRIPTION} characters.` }, { status: 400 });
  }

  // Newline-delimited JSON so the UI can show each step as it happens
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: BuildEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const result = await buildSkill(description, emit, { forceGenerate });
        emit({ type: "result", result });
      } catch (err) {
        console.error("build failed", err);
        emit({ type: "error", message: err instanceof Error ? err.message : "Build failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
