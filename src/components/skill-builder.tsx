"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import type { BuildEvent, BuildResult, StepId } from "@/lib/types";

const STEPS: { id: StepId; label: string }[] = [
  { id: "analyze", label: "Understand the request" },
  { id: "search", label: "Search GitHub and the web" },
  { id: "match", label: "Compare existing skills" },
  { id: "clone", label: "Clone matching skill" },
  { id: "generate", label: "Generate new skill" },
  { id: "validate", label: "Validate skill format" },
];

const EXAMPLES = [
  "Review SQL migration files for unsafe operations like dropping columns or locking large tables",
  "Turn meeting transcripts into action items grouped by owner with due dates",
  "Generate Playwright end-to-end tests from a user story",
];

type StepState = { status: "pending" | "running" | "done" | "skipped"; detail?: string };
const initialSteps = () =>
  Object.fromEntries(STEPS.map((s) => [s.id, { status: "pending" }])) as Record<StepId, StepState>;

export function SkillBuilder() {
  const [description, setDescription] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function build() {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setRunning(true);
    setSteps(initialSteps());
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handle(JSON.parse(line) as BuildEvent);
        }
      }
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRunning(false);
    }
  }

  function handle(e: BuildEvent) {
    if (e.type === "step") setSteps((s) => ({ ...s, [e.step]: { status: e.status, detail: e.detail } }));
    else if (e.type === "result") setResult(e.result);
    else setError(e.message);
  }

  const started = running || result || error;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Skill Builder</h1>
        <p className="mt-2 text-muted">
          Describe what you want Claude to do. We find an existing skill that already does it, or build a new one.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-panel p-4 shadow-sm">
        <label htmlFor="desc" className="sr-only">Skill description</label>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running && description.trim().length >= 10) build();
          }}
          placeholder="e.g. A skill that reviews pull requests for security issues in Node.js APIs…"
          rows={4}
          maxLength={4000}
          className="w-full resize-y rounded-lg border border-line bg-background p-3 text-[15px] outline-none focus:border-accent"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setDescription(ex)}
              className="max-w-full truncate rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-accent hover:text-foreground"
            >
              {ex}
            </button>
          ))}
          <button
            type="button"
            onClick={build}
            disabled={running || description.trim().length < 10}
            className="ml-auto rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {running ? "Building…" : "Build skill"}
          </button>
        </div>
      </section>

      {started && (
        <section className="mt-6 rounded-xl border border-line bg-panel p-4">
          <ol className="space-y-2">
            {STEPS.map(({ id, label }) => (
              <StepRow key={id} label={label} state={steps[id]} />
            ))}
          </ol>
        </section>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {error}
        </div>
      )}

      {result && <ResultView result={result} />}
    </div>
  );
}

function StepRow({ label, state }: { label: string; state: StepState }) {
  const icon = {
    pending: <span className="size-2 rounded-full bg-line" />,
    running: <span className="size-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />,
    done: <span className="text-accent">✓</span>,
    skipped: <span className="text-muted">–</span>,
  }[state.status];
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className={state.status === "pending" || state.status === "skipped" ? "text-muted" : ""}>
        {label}
        {state.detail && <span className="block text-xs text-muted break-words">{state.detail}</span>}
      </span>
    </li>
  );
}

function ResultView({ result }: { result: BuildResult }) {
  const [active, setActive] = useState("SKILL.md");
  const [copied, setCopied] = useState(false);
  const file = result.files.find((f) => f.path === active) ?? result.files[0];
  const errors = result.issues.filter((i) => i.level === "error");
  const warnings = result.issues.filter((i) => i.level === "warning");

  async function download() {
    const zip = new JSZip();
    const folder = zip.folder(result.skillName)!;
    for (const f of result.files) folder.file(f.path, f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `${result.skillName}.zip` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!file) return;
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-4">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            result.origin === "cloned" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-accent/15 text-accent"
          }`}
        >
          {result.origin === "cloned" ? "Existing skill found" : "Newly generated"}
        </span>
        <span className="font-mono text-sm">{result.skillName}</span>
        <button
          type="button"
          onClick={download}
          className="ml-auto rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white"
        >
          Download .zip
        </button>
        {result.match && (
          <p className="w-full text-sm text-muted">
            Cloned from{" "}
            <a href={result.match.url} target="_blank" rel="noreferrer" className="text-accent underline">
              {result.match.repo}
            </a>{" "}
            · {result.match.license} · ★ {result.match.stars} · match {result.match.score}/100. {result.match.reason}
          </p>
        )}
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="space-y-1 rounded-xl border border-line bg-panel p-4 text-sm">
          {[...errors, ...warnings].map((i, n) => (
            <li key={n} className={i.level === "error" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>
              {i.level === "error" ? "Error" : "Warning"}: {i.message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid overflow-hidden rounded-xl border border-line bg-panel md:grid-cols-[220px_1fr]">
        <nav className="border-b border-line p-2 md:border-r md:border-b-0" aria-label="Skill files">
          {[...result.files]
            .sort((a, b) => (a.path === "SKILL.md" ? -1 : b.path === "SKILL.md" ? 1 : a.path.localeCompare(b.path)))
            .map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setActive(f.path)}
                className={`block w-full truncate rounded-md px-2 py-1.5 text-left font-mono text-xs ${
                  f.path === file?.path ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {f.path}
              </button>
            ))}
        </nav>
        <div className="min-w-0">
          <div className="flex items-center border-b border-line px-3 py-2">
            <span className="truncate font-mono text-xs text-muted">{file?.path}</span>
            <button type="button" onClick={copy} className="ml-auto text-xs text-muted hover:text-foreground">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="max-h-[600px] overflow-auto p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
            {file?.content}
          </pre>
        </div>
      </div>

      {result.related.length > 0 && (
        <div className="rounded-xl border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-medium">Related skills we found</h2>
          <ul className="space-y-2 text-sm">
            {result.related.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-accent underline">
                  {r.name}
                </a>{" "}
                <span className="text-muted">({r.repo}). {r.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
