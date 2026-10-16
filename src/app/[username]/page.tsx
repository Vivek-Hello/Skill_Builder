import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Avatar, formatDate } from "@/features/hub/avatar";
import { GridSkeleton, HubDisabled, SkillGrid } from "@/features/hub/skill-card";
import { hubEnabled } from "@/lib/supabase/config";
import { getProfile, listOwnerSkills } from "@/server/hub";

export default function ProfilePage({ params }: PageProps<"/[username]">) {
  if (!hubEnabled) return <HubDisabled />;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Suspense fallback={<GridSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

async function Profile({ params }: { params: PageProps<"/[username]">["params"] }) {
  const { username } = await params;
  const profile = await getProfile(decodeURIComponent(username));
  if (!profile) notFound();
  const skills = await listOwnerSkills(profile.id);
  const stars = skills.reduce((n, s) => n + s.stars_count, 0);

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={profile.username} size={72} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{profile.display_name || profile.username}</h1>
          <p className="text-sm text-muted">
            {profile.username} · joined {formatDate(profile.created_at)} · {skills.length} skill
            {skills.length === 1 ? "" : "s"} · {stars} star{stars === 1 ? "" : "s"} received
          </p>
        </div>
      </div>
      <div className="mt-8">
        {skills.length ? (
          <SkillGrid skills={skills} showOwner={false} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
            {profile.username} hasn&apos;t published any skills yet.
          </p>
        )}
      </div>
    </>
  );
}
