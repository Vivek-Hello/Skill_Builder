"use client";

import { useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  FlaskConical,
  GitFork,
  ListChecks,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";
import type { BuildResult, ScoredCandidate } from "@/lib/types";
import { FileBrowser } from "@/features/workspace/file-browser";
import { MatchesList, type MatchMode } from "@/features/workspace/matches-list";
import { Playground } from "@/features/playground/playground";
import { TestPanel } from "@/features/testing/test-panel";

type Tab = "try" | "test" | "sources" | "checks";

type Props = {
  result: BuildResult;
  description: string;
  busy: boolean;
  onUseMatch: (m: ScoredCandidate, mode: MatchMode) => Promise<void>;
  onRegenerate: () => void;
};

export function Workspace({ result, description, busy, onUseMatch, onRegenerate }: Props) {
  const [tab, setTab] = useState<Tab>("try");
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

  const tabs: { id: Tab; label: string; icon: typeof Search; count?: number; alert?: boolean }[] = [
    { id: "try", label: "Try it", icon: MessageSquare },
    { id: "test", label: "Test", icon: FlaskConical },
    { id: "sources", label: "Sources", icon: Search, count: result.matches.length },
    { id: "checks", label: "Checks", icon: ListChecks, count: result.issues.length, alert: errors.length > 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link href="/skills" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> My skills
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight wrap-anywhere sm:text-2xl">{result.skillName}</h1>
            <OriginBadge origin={result.origin} />
            {errors.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
                <TriangleAlert className="size-3.5" aria-hidden /> {errors.length} error{errors.length > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-medium text-muted">
                <BadgeCheck className="size-3.5 text-success" aria-hidden /> Valid
                {warnings.length > 0 && ` · ${warnings.length} warning${warnings.length > 1 ? "s" : ""}`}
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-3xl text-sm text-muted">&ldquo;{description}&rdquo;</p>
          {result.source && result.origin === "cloned" && (
            <p className="mt-1 text-xs text-muted">
              Cloned from{" "}
              <a href={result.source.url} target="_blank" rel="noreferrer" className="text-accent underline">
                {result.source.repo}
              </a>{" "}
              · {result.source.license} license · ★ {result.source.stars}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3.5 py-2 text-sm font-medium hover:border-accent disabled:opacity-40"
          >
            <RefreshCw className="size-4" aria-hidden />
            {result.origin === "generated" ? "Regenerate" : "Build new instead"}
          </button>
          <button
            type="button"
            onClick={download}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            <Download className="size-4" aria-hidden /> Download .zip
          </button>
        </div>
      </div>

      {result.origin === "adapted" && result.source && <AdaptationNotice result={result} />}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
        <FileBrowser files={result.files} />

        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-panel lg:sticky lg:top-20">
          <div role="tablist" className="flex overflow-x-auto border-b border-line px-2 scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm ${
                  tab === t.id ? "font-medium text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                <t.icon className="size-4" aria-hidden />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-semibold ${
                      t.alert ? "bg-danger/10 text-danger" : "bg-panel-2 text-muted"
                    }`}
                  >
                    {t.count}
                  </span>
                )}
                {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>

          {/* Keep panels mounted so a running chat or test isn't lost when switching tabs */}
          <div hidden={tab !== "try"}>
            <Playground skillName={result.skillName} files={result.files} suggestions={result.examples} />
          </div>
          <div hidden={tab !== "test"}>
            <TestPanel skillName={result.skillName} files={result.files} />
          </div>
          <div hidden={tab !== "sources"}>
            <MatchesList matches={result.matches} activeUrl={result.source?.url} onUse={onUseMatch} />
          </div>
          <div hidden={tab !== "checks"}>
            <Checks result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}

function OriginBadge({ origin }: { origin: BuildResult["origin"] }) {
  const style = {
    cloned: { icon: GitFork, label: "Found on GitHub", cls: "bg-success/10 text-success" },
    adapted: { icon: WandSparkles, label: "Adapted", cls: "bg-accent-soft text-accent" },
    generated: { icon: Sparkles, label: "Newly built", cls: "bg-accent-soft text-accent" },
  }[origin];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.cls}`}>
      <style.icon className="size-3.5" aria-hidden /> {style.label}
    </span>
  );
}

// Tell the user plainly that we modified someone else's skill, and how
function AdaptationNotice({ result }: { result: BuildResult }) {
  const source = result.source!;
  return (
    <section className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft/60 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <WandSparkles className="size-4 text-accent" aria-hidden />
        We adapted an existing skill instead of writing a new one
      </h2>
      <p className="mt-1 text-sm text-muted">
        <a href={source.url} target="_blank" rel="noreferrer" className="text-accent underline">
          {source.repo}
        </a>{" "}
        (★ {source.stars}) already covered most of your request, so we kept it and changed only what you needed.
        Its {source.license} license is included in the download.
      </p>
      {result.adaptation && result.adaptation.changes.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold tracking-wide text-muted">WHAT WE CHANGED</p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {result.adaptation.changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Checks({ result }: { result: BuildResult }) {
  if (result.issues.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-success/10 text-success">
          <BadgeCheck className="size-6" aria-hidden />
        </span>
        <h3 className="mt-4 font-semibold">All checks passed</h3>
        <p className="mt-1 max-w-sm text-sm text-muted">
          The name, description, structure and file references all follow the Agent Skill format.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2 p-4">
      {result.issues.map((i, n) => (
        <li
          key={n}
          className={`flex gap-2 rounded-xl border p-3 text-sm ${
            i.level === "error" ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"
          }`}
        >
          <TriangleAlert className={`mt-0.5 size-4 shrink-0 ${i.level === "error" ? "text-danger" : "text-warning"}`} aria-hidden />
          {i.message}
        </li>
      ))}
    </ul>
  );
}
