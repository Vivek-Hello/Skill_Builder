import "server-only";
import { GoogleGenAI, ThinkingLevel, type GenerateContentParameters } from "@google/genai";
import { SKILL_SPEC } from "./skill-spec";
import type { Candidate, MatchVerdict, SkillAnalysis, SkillFile, ValidationIssue } from "./types";

// "gemini-pro-latest" always points at Google's newest Pro model. When the
// primary model is overloaded, rate-limited or unavailable, fall back in order.
const MODELS = [
  process.env.GEMINI_MODEL || "gemini-pro-latest",
  ...(process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3-flash-preview,gemini-flash-lite-latest").split(","),
].map((m) => m.trim()).filter((m, i, all) => m && all.indexOf(m) === i);

let client: GoogleGenAI | null = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

type Request = Omit<GenerateContentParameters, "model">;

// Retry overload (503) and rate limits (429) briefly, then try the next model.
// 404 means the model isn't offered to this key, so skip straight to the next.
// An overloaded model can also just crawl (a few tokens/sec) without erroring,
// so each model gets a time budget; the last one in the list gets no limit.
async function generate(req: Request, timeoutMs: number) {
  let lastErr: unknown;
  for (const [i, model] of MODELS.entries()) {
    const isLast = i === MODELS.length - 1;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const res = await ai().models.generateContent({
          ...req,
          model,
          config: { ...req.config, abortSignal: isLast ? undefined : AbortSignal.timeout(timeoutMs) },
        });
        console.log(`[gemini] ${model} ok in ${((Date.now() - started) / 1000).toFixed(1)}s`);
        return res;
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number }).status;
        const timedOut = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
        console.warn(`[gemini] ${model} failed (${timedOut ? "timeout" : status})`);
        if (!timedOut && status !== 503 && status !== 429 && status !== 404) throw err;
        if (timedOut || status === 404) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  throw lastErr;
}

// Small classification steps don't need deep reasoning; skill writing does
async function generateJson<T>(
  prompt: string,
  schema: object,
  {
    system,
    thinking = ThinkingLevel.LOW,
    timeoutMs = 45_000,
  }: { system?: string; thinking?: ThinkingLevel; timeoutMs?: number } = {},
): Promise<T> {
  const res = await generate({
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      thinkingConfig: { thinkingLevel: thinking },
    },
  }, timeoutMs);
  if (!res.text) throw new Error("Gemini returned an empty response");
  return JSON.parse(res.text) as T;
}

export function analyzeDescription(description: string) {
  return generateJson<SkillAnalysis>(
    `A user wants a Claude Agent Skill. Their description:\n"""${description}"""\n\n` +
      `Return a kebab-case skill name (no "claude" or "anthropic"), a one-sentence summary, ` +
      `3-6 short search keywords someone would put in a skill's name or description, ` +
      `and 3-6 example user requests that should trigger the skill.`,
    {
      type: "object",
      properties: {
        name: { type: "string" },
        summary: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        triggers: { type: "array", items: { type: "string" } },
      },
      required: ["name", "summary", "keywords", "triggers"],
    },
  );
}

// Google Search grounding can't be combined with JSON output, so ask for plain
// text and pull GitHub URLs out of it.
export async function searchWebForSkills(analysis: SkillAnalysis): Promise<string[]> {
  const res = await generate({
    contents:
      `Find existing open-source Claude Agent Skills (folders containing a SKILL.md file) that do this: ` +
      `${analysis.summary} Keywords: ${analysis.keywords.join(", ")}.\n` +
      `List up to 8 GitHub URLs pointing at the skill folder or its SKILL.md, one per line. ` +
      `Only list URLs you found in search results.`,
    config: { tools: [{ googleSearch: {} }], thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
  }, 60_000);
  const text = res.text ?? "";
  const urls = text.match(/https:\/\/github\.com\/[^\s)\]"'>]+/g) ?? [];
  return [...new Set(urls)];
}

export function pickBestMatch(description: string, candidates: Candidate[]) {
  const list = candidates
    .map((c, i) => `[${i}] ${c.repo}/${c.path}\nname: ${c.name}\ndescription: ${c.description}`)
    .join("\n\n");
  return generateJson<MatchVerdict>(
    `The user wants a skill that does:\n"""${description}"""\n\nExisting skills:\n${list}\n\n` +
      `Pick the single skill that best does what the user asked. Score 0-100 for how well ` +
      `it covers the request as-is (90+ = same purpose and scope, 70 = close but missing parts, ` +
      `<50 = different task). Use index -1 and score 0 if none are relevant.`,
    {
      type: "object",
      properties: {
        index: { type: "integer" },
        score: { type: "integer" },
        reason: { type: "string" },
      },
      required: ["index", "score", "reason"],
    },
  );
}

const FILES_SCHEMA = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the skill folder, e.g. SKILL.md or scripts/run.py" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  required: ["files"],
};

const GENERATOR_SYSTEM =
  `You are an expert author of Claude Agent Skills. You write skills that are ` +
  `precise, practical and follow the format exactly.\n\n${SKILL_SPEC}`;

export async function generateSkill(
  description: string,
  analysis: SkillAnalysis,
  inspiration: Candidate[],
): Promise<SkillFile[]> {
  const refs = inspiration.length
    ? `\n\nRelated existing skills (for ideas only, don't copy):\n` +
      inspiration.map((c) => `- ${c.name}: ${c.description}`).join("\n")
    : "";
  const out = await generateJson<{ files: SkillFile[] }>(
    `Build a complete Claude Agent Skill for this request:\n"""${description}"""\n\n` +
      `Suggested name: ${analysis.name}\n` +
      `It should trigger on requests like:\n${analysis.triggers.map((t) => `- ${t}`).join("\n")}` +
      refs +
      `\n\nReturn every file in the skill folder. SKILL.md is required; add scripts/ or ` +
      `references/ files only when they make the skill genuinely better.`,
    FILES_SCHEMA,
    { system: GENERATOR_SYSTEM, thinking: ThinkingLevel.MEDIUM, timeoutMs: 150_000 },
  );
  return out.files;
}

export async function repairSkill(files: SkillFile[], issues: ValidationIssue[]): Promise<SkillFile[]> {
  const dump = files.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n");
  const out = await generateJson<{ files: SkillFile[] }>(
    `This skill failed validation. Fix every problem and return the full corrected file set.\n\n` +
      `Problems:\n${issues.map((i) => `- [${i.level}] ${i.message}`).join("\n")}\n\nFiles:\n${dump}`,
    FILES_SCHEMA,
    { system: GENERATOR_SYSTEM, thinking: ThinkingLevel.MEDIUM, timeoutMs: 150_000 },
  );
  return out.files;
}
