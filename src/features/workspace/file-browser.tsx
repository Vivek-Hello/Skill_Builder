"use client";

import { useMemo, useState } from "react";
import { Check, Code, Copy, Eye, FileCode, FileText, Folder } from "lucide-react";
import type { SkillFile } from "@/lib/types";
import { Markdown } from "@/components/markdown";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function FileBrowser({ files }: { files: SkillFile[] }) {
  const sorted = useMemo(
    () =>
      [...files].sort((a, b) =>
        a.path === "SKILL.md" ? -1 : b.path === "SKILL.md" ? 1 : a.path.localeCompare(b.path),
      ),
    [files],
  );
  const [active, setActive] = useState(sorted[0]?.path ?? "");
  const [view, setView] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);
  const file = sorted.find((f) => f.path === active) ?? sorted[0];
  const isMarkdown = file?.path.toLowerCase().endsWith(".md");

  async function copy() {
    if (!file) return;
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Group files by top-level folder for the explorer
  const groups = useMemo(() => {
    const map = new Map<string, SkillFile[]>();
    for (const f of sorted) {
      const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
      map.set(dir, [...(map.get(dir) ?? []), f]);
    }
    return [...map.entries()];
  }, [sorted]);

  return (
    <div className="grid min-w-0 grid-cols-1 overflow-hidden rounded-2xl border border-line bg-panel md:grid-cols-[210px_minmax(0,1fr)]">
      <nav className="border-b border-line bg-panel-2/50 p-2 md:border-r md:border-b-0" aria-label="Skill files">
        <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wide text-muted">FILES · {files.length}</p>
        {groups.map(([dir, list]) => (
          <div key={dir || "root"} className="mb-1">
            {dir && (
              <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted">
                <Folder className="size-3.5" aria-hidden /> {dir}/
              </p>
            )}
            {list.map((f) => {
              const name = f.path.slice(dir ? dir.length + 1 : 0);
              const Icon = f.path.endsWith(".md") ? FileText : FileCode;
              return (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setActive(f.path)}
                  className={`flex w-full items-center gap-1.5 truncate rounded-md py-1.5 text-left font-mono text-xs ${
                    dir ? "pl-6 pr-2" : "px-2"
                  } ${f.path === file?.path ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-2 hover:text-foreground"}`}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="min-w-0">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="min-w-0 truncate font-mono text-xs text-muted">{file?.path}</span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {isMarkdown && (
              <div className="flex rounded-lg border border-line p-0.5 text-xs">
                {(["preview", "source"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 capitalize ${
                      view === v ? "bg-panel-2 font-medium" : "text-muted"
                    }`}
                  >
                    {v === "preview" ? <Eye className="size-3" aria-hidden /> : <Code className="size-3" aria-hidden />}
                    {v}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-panel-2 hover:text-foreground"
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="max-h-[680px] overflow-auto">
          {file && isMarkdown && view === "preview" ? <MarkdownPreview content={file.content} /> : (
            <pre className="p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">{file?.content}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

// Show SKILL.md frontmatter as a card above the rendered body
function MarkdownPreview({ content }: { content: string }) {
  const m = content.match(FRONTMATTER);
  const body = m ? content.slice(m[0].length) : content;
  const fields = m
    ? m[1]
        .split(/\r?\n(?=\S)/)
        .map((line) => {
          const i = line.indexOf(":");
          return i > 0 ? [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")] : null;
        })
        .filter((x): x is [string, string] => x !== null)
    : [];
  return (
    <div className="p-5">
      {fields.length > 0 && (
        <dl className="mb-5 space-y-2 rounded-xl border border-line bg-panel-2/60 p-4 text-sm">
          {fields.map(([k, v]) => (
            <div key={k} className="grid gap-1 sm:grid-cols-[100px_1fr]">
              <dt className="font-mono text-xs text-muted">{k}</dt>
              <dd className={k === "name" ? "font-mono font-medium" : ""}>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <Markdown className="text-sm">{body}</Markdown>
    </div>
  );
}
