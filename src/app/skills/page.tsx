"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitFork, Library, Plus, Sparkles, Trash, WandSparkles } from "lucide-react";
import { listSkills, removeSkill, type SavedSkill } from "@/lib/history";

const timeAgo = (t: number) => {
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString();
};

export default function MySkillsPage() {
  const [skills, setSkills] = useState<SavedSkill[] | null>(null);

  // Browser storage isn't available during server render
  useEffect(() => {
    const list = listSkills();
    queueMicrotask(() => setSkills(list));
  }, []);

  function remove(id: string) {
    removeSkill(id);
    setSkills(listSkills());
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My skills</h1>
          <p className="mt-1 text-sm text-muted">Skills you&apos;ve built, saved in this browser.</p>
        </div>
        <Link
          href="/"
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" aria-hidden /> New skill
        </Link>
      </div>

      {skills && skills.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <Library className="size-8 text-muted" aria-hidden />
          <h2 className="mt-3 font-semibold">No skills yet</h2>
          <p className="mt-1 text-sm text-muted">Describe what you want Claude to do and build your first one.</p>
          <Link href="/" className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
            Build a skill
          </Link>
        </div>
      )}

      {skills && skills.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((s) => (
            <li key={s.id} className="group relative flex flex-col rounded-2xl border border-line bg-panel p-4 hover:border-accent">
              <div className="flex items-center gap-2 text-xs text-muted">
                {s.result.origin === "cloned" ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <GitFork className="size-3.5" aria-hidden /> Found
                  </span>
                ) : s.result.origin === "adapted" ? (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <WandSparkles className="size-3.5" aria-hidden /> Adapted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Sparkles className="size-3.5" aria-hidden /> Built
                  </span>
                )}
                <span>· {timeAgo(s.createdAt)}</span>
                <span>· {s.result.files.length} files</span>
              </div>
              <Link href={`/skills/${s.id}`} className="mt-2 font-mono font-semibold break-all after:absolute after:inset-0">
                {s.result.skillName}
              </Link>
              <p className="mt-1 line-clamp-3 text-sm text-muted">{s.description}</p>
              <button
                type="button"
                onClick={() => remove(s.id)}
                className="relative z-10 mt-4 self-start rounded-md p-1 text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger"
                title="Remove from my skills"
              >
                <Trash className="size-4" aria-hidden />
                <span className="sr-only">Remove {s.result.skillName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
