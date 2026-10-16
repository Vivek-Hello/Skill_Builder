import { getCandidate } from "@/server/github";
import { adaptExisting } from "@/server/pipeline";

// Download + model rewrite + possible repair pass
export const maxDuration = 300;

const REPO = /^[\w.-]+\/[\w.-]+$/;
const MAX_DESCRIPTION = 4000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const repo = typeof body?.repo === "string" ? body.repo : "";
  const path = typeof body?.path === "string" ? body.path : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!REPO.test(repo) || !path.endsWith("SKILL.md") || path.split("/").includes("..")) {
    return Response.json({ error: "Invalid skill location." }, { status: 400 });
  }
  if (description.length < 10 || description.length > MAX_DESCRIPTION) {
    return Response.json({ error: "Describe what you need in 10–4000 characters." }, { status: 400 });
  }

  // Re-read from GitHub instead of trusting the browser's copy of name/license
  const candidate = await getCandidate(repo, path);
  if (!candidate) return Response.json({ error: "Couldn't find that skill on GitHub." }, { status: 404 });

  try {
    return Response.json(await adaptExisting(candidate, description));
  } catch (err) {
    console.error("adapt failed", err);
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't adapt that skill" }, { status: 422 });
  }
}
