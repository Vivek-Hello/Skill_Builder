"use client";

import { useState } from "react";
import { CircleCheck, CircleX, FlaskConical, LoaderCircle, RefreshCw } from "lucide-react";
import { postJson, streamNdjson } from "@/lib/ndjson";
import type { SkillFile, TestCase, TestEvent, TestVerdict } from "@/lib/types";
import { Markdown } from "@/components/markdown";
import { SimulatedNote } from "@/features/playground/playground";

type CaseResult =
  | { status: "idle" | "running" }
  | { status: "done"; output: string; skillLoaded: boolean; toolCalls: number; simulated: boolean; verdict: TestVerdict }
  | { status: "error"; message: string };

type Props = { skillName: string; files: SkillFile[] };

export function TestPanel({ skillName, files }: Props) {
  const [cases, setCases] = useState<TestCase[] | null>(null);
  const [results, setResults] = useState<CaseResult[]>([]);
  const [phase, setPhase] = useState<"idle" | "writing" | "ready" | "running" | "done">("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ passed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function writeCases() {
    setPhase("writing");
    setError(null);
    setSummary(null);
    try {
      const { cases } = await postJson<{ cases: TestCase[] }>("/api/test/cases", { files });
      setCases(cases);
      setResults(cases.map(() => ({ status: "idle" })));
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write test cases");
      setPhase(cases ? "ready" : "idle");
    }
  }

  async function run() {
    if (!cases) return;
    setPhase("running");
    setError(null);
    setSummary(null);
    setResults(cases.map(() => ({ status: "idle" })));
    try {
      await streamNdjson<TestEvent>("/api/test", { skillName, files, cases }, (e) => {
        if (e.type === "status") setStatus(e.message);
        else if (e.type === "done") setSummary({ passed: e.passed, total: e.total });
        else if (e.type === "error") setError(e.message);
        else
          setResults((prev) => {
            const next = [...prev];
            next[e.index] =
              e.status === "done"
                ? { status: "done", output: e.output, skillLoaded: e.skillLoaded, toolCalls: e.toolCalls, simulated: e.simulated, verdict: e.verdict }
                : e.status === "error"
                  ? { status: "error", message: e.message }
                  : { status: "running" };
            return next;
          });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test run failed");
    } finally {
      setStatus(null);
      setPhase("done");
    }
  }

  const updateCase = (i: number, patch: Partial<TestCase>) =>
    setCases((prev) => prev && prev.map((c, n) => (n === i ? { ...c, ...patch } : c)));

  const busy = phase === "writing" || phase === "running";
  const simulated = results.some((r) => r.status === "done" && r.simulated);

  if (!cases) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <FlaskConical className="size-6" aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold">Grade it automatically</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">
          We write realistic test prompts with pass criteria, run each one with the skill loaded, and grade the answers.
        </p>
        <button
          type="button"
          onClick={writeCases}
          disabled={busy}
          className="mt-5 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {busy ? "Writing test cases…" : "Create test cases"}
        </button>
        {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        {summary ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              summary.passed === summary.total ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}
          >
            {summary.passed}/{summary.total} passed
          </span>
        ) : (
          <span className="text-sm text-muted">{cases.length} test cases · edit any prompt before running</span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={writeCases}
            disabled={busy}
            title="Write new test cases"
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:border-accent disabled:opacity-40"
          >
            <RefreshCw className="size-3.5" aria-hidden /> New cases
          </button>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {phase === "running" && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
            {phase === "running" ? "Running…" : phase === "done" ? "Run again" : "Run tests"}
          </button>
        </div>
      </div>

      {simulated && <SimulatedNote className="mt-3" />}
      {status && <p className="mt-3 text-xs text-muted">{status}…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      <ol className="mt-4 space-y-3">
        {cases.map((c, i) => (
          <CaseCard
            key={i}
            index={i}
            testCase={c}
            result={results[i] ?? { status: "idle" }}
            editable={!busy}
            onPromptChange={(prompt) => updateCase(i, { prompt })}
          />
        ))}
      </ol>
    </div>
  );
}

function CaseCard({
  index,
  testCase,
  result,
  editable,
  onPromptChange,
}: {
  index: number;
  testCase: TestCase;
  result: CaseResult;
  editable: boolean;
  onPromptChange: (prompt: string) => void;
}) {
  const done = result.status === "done" ? result : null;
  return (
    <li className="rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="font-semibold text-muted">TEST {index + 1}</span>
        {result.status === "running" && <LoaderCircle className="size-3.5 animate-spin text-accent" aria-hidden />}
        {done && (
          <>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                done.verdict.passed ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              }`}
            >
              {done.verdict.passed ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleX className="size-3.5" aria-hidden />}
              {done.verdict.passed ? "Pass" : "Fail"} · {done.verdict.score}
            </span>
            {done.simulated ? (
              <span className="text-warning">Simulated</span>
            ) : (
              <span className={done.skillLoaded ? "text-muted" : "text-warning"}>
                {done.skillLoaded ? "Skill used" : "Skill not used"}
              </span>
            )}
          </>
        )}
      </div>

      <label className="sr-only" htmlFor={`case-${index}`}>Test prompt {index + 1}</label>
      <textarea
        id={`case-${index}`}
        value={testCase.prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={!editable}
        rows={3}
        className="w-full resize-y rounded-lg border border-line bg-background p-2.5 text-sm outline-none focus:border-accent disabled:opacity-70"
      />
      {testCase.criteria.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {testCase.criteria.map((c, n) => (
            <li key={n} className="flex gap-1.5">
              <span aria-hidden>•</span>
              {c}
            </li>
          ))}
        </ul>
      )}

      {done && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="text-sm">{done.verdict.feedback}</p>
          <details className="group text-sm">
            <summary className="cursor-pointer text-xs font-medium text-accent">Show the answer</summary>
            <div className="mt-2 max-h-96 overflow-auto rounded-lg bg-background p-3 text-sm">
              {done.output ? <Markdown>{done.output}</Markdown> : <span className="text-muted">(no text output)</span>}
            </div>
          </details>
        </div>
      )}
      {result.status === "error" && <p className="mt-2 text-sm text-danger">{result.message}</p>}
    </li>
  );
}
