import { endSession, PlaygroundError } from "@/server/playground-sessions";
import { visitorKeys } from "@/server/visitor";

export async function POST(req: Request) {
  const keys = await visitorKeys(req);
  const body = await req.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  try {
    await endSession(sessionId, keys);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof PlaygroundError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
