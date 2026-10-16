import { requireUser } from "@/server/hub-auth";

const UUID = /^[0-9a-f-]{36}$/;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const skillId = typeof body?.skillId === "string" && UUID.test(body.skillId) ? body.skillId : null;
  if (!skillId || typeof body?.starred !== "boolean") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const stars = auth.supabase.from("stars");
  const { error } = body.starred
    ? await stars.upsert({ user_id: auth.profile.id, skill_id: skillId }, { ignoreDuplicates: true })
    : await stars.delete().eq("user_id", auth.profile.id).eq("skill_id", skillId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data } = await auth.supabase.from("skills").select("stars_count").eq("id", skillId).maybeSingle();
  return Response.json({ starred: body.starred, stars: data?.stars_count ?? null });
}
