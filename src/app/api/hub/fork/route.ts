import type { PublishedRef } from "@/lib/hub-types";
import type { SkillFile } from "@/lib/types";
import { keepLicenseFiles } from "@/lib/validate";
import { adaptSkill } from "@/server/ai/gemini";
import { freeSlug, getVersion, publishSkill } from "@/server/hub";
import { requireUser } from "@/server/hub-auth";
import { publicSupabase } from "@/server/supabase";

// Adapting runs a model rewrite
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const skillId = typeof body?.skillId === "string" && UUID.test(body.skillId) ? body.skillId : null;
  const mode = body?.mode === "adapt" ? "adapt" : "copy";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!skillId) return Response.json({ error: "Invalid request." }, { status: 400 });
  if (mode === "adapt" && (description.length < 10 || description.length > 4000)) {
    return Response.json({ error: "Describe the changes you want in 10–4000 characters." }, { status: 400 });
  }

  const { data: parent } = await publicSupabase()
    .from("skills")
    .select("id, slug, license, source, latest_version, owner:profiles!skills_owner_id_fkey(username)")
    .eq("id", skillId)
    .maybeSingle();
  if (!parent) return Response.json({ error: "That skill no longer exists." }, { status: 404 });
  const owner = (parent.owner as unknown as { username: string }).username;
  const latest = await getVersion(parent.id, parent.latest_version);
  if (!latest) return Response.json({ error: "That skill has no published version." }, { status: 404 });

  let files: SkillFile[] = latest.files;
  let changes: string[] | null = null;
  try {
    if (mode === "adapt") {
      const adapted = await adaptSkill(description, files, { repo: `${owner}/${parent.slug}`, license: parent.license });
      files = keepLicenseFiles(adapted.files, latest.files);
      changes = adapted.changes;
    }

    // Forking your own skill (or one with a name you already use) gets a new name
    const slug = await freeSlug(auth.supabase, auth.profile.id, parent.slug);
    if (slug !== parent.slug) files = renameSkill(files, slug);

    const published = await publishSkill(auth.supabase, {
      files,
      message: `Forked from ${owner}/${parent.slug} v${latest.version}${mode === "adapt" ? " and adapted" : ""}`,
      license: parent.license,
      origin: "forked",
      source: parent.source as PublishedSourceArg,
      forkedFrom: parent.id,
      changes,
      slug,
    });
    const ref: PublishedRef = { ...published, username: auth.profile.username };
    return Response.json(ref);
  } catch (err) {
    console.error("fork failed", err);
    return Response.json({ error: err instanceof Error ? err.message : "Fork failed" }, { status: 500 });
  }
}

type PublishedSourceArg = { repo: string; url: string; license: string | null } | null;

// The SKILL.md name must match the skill's folder/slug
function renameSkill(files: SkillFile[], slug: string) {
  return files.map((f) =>
    f.path === "SKILL.md" ? { ...f, content: f.content.replace(/^name:.*$/m, `name: ${slug}`) } : f,
  );
}
