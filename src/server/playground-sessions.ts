import "server-only";
import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { claude, deleteSkill, uploadSkill } from "@/server/ai/claude";
import { simulateChat, type ChatTurn } from "@/server/ai/gemini";
import type { PlaygroundEvent, SkillFile } from "@/lib/types";

// Free playground: cheap fast model, time-boxed sessions, a few sessions per visitor per day
const MODEL = process.env.PLAYGROUND_MODEL || "claude-haiku-5-5";
export const SESSION_MINUTES = Number(process.env.PLAYGROUND_MINUTES) || 10;
const SESSIONS_PER_DAY = Number(process.env.PLAYGROUND_SESSIONS_PER_DAY) || 3;
// Hidden backstop so one session can't run up the bill inside its time window
const MAX_MESSAGES = Number(process.env.PLAYGROUND_MAX_MESSAGES) || 30;
const MAX_REPLY_TOKENS = 4000;
const MAX_CONTINUATIONS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Without a Claude key the playground runs a Gemini simulation of Claude using the skill
export const simulated = () => !process.env.ANTHROPIC_API_KEY;

type Session = {
  id: string;
  owners: string[]; // visitor keys allowed to use it (cookie + IP)
  skillId: string | null; // uploaded Claude skill; null when simulated
  files: SkillFile[];
  skillName: string;
  expiresAt: number;
  userMessages: number;
  busy: boolean;
  containerId?: string;
  // Append-only: earlier turns are never edited, so replayed thinking blocks stay valid
  messages: Anthropic.Beta.BetaMessageParam[];
  simulatedHistory: ChatTurn[];
};

// In-memory for now: resets on restart and isn't shared across server instances.
// Kept on globalThis so dev hot reloads don't wipe it.
type Store = { sessions: Map<string, Session>; starts: Map<string, number[]> };
const g = globalThis as { __playground?: Store };
const store: Store = (g.__playground ??= { sessions: new Map(), starts: new Map() });

export class PlaygroundError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function recentStarts(key: string, now: number) {
  const list = (store.starts.get(key) ?? []).filter((t) => now - t < DAY_MS);
  store.starts.set(key, list);
  return list;
}

// Sessions left today; a visitor is limited by whichever of their keys has used the most
export function sessionsLeft(visitorKeys: string[], now = Date.now()) {
  const used = Math.max(0, ...visitorKeys.map((k) => recentStarts(k, now).length));
  return Math.max(0, SESSIONS_PER_DAY - used);
}

function nextSessionAt(visitorKeys: string[], now: number) {
  const oldest = visitorKeys.flatMap((k) => recentStarts(k, now)).sort((a, b) => a - b)[0];
  return oldest ? oldest + DAY_MS : now;
}

// Expired sessions free their uploaded skill. Runs lazily on every playground call.
async function sweep(now = Date.now()) {
  for (const s of store.sessions.values()) {
    if (s.expiresAt <= now && !s.busy) {
      store.sessions.delete(s.id);
      if (s.skillId) await deleteSkill(s.skillId);
    }
  }
}

export async function startSession(visitorKeys: string[], skillName: string, files: SkillFile[]) {
  const now = Date.now();
  await sweep(now);
  if (sessionsLeft(visitorKeys, now) === 0) {
    const hours = Math.ceil((nextSessionAt(visitorKeys, now) - now) / (60 * 60 * 1000));
    throw new PlaygroundError(
      `You've used your ${SESSIONS_PER_DAY} free sessions for today. Try again in about ${hours} hour${hours === 1 ? "" : "s"}.`,
      429,
    );
  }

  const skillId = simulated() ? null : await uploadSkill(skillName, files);
  for (const k of visitorKeys) recentStarts(k, now).push(now);
  const session: Session = {
    id: randomUUID(),
    owners: visitorKeys,
    skillId,
    files,
    skillName,
    expiresAt: now + SESSION_MINUTES * 60 * 1000,
    userMessages: 0,
    busy: false,
    messages: [],
    simulatedHistory: [],
  };
  store.sessions.set(session.id, session);
  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    sessionsLeft: sessionsLeft(visitorKeys, now),
    simulated: !skillId,
  };
}

function ownedSession(sessionId: string, visitorKeys: string[]) {
  const s = store.sessions.get(sessionId);
  if (!s || !s.owners.some((o) => visitorKeys.includes(o))) {
    throw new PlaygroundError("This session doesn't exist or has ended.", 404);
  }
  return s;
}

export async function endSession(sessionId: string, visitorKeys: string[]) {
  const s = ownedSession(sessionId, visitorKeys);
  s.expiresAt = Math.min(s.expiresAt, Date.now());
  await sweep();
}

// Validate and reserve the session before streaming starts, so errors become HTTP statuses
export async function claimTurn(sessionId: string, visitorKeys: string[]) {
  await sweep();
  const s = ownedSession(sessionId, visitorKeys);
  if (s.expiresAt <= Date.now()) throw new PlaygroundError("Your free session has ended.", 410);
  if (s.userMessages >= MAX_MESSAGES) throw new PlaygroundError("You've reached this session's message limit.", 429);
  if (s.busy) throw new PlaygroundError("Wait for Claude to finish replying.", 409);
  s.busy = true;
  return s;
}

export async function runTurn(s: Session, text: string, emit: (e: PlaygroundEvent) => void) {
  try {
    s.userMessages++;
    if (!s.skillId) {
      s.simulatedHistory.push({ role: "user", text });
      const reply = await simulateChat(s.files, s.simulatedHistory, (t) => emit({ type: "text", text: t }));
      s.simulatedHistory.push({ role: "assistant", text: reply });
      emit({ type: "done", messagesLeft: MAX_MESSAGES - s.userMessages });
      return;
    }

    s.messages.push({ role: "user", content: text });
    let skillUsed = false;

    // Code execution can pause a long turn; continue in the same container until it finishes
    for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
      const stream = claude().beta.messages.stream({
        model: MODEL,
        max_tokens: MAX_REPLY_TOKENS,
        output_config: { effort: "medium" },
        betas: ["code-execution-2025-08-25"],
        container: {
          ...(s.containerId ? { id: s.containerId } : {}),
          skills: [{ type: "custom", skill_id: s.skillId, version: "latest" }],
        },
        tools: [{ type: "code_execution_20260521", name: "code_execution" }],
        messages: s.messages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          emit({ type: "text", text: event.delta.text });
        } else if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
          emit({ type: "tool" });
        }
      }

      const message = await stream.finalMessage();
      s.containerId = message.container?.id ?? s.containerId;
      s.messages.push({ role: "assistant", content: message.content });

      if (!skillUsed && usedSkill(message.content, s.skillName)) {
        skillUsed = true;
        emit({ type: "skill_used" });
      }
      if (message.stop_reason === "refusal") emit({ type: "text", text: "\n\n(Claude declined to answer this.)" });
      if (message.stop_reason === "max_tokens") emit({ type: "text", text: "\n\n(Reply cut short: free-tier length limit.)" });
      if (message.stop_reason !== "pause_turn") break;
    }

    emit({ type: "done", messagesLeft: MAX_MESSAGES - s.userMessages });
  } finally {
    s.busy = false;
  }
}

// Claude loads a skill by reading its SKILL.md inside the container
function usedSkill(content: Anthropic.Beta.BetaContentBlock[], skillName: string) {
  return content.some((b) => {
    if (b.type !== "server_tool_use") return false;
    const input = JSON.stringify(b.input);
    return input.includes("SKILL.md") || input.includes(`/${skillName}/`);
  });
}
