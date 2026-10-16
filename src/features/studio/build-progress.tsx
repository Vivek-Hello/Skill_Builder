"use client";

import { CircleCheck, CircleDashed, LoaderCircle, Minus } from "lucide-react";
import type { StepId } from "@/lib/types";

export const STEPS: { id: StepId; label: string }[] = [
  { id: "analyze", label: "Understanding your request" },
  { id: "search", label: "Searching GitHub and the web" },
  { id: "match", label: "Comparing existing skills" },
  { id: "clone", label: "Cloning the best match" },
  { id: "adapt", label: "Adapting the closest match" },
  { id: "generate", label: "Writing a new skill" },
  { id: "validate", label: "Checking the skill format" },
];

export type StepState = { status: "pending" | "running" | "done" | "skipped"; detail?: string };

export const initialSteps = () =>
  Object.fromEntries(STEPS.map((s) => [s.id, { status: "pending" }])) as Record<StepId, StepState>;

type Props = {
  description: string;
  steps: Record<StepId, StepState>;
  error: string | null;
  onRetry: () => void;
  onEdit: () => void;
};

export function BuildProgress({ description, steps, error, onRetry, onEdit }: Props) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="text-xs font-semibold tracking-wide text-accent">{error ? "BUILD FAILED" : "BUILDING YOUR SKILL"}</p>
      <blockquote className="mt-3 text-xl font-medium text-balance">&ldquo;{description}&rdquo;</blockquote>

      <ol className="mt-8 space-y-1 rounded-2xl border border-line bg-panel p-3">
        {STEPS.map(({ id, label }) => {
          const s = steps[id];
          return (
            <li
              key={id}
              className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${s.status === "running" ? "bg-accent-soft" : ""}`}
            >
              <span className="mt-0.5 shrink-0">
                {s.status === "running" ? (
                  <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden />
                ) : s.status === "done" ? (
                  <CircleCheck className="size-4 text-success" aria-hidden />
                ) : s.status === "skipped" ? (
                  <Minus className="size-4 text-muted" aria-hidden />
                ) : (
                  <CircleDashed className="size-4 text-line" aria-hidden />
                )}
              </span>
              <span className="min-w-0 text-sm">
                <span className={s.status === "pending" || s.status === "skipped" ? "text-muted" : "font-medium"}>
                  {label}
                </span>
                {s.detail && <span className="block text-xs text-muted break-words">{s.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <div role="alert" className="mt-6 rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">{error}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onRetry} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white">
              Try again
            </button>
            <button type="button" onClick={onEdit} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium">
              Edit description
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-muted">This usually takes under a minute.</p>
      )}
    </div>
  );
}
