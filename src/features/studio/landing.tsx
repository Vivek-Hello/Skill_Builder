"use client";

import { ArrowRight, FlaskConical, MessageSquare, Search, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";

const EXAMPLES = [
  "Review SQL migrations for unsafe operations like dropping columns or locking big tables",
  "Turn meeting transcripts into action items grouped by owner with due dates",
  "Write Playwright end-to-end tests from a user story",
  "Check React components for accessibility problems and suggest fixes",
];

const STEPS = [
  {
    icon: Sparkles,
    title: "Describe it",
    body: "One or two sentences about what you want Claude to be able to do.",
  },
  {
    icon: Search,
    title: "Find, adapt or forge",
    body: "We search GitHub and the web for a skill that already does it. A close match gets adapted to your request; if nothing fits, we write a new one.",
  },
  {
    icon: MessageSquare,
    title: "Try, test, download",
    body: "Chat with Claude using the skill, run graded tests, then download a ready-to-install folder.",
  },
];

const FEATURES = [
  {
    icon: Search,
    title: "Reuse before you build",
    body: "Every request starts with a search. Open-license skills that fit are reused as-is, and close ones are adapted, with every change listed.",
  },
  {
    icon: ShieldCheck,
    title: "Spec-checked",
    body: "Name, description, structure and file references are validated against the Agent Skill format, with auto-repair.",
  },
  {
    icon: MessageSquare,
    title: "Free playground",
    body: "A time-boxed chat with the skill loaded, so you can see how it actually behaves on your requests.",
  },
  {
    icon: FlaskConical,
    title: "Graded tests",
    body: "Realistic test prompts with pass criteria, run in parallel and scored, so you know it works before you ship it.",
  },
];

type Props = {
  description: string;
  onChange: (value: string) => void;
  onBuild: () => void;
};

export function Landing({ description, onChange, onBuild }: Props) {
  const ready = description.trim().length >= 10;

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 pt-16 pb-14 text-center sm:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
            <WandSparkles className="size-3.5 text-accent" aria-hidden />
            Agent Skills for Claude
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Turn a sentence into a <span className="text-accent">Claude skill</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted text-pretty sm:text-lg">
            Describe what you want Claude to do. We find a skill that already does it, adapt one that nearly does, or
            build a new one, and let you try it before you download.
          </p>

          <form
            className="mt-8 rounded-2xl border border-line bg-panel p-2 text-left shadow-[0_8px_30px_-12px_rgb(0_0_0/0.15)] focus-within:border-accent"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) onBuild();
            }}
          >
            <label htmlFor="desc" className="sr-only">Describe your skill</label>
            <textarea
              id="desc"
              value={description}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && ready) onBuild();
              }}
              placeholder="A skill that reviews pull requests for security issues in Node.js APIs…"
              rows={3}
              maxLength={4000}
              autoFocus
              className="w-full resize-none bg-transparent px-3 pt-2 text-base outline-none"
            />
            <div className="flex items-center gap-2 px-1 pb-1">
              <span className="hidden text-xs text-muted sm:inline">Ctrl + Enter to build</span>
              <button
                type="submit"
                disabled={!ready}
                className="ml-auto flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                Build skill <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onChange(ex)}
                className="max-w-full truncate rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-sm font-semibold tracking-wide text-accent">HOW IT WORKS</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-panel p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <s.icon className="size-4.5" aria-hidden />
                </span>
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-line bg-panel-2/40">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Built to ship skills that work</h2>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3">
                <f.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
