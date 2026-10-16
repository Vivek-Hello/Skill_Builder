import type { HubOrigin, PublishedRef } from "@/lib/hub-types";
import { validateSkill } from "@/lib/validate";
import { publishSkill } from "@/server/hub";
import { requireUser } from "@/server/hub-auth";
import { parseFiles } from "@/server/request";

const ORIGINS: HubOrigin[] = ["generated", "adapted", "cloned"];
// Licenses a user may choose for skills they wrote themselves
const CHOOSABLE_LICENSES = new Set(["MIT", "Apache-2.0", "CC-BY-4.0", "CC0-1.0"]);

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const files = parseFiles(body?.files);
  if (!files) return Response.json({ error: "Invalid skill files." }, { status: 400 });
  const errors = validateSkill(files).filter((i) => i.level === "error");
  if (errors.length) {
    return Response.json({ error: `Fix these first: ${errors.map((e) => e.message).join(" ")}` }, { status: 422 });
  }

  const origin: HubOrigin = ORIGINS.includes(body?.origin) ? body.origin : "generated";
  const source =
    origin !== "generated" && typeof body?.source?.repo === "string"
      ? { repo: String(body.source.repo), url: String(body.source.url ?? ""), license: body.source.license ?? null }
      : null;
  // Work based on someone else's skill keeps its license; only original work can pick one
  const license = source
    ? source.license
    : CHOOSABLE_LICENSES.has(body?.license)
      ? body.license
      : null;
  const changes = Array.isArray(body?.changes)
    ? body.changes.filter((c: unknown): c is string => typeof c === "string").slice(0, 20)
    : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  try {
    const published = await publishSkill(auth.supabase, {
      files,
      message: message || "Update",
      license,
      origin,
      source,
      forkedFrom: null,
      changes,
    });
    const ref: PublishedRef = { ...published, username: auth.profile.username };
    return Response.json(ref);
  } catch (err) {
    console.error("publish failed", err);
    return Response.json({ error: err instanceof Error ? err.message : "Publish failed" }, { status: 500 });
  }
}
