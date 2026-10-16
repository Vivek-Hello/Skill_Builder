"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, GitFork, LoaderCircle, Star, WandSparkles, X } from "lucide-react";
import type { PublishedRef } from "@/lib/hub-types";
import { postJson } from "@/lib/ndjson";
import { browserSupabase } from "@/lib/supabase/browser";
import type { SkillFile } from "@/lib/types";
import { downloadSkillZip } from "@/lib/zip";
import { useHubUser } from "./use-hub-user";

type Props = {
  skillId: string;
  slug: string;
  owner: string;
  stars: number;
  forks: number;
  files: SkillFile[];
};

export function SkillActions({ skillId, slug, owner, stars, forks, files }: Props) {
  const user = useHubUser();
  const router = useRouter();
  const pathname = usePathname();
  const [starred, setStarred] = useState(false);
  const [starCount, setStarCount] = useState(stars);
  const [starring, setStarring] = useState(false);
  const [forkOpen, setForkOpen] = useState(false);

  // Has the signed-in user starred this already?
  useEffect(() => {
    if (!user) return;
    browserSupabase()
      ?.from("stars")
      .select("skill_id")
      .eq("user_id", user.id)
      .eq("skill_id", skillId)
      .maybeSingle()
      .then(({ data }) => setStarred(Boolean(data)));
  }, [user, skillId]);

  const requireSignIn = () => {
    if (user) return false;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return true;
  };

  async function toggleStar() {
    if (requireSignIn() || starring) return;
    const next = !starred;
    setStarring(true);
    setStarred(next);
    setStarCount((n) => n + (next ? 1 : -1));
    try {
      const res = await postJson<{ stars: number | null }>("/api/hub/star", { skillId, starred: next });
      if (res.stars !== null) setStarCount(res.stars);
    } catch {
      setStarred(!next);
      setStarCount((n) => n + (next ? -1 : 1));
    } finally {
      setStarring(false);
    }
  }

  const isOwner = user?.username === owner;

  return (
    <div className="flex flex-wrap gap-2">
      <ButtonGroup>
        <button
          type="button"
          onClick={toggleStar}
          aria-pressed={starred}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium hover:bg-panel-2"
        >
          <Star className={`size-4 ${starred ? "fill-accent text-accent" : ""}`} aria-hidden />
          {starred ? "Starred" : "Star"}
        </button>
        <span className="border-l border-line px-3 py-2 text-sm tabular-nums">{starCount}</span>
      </ButtonGroup>
      <ButtonGroup>
        <button
          type="button"
          onClick={() => !requireSignIn() && setForkOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium hover:bg-panel-2"
        >
          <GitFork className="size-4" aria-hidden /> Fork
        </button>
        <span className="border-l border-line px-3 py-2 text-sm tabular-nums">{forks}</span>
      </ButtonGroup>
      <button
        type="button"
        onClick={() => downloadSkillZip(slug, files)}
        className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
      >
        <Download className="size-4" aria-hidden /> Download .zip
      </button>
      {forkOpen && (
        <ForkDialog
          skillId={skillId}
          title={`${owner}/${slug}`}
          isOwner={isOwner}
          onClose={() => setForkOpen(false)}
          onForked={(ref) => router.push(`/${ref.username}/${ref.slug}`)}
        />
      )}
    </div>
  );
}

function ButtonGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex overflow-hidden rounded-xl border border-line bg-panel">{children}</div>;
}

function ForkDialog({
  skillId,
  title,
  isOwner,
  onClose,
  onForked,
}: {
  skillId: string;
  title: string;
  isOwner: boolean;
  onClose: () => void;
  onForked: (ref: PublishedRef) => void;
}) {
  const [mode, setMode] = useState<"copy" | "adapt">("copy");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fork(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onForked(await postJson<PublishedRef>("/api/hub/fork", { skillId, mode, description }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fork failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="fork-title"
        onSubmit={fork}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-xl"
      >
        <div className="flex items-start">
          <h2 id="fork-title" className="font-semibold">Fork {title}</h2>
          <button type="button" onClick={onClose} disabled={busy} className="ml-auto rounded-md p-1 text-muted hover:bg-panel-2">
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          {isOwner ? "Make a copy of your own skill under a new name." : "Get your own copy under your account, linked back to the original."}
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">How to fork</legend>
          {([
            ["copy", GitFork, "Fork as-is", "An exact copy you can download and publish updates to."],
            ["adapt", WandSparkles, "Fork and adapt", "Describe what to change; we modify the copy and list every change."],
          ] as const).map(([value, Icon, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === value ? "border-accent bg-accent-soft/50" : "border-line"}`}
            >
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === "adapt" && (
          <>
            <label htmlFor="fork-desc" className="mt-4 block text-sm font-medium">What should change?</label>
            <textarea
              id="fork-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              required
              minLength={10}
              placeholder="Make it focus on MySQL instead of Postgres and add a rollback checklist…"
              className="mt-1.5 w-full resize-y rounded-xl border border-line bg-background p-2.5 text-sm outline-none focus:border-accent"
            />
          </>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {busy ? (mode === "adapt" ? "Adapting… about a minute" : "Forking…") : mode === "adapt" ? "Fork and adapt" : "Fork"}
        </button>
      </form>
    </div>
  );
}
