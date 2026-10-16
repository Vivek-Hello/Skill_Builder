import Link from "next/link";
import { GitFork, Star } from "lucide-react";
import type { HubSkill } from "@/lib/hub-types";
import { Avatar, formatDate } from "./avatar";

export function SkillCard({ skill, showOwner = true }: { skill: HubSkill; showOwner?: boolean }) {
  return (
    <li className="relative flex flex-col rounded-2xl border border-line bg-panel p-4 hover:border-accent">
      {showOwner && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Avatar url={skill.owner.avatar_url} name={skill.owner.username} size={18} />
          {skill.owner.username}
        </div>
      )}
      <Link
        href={`/${skill.owner.username}/${skill.slug}`}
        className="mt-1.5 font-mono font-semibold break-all after:absolute after:inset-0"
      >
        {skill.slug}
      </Link>
      {skill.parent && (
        <p className="text-xs text-muted">
          forked from {skill.parent.owner.username}/{skill.parent.slug}
        </p>
      )}
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{skill.description || "No description."}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Star className="size-3.5" aria-hidden /> {skill.stars_count}
        </span>
        <span className="inline-flex items-center gap-1">
          <GitFork className="size-3.5" aria-hidden /> {skill.forks_count}
        </span>
        {skill.license && <span>{skill.license}</span>}
        <span>v{skill.latest_version}</span>
        <span className="ml-auto">Updated {formatDate(skill.updated_at)}</span>
      </div>
    </li>
  );
}

export function SkillGrid({ skills, showOwner }: { skills: HubSkill[]; showOwner?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((s) => (
        <SkillCard key={s.id} skill={s} showOwner={showOwner} />
      ))}
    </ul>
  );
}

export function HubDisabled() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">The skills hub isn&apos;t set up yet</h1>
      <p className="mt-2 text-sm text-muted">
        Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to enable publishing and browsing
        skills. See docs/hub-setup.md.
      </p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
        Build a skill
      </Link>
    </div>
  );
}

export function GridSkeleton() {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="h-40 animate-pulse rounded-2xl border border-line bg-panel" />
      ))}
    </ul>
  );
}
