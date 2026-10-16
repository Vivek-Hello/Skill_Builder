import { PlaygroundError, SESSION_MINUTES, sessionsLeft, simulated, startSession } from "@/server/playground-sessions";
import { parseFiles, SKILL_NAME } from "@/server/request";
import { visitorKeys } from "@/server/visitor";

export const maxDuration = 60;

// How many free sessions this visitor has left, without starting one
export async function GET(req: Request) {
  return Response.json({ sessionsLeft: sessionsLeft(await visitorKeys(req)), sessionMinutes: SESSION_MINUTES, simulated: simulated() });
}

export async function POST(req: Request) {
  const keys = await visitorKeys(req);
  const body = await req.json().catch(() => null);
  const files = parseFiles(body?.files);
  const skillName = typeof body?.skillName === "string" ? body.skillName : "";
  if (!files || !SKILL_NAME.test(skillName)) {
    return Response.json({ error: "Invalid skill." }, { status: 400 });
  }

  try {
    return Response.json(await startSession(keys, skillName, files));
  } catch (err) {
    if (err instanceof PlaygroundError) return Response.json({ error: err.message }, { status: err.status });
    console.error("playground start failed", err);
    return Response.json({ error: "Couldn't start the playground. Try again." }, { status: 502 });
  }
}
