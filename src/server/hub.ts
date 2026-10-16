import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HubOrigin, HubSkill, HubVersion, HubVersionWithFiles, Profile } from "@/lib/hub-types";
import type { SkillFile } from "@/lib/types";
import { parseSkillMd } from "@/lib/validate";
import { publicSupabase } from "./supabase";

const SKILL_FIELDS =
  "id, slug, description, license, origin, source, latest_version, stars_count, forks_count, created_at, updated_at, " +
  "owner:profiles!skills_owner_id_fkey(username, display_name, avatar_url), " +
  "parent:skills!skills_forked_from_fkey(slug, owner:profiles!skills_owner_id_fkey(username))";

export const PAGE_SIZE = 24;

// ---------------------------------------------------------------- reads (public)

export async function getProfile(username: string): Promise<Profile | null> {
  const { data } = await publicSupabase()
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function listOwnerSkills(ownerId: string): Promise<HubSkill[]> {
  const { data, error } = await publicSupabase()
    .from("skills")
    .select(SKILL_FIELDS)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as unknown as HubSkill[];
}

export async function getSkill(username: string, slug: string): Promise<HubSkill | null> {
  const profile = await getProfile(username);
  if (!profile) return null;
  const { data } = await publicSupabase()
    .from("skills")
    .select(SKILL_FIELDS)
    .eq("owner_id", profile.id)
    .eq("slug", slug)
    .maybeSingle();
  return (data as unknown as HubSkill | null) ?? null;
}

export async function getVersion(skillId: string, version: number): Promise<HubVersionWithFiles | null> {
  const { data } = await publicSupabase()
    .from("skill_versions")
    .select("version, message, changes, created_at, files")
    .eq("skill_id", skillId)
    .eq("version", version)
    .maybeSingle();
  return (data as HubVersionWithFiles | null) ?? null;
}

export async function listVersions(skillId: string): Promise<HubVersion[]> {
  const { data, error } = await publicSupabase()
    .from("skill_versions")
    .select("version, message, changes, created_at")
    .eq("skill_id", skillId)
    .order("version", { ascending: false });
  if (error) throw error;
  return data as HubVersion[];
}

export type ExploreSort = "stars" | "new";

export async function exploreSkills({ q, sort, page }: { q?: string; sort: ExploreSort; page: number }) {
  let query = publicSupabase().from("skills").select(SKILL_FIELDS, { count: "exact" });
  if (q?.trim()) query = query.textSearch("search", q.trim(), { type: "websearch", config: "english" });
  query =
    sort === "new"
      ? query.order("created_at", { ascending: false })
      : query.order("stars_count", { ascending: false }).order("updated_at", { ascending: false });
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { skills: data as unknown as HubSkill[], total: count ?? 0 };
}

// ---------------------------------------------------------------- writes (as the signed-in user)

export type PublishInput = {
  files: SkillFile[];
  message: string;
  license: string | null;
  origin: HubOrigin;
  source: HubSkill["source"];
  forkedFrom: string | null;
  changes: string[] | null;
  // Publish under this name instead of the SKILL.md name (used to avoid fork collisions)
  slug?: string;
};

// Creates the skill on first publish, otherwise adds the next version
export async function publishSkill(supabase: SupabaseClient, input: PublishInput) {
  const { meta } = parseSkillMd(input.files.find((f) => f.path === "SKILL.md")?.content ?? "");
  const slug = input.slug ?? (typeof meta?.name === "string" ? meta.name : "");
  const description = typeof meta?.description === "string" ? meta.description.slice(0, 1024) : "";

  const { data, error } = await supabase.rpc("publish_skill", {
    p_slug: slug,
    p_description: description,
    p_license: input.license,
    p_origin: input.origin,
    p_source: input.source,
    p_forked_from: input.forkedFrom,
    p_files: input.files,
    p_message: input.message.slice(0, 500),
    p_changes: input.changes,
  });
  if (error) throw new Error(error.message);
  const row = (data as { skill_id: string; version: number }[])[0];
  return { skillId: row.skill_id, slug, version: row.version };
}

export async function currentProfile(supabase: SupabaseClient): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

// Pick a slug the user doesn't own yet: name, name-fork, name-fork-2, …
export async function freeSlug(supabase: SupabaseClient, ownerId: string, base: string) {
  const { data } = await supabase.from("skills").select("slug").eq("owner_id", ownerId).like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 1; ; n++) {
    const candidate = `${base}-fork${n === 1 ? "" : `-${n}`}`.slice(0, 64);
    if (!taken.has(candidate)) return candidate;
  }
}
