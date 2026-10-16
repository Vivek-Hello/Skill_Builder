import { getCandidate } from "@/server/github";
import { cloneSkill } from "@/server/pipeline";

export const maxDuration = 60;

const REPO = /^[\w.-]+\/[\w.-]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const repo = typeof body?.repo === "string" ? body.repo : "";
  const path = typeof body?.path === "string" ? body.path : "";
  if (!REPO.test(repo) || !path.endsWith("SKILL.md") || path.split("/").includes("..")) {
    return Response.json({ error: "Invalid skill location." }, { status: 400 });
  }

  // Re-read from GitHub instead of trusting the browser's copy of name/license
  const candidate = await getCandidate(repo, path);
  if (!candidate) return Response.json({ error: "Couldn't find that skill on GitHub." }, { status: 404 });

  try {
    return Response.json(await cloneSkill(candidate));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Clone failed" }, { status: 422 });
  }
}
