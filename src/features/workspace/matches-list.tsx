"use client";

import { useState } from "react";
import { ExternalLink, GitFork, LoaderCircle, Search, Star, WandSparkles } from "lucide-react";
import type { ScoredCandidate } from "@/lib/types";

type Props = {
  matches: ScoredCandidate[];
  activeUrl?: string;
  onUse: (match: ScoredCandidate, mode: MatchMode) => Promise<void>;
};

// Take the skill as-is, or have it modified to fit the user's description
export type MatchMode = "clone" | "adapt";

export function MatchesList({ matches, activeUrl, onUse }: Props) {
  const [loading, setLoading] = useState<{ url: string; mode: MatchMode } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function use(m: ScoredCandidate, mode: MatchMode) {
    setLoading({ url: m.url, mode });
    setError(null);
    try {
      await onUse(m, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't use that skill");
    } finally {
      setLoading(null);
    }
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-panel-2 text-muted">
          <Search className="size-6" aria-hidden />
        </span>
        <h3 className="mt-4 font-semibold">No existing skills matched</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">
          We searched GitHub and the web and found nothing close enough, so this one was built from scratch.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="mb-3 text-sm text-muted">Existing skills, scored against your description. Use one as-is, or have it adapted to your request.</p>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      <ul className="space-y-3">
        {matches.map((m) => {
          const active = m.url === activeUrl;
          return (
            <li
              key={m.url}
              className={`rounded-xl border bg-panel p-3 ${active ? "border-accent" : "border-line"}`}
            >
              <div className="flex items-start gap-3">
                <ScoreRing score={m.score} />
                <div className="min-w-0 flex-1">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-sm font-medium hover:text-accent"
                  >
                    {m.name}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="truncate">{m.repo}</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="size-3" aria-hidden /> {m.stars}
                    </span>
                    <span className={m.cloneable ? "" : "text-warning"}>{m.license ?? "no license"}</span>
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm">{m.reason}</p>
              {m.cloneable ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MatchButton
                    icon={GitFork}
                    label={active ? "In use" : "Use as-is"}
                    busyLabel="Cloning…"
                    busy={loading?.url === m.url && loading.mode === "clone"}
                    disabled={active || loading !== null}
                    onClick={() => use(m, "clone")}
                  />
                  <MatchButton
                    icon={WandSparkles}
                    label="Adapt to my request"
                    busyLabel="Adapting… ~1 min"
                    busy={loading?.url === m.url && loading.mode === "adapt"}
                    disabled={loading !== null}
                    onClick={() => use(m, "adapt")}
                  />
                </div>
              ) : (
                <p className="mt-3 rounded-lg bg-panel-2 py-1.5 text-center text-xs text-muted">
                  License doesn&apos;t allow copying or modifying
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MatchButton({
  icon: Icon,
  label,
  busyLabel,
  busy,
  disabled,
  onClick,
}: {
  icon: typeof GitFork;
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 rounded-lg border border-line py-1.5 text-xs font-medium hover:border-accent disabled:opacity-40"
    >
      {busy ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
      {busy ? busyLabel : label}
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-10 shrink-0" aria-label={`Match score ${score} out of 100`}>
      <svg viewBox="0 0 40 40" className="size-10 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">{score}</span>
    </div>
  );
}
