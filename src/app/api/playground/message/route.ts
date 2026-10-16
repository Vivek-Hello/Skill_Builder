import { claimTurn, PlaygroundError, runTurn } from "@/server/playground-sessions";
import type { PlaygroundEvent } from "@/lib/types";
import { visitorKeys } from "@/server/visitor";

export const maxDuration = 120;

const MAX_MESSAGE = 6000;

export async function POST(req: Request) {
  const keys = await visitorKeys(req);
  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!sessionId || !text) return Response.json({ error: "Type a message first." }, { status: 400 });
  if (text.length > MAX_MESSAGE) {
    return Response.json({ error: `Keep messages under ${MAX_MESSAGE} characters.` }, { status: 400 });
  }

  let session;
  try {
    session = await claimTurn(sessionId, keys);
  } catch (err) {
    if (err instanceof PlaygroundError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: PlaygroundEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runTurn(session, text, emit);
      } catch (err) {
        console.error("playground turn failed", err);
        emit({ type: "error", message: "Claude couldn't reply. Try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
