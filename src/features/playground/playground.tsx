"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, LoaderCircle, MessageSquare, Send, Sparkles, SquareTerminal, X } from "lucide-react";
import { postJson, streamNdjson } from "@/lib/ndjson";
import type { PlaygroundEvent, PlaygroundSession, SkillFile } from "@/lib/types";
import { Markdown } from "@/components/markdown";

type Message = { role: "user" | "assistant"; text: string; skillUsed?: boolean; runningCode?: boolean };
type Quota = { sessionsLeft: number; sessionMinutes: number; simulated: boolean };
type Props = { skillName: string; files: SkillFile[]; suggestions?: string[] };

export function Playground({ skillName, files, suggestions = [] }: Props) {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [session, setSession] = useState<PlaygroundSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/playground/start")
      .then((r) => r.json())
      .then(setQuota)
      .catch(() => {});
  }, []);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const s = await postJson<PlaygroundSession>("/api/playground/start", { skillName, files });
      setSession(s);
      setQuota((q) => q && { ...q, sessionsLeft: s.sessionsLeft });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the playground");
    } finally {
      setStarting(false);
    }
  }

  if (session) {
    return (
      <Chat
        session={session}
        skillName={skillName}
        suggestions={suggestions}
        onClose={() => setSession(null)}
      />
    );
  }

  const outOfSessions = quota?.sessionsLeft === 0;
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <MessageSquare className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold">Try it before you download</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Chat with Claude with <span className="font-mono text-foreground">{skillName}</span> loaded and see how it
        behaves on your own requests.
      </p>
      {quota && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
          <Clock className="size-3.5" aria-hidden />
          {quota.sessionMinutes}-minute free session · {quota.sessionsLeft} left today
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={starting || outOfSessions}
        className="mt-5 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
      >
        {starting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
        {starting ? "Starting…" : outOfSessions ? "No free sessions left today" : "Start free session"}
      </button>
      {quota?.simulated && <SimulatedNote className="mt-5 max-w-sm" />}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}

function Chat({
  session,
  skillName,
  suggestions,
  onClose,
}: {
  session: PlaygroundSession;
  skillName: string;
  suggestions: string[];
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [ended, setEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const remaining = Math.max(0, session.expiresAt - now);
  const expired = ended || remaining === 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Leaving the page ends the session so its uploaded skill is cleaned up promptly
  useEffect(() => {
    const end = () =>
      navigator.sendBeacon?.(
        "/api/playground/end",
        new Blob([JSON.stringify({ sessionId: session.sessionId })], { type: "application/json" }),
      );
    window.addEventListener("pagehide", end);
    return () => window.removeEventListener("pagehide", end);
  }, [session.sessionId]);

  function updateLast(patch: (m: Message) => Message) {
    setMessages((prev) => [...prev.slice(0, -1), patch(prev[prev.length - 1])]);
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || sending || expired) return;
    setInput("");
    setError(null);
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }]);

    try {
      await streamNdjson<PlaygroundEvent>("/api/playground/message", { sessionId: session.sessionId, text }, (e) => {
        if (e.type === "text") updateLast((m) => ({ ...m, text: m.text + e.text, runningCode: false }));
        else if (e.type === "tool") updateLast((m) => ({ ...m, runningCode: true }));
        else if (e.type === "skill_used") updateLast((m) => ({ ...m, skillUsed: true }));
        else if (e.type === "error") setError(e.message);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed");
    } finally {
      updateLast((m) => ({ ...m, runningCode: false }));
      setSending(false);
    }
  }

  async function end() {
    setEnded(true);
    await postJson("/api/playground/end", { sessionId: session.sessionId }).catch(() => {});
  }

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
  const lowTime = remaining < 60000 && !expired;

  return (
    <div className="flex h-[640px] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="flex size-6 items-center justify-center rounded-md bg-accent text-white">
          <Sparkles className="size-3.5" aria-hidden />
        </span>
        <span className="text-sm font-medium">Claude</span>
        {session.simulated && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">Simulated</span>
        )}
        <span
          className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs tabular-nums ${
            lowTime ? "bg-danger/10 text-danger" : "text-muted"
          }`}
          aria-label="Time left in free session"
        >
          <Clock className="size-3.5" aria-hidden />
          {expired ? "Ended" : `${mm}:${ss}`}
        </span>
        <button
          type="button"
          onClick={expired ? onClose : end}
          title={expired ? "Close" : "End session"}
          className="rounded-md p-1 text-muted hover:bg-panel-2 hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
          <span className="sr-only">{expired ? "Close" : "End session"}</span>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="pt-6 text-center">
            <p className="text-sm text-muted">
              Ask something <span className="font-mono">{skillName}</span> should handle.
            </p>
            {suggestions.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-xl border border-line bg-panel px-3 py-2 text-left text-sm hover:border-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-panel-2 px-4 py-2.5 text-sm whitespace-pre-wrap break-words">
              {m.text}
            </div>
          ) : (
            <div key={i} className="text-sm">
              {m.skillUsed && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  <Sparkles className="size-3" aria-hidden /> Used {skillName}
                </span>
              )}
              {m.text ? (
                <Markdown>{m.text}</Markdown>
              ) : (
                sending &&
                i === messages.length - 1 &&
                !m.runningCode && (
                  <span className="inline-flex items-center gap-2 text-muted">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Thinking…
                  </span>
                )
              )}
              {m.runningCode && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                  <SquareTerminal className="size-3.5" aria-hidden /> Running code…
                </p>
              )}
            </div>
          ),
        )}
      </div>

      {error && <p role="alert" className="px-4 pb-2 text-sm text-danger">{error}</p>}

      {expired ? (
        <p className="border-t border-line px-4 py-3 text-sm text-muted">
          Free session ended. Download the skill to keep using it in Claude.
        </p>
      ) : (
        <div className="border-t border-line p-3">
          <div className="flex items-end gap-2 rounded-xl border border-line bg-background p-1.5 focus-within:border-accent">
            <label htmlFor="pg-input" className="sr-only">Message Claude</label>
            <textarea
              id="pg-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={6000}
              placeholder="Message Claude…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              className="flex size-9 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-30"
            >
              <Send className="size-4" aria-hidden />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SimulatedNote({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-lg bg-warning/10 px-3 py-2 text-left text-xs text-warning ${className}`}>
      Preview mode: no Claude API key is set, so Gemini is simulating Claude with this skill. Real Claude may behave
      differently and can run the skill&apos;s scripts.
    </p>
  );
}
