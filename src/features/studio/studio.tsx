"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSkill, newSkillId, saveSkill } from "@/lib/history";
import { postJson, streamNdjson } from "@/lib/ndjson";
import { stripWrapperFolder, validateSkill } from "@/lib/validate";
import type { BuildEvent, BuildResult, ScoredCandidate, StepId } from "@/lib/types";
import { BuildProgress, initialSteps } from "@/features/studio/build-progress";
import { Landing } from "@/features/studio/landing";
import type { MatchMode } from "@/features/workspace/matches-list";
import { Workspace } from "@/features/workspace/workspace";

type Phase = "idle" | "building" | "ready" | "missing";

// One component drives the whole flow: landing → building → workspace.
// Finished skills are saved in this browser and get their own /skills/<id> URL.
export function Studio({ initialId }: { initialId?: string }) {
  const [phase, setPhase] = useState<Phase>(initialId ? "ready" : "idle");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState(initialSteps);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<{ id: string; createdAt: number } | null>(null);
  // Bumped on every new result so per-skill UI state (file tab, chat, tests) starts fresh
  const [resultKey, setResultKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Open a saved skill (browser storage isn't available during server render)
  useEffect(() => {
    if (!initialId) return;
    const saved = getSkill(initialId);
    queueMicrotask(() => {
      if (!saved) return setPhase("missing");
      setDescription(saved.description);
      // Older builds could nest files one folder too deep; repair on open
      const files = stripWrapperFolder(saved.result.files);
      setResult({ ...saved.result, files, issues: validateSkill(files) });
      setEntry({ id: saved.id, createdAt: saved.createdAt });
      setPhase("ready");
    });
  }, [initialId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function show(next: BuildResult, keepEntry: boolean) {
    const id = keepEntry && entry ? entry.id : newSkillId();
    const createdAt = keepEntry && entry ? entry.createdAt : Date.now();
    saveSkill({ id, createdAt, description, result: next });
    setEntry({ id, createdAt });
    setResult(next);
    setResultKey((k) => k + 1);
    setPhase("ready");
    window.history.replaceState(null, "", `/skills/${id}`);
  }

  async function build(forceGenerate = false) {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setPhase("building");
    setSteps(initialSteps());
    setError(null);
    window.scrollTo({ top: 0 });

    try {
      await streamNdjson<BuildEvent>(
        "/api/build",
        { description, forceGenerate },
        (e) => {
          if (e.type === "step") setSteps((s) => ({ ...s, [e.step as StepId]: { status: e.status, detail: e.detail } }));
          else if (e.type === "result") show(e.result, false);
          else setError(e.message);
        },
        abort.signal,
      );
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  // Swap in a match the user picked, keeping the list so they can switch again
  async function useMatch(match: ScoredCandidate, mode: MatchMode) {
    const next =
      mode === "clone"
        ? await postJson<BuildResult>("/api/clone", { repo: match.repo, path: match.path })
        : await postJson<BuildResult>("/api/adapt", { repo: match.repo, path: match.path, description });
    show({ ...next, matches: result?.matches ?? [], examples: result?.examples }, true);
  }

  if (phase === "missing") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Skill not found</h1>
        <p className="mt-2 text-sm text-muted">
          Skills are saved in the browser you built them in. This one isn&apos;t here, or it was removed.
        </p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
          Build a new skill
        </Link>
      </div>
    );
  }

  if (phase === "building") {
    return (
      <BuildProgress
        description={description}
        steps={steps}
        error={error}
        onRetry={() => build()}
        onEdit={() => {
          setPhase("idle");
          window.history.replaceState(null, "", "/");
        }}
      />
    );
  }

  if (phase === "ready" && result) {
    return (
      <Workspace
        key={resultKey}
        result={result}
        description={description}
        busy={false}
        onUseMatch={useMatch}
        onRegenerate={() => build(true)}
      />
    );
  }

  if (phase === "ready") return null; // saved skill still loading

  return <Landing description={description} onChange={setDescription} onBuild={() => build()} />;
}

export function SavedSkillStudio() {
  const { id } = useParams<{ id: string }>();
  return <Studio key={id} initialId={id} />;
}
