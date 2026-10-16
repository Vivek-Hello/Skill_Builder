import "server-only";
import { GoogleGenAI, ThinkingLevel, type GenerateContentParameters } from "@google/genai";
import { SKILL_SPEC } from "@/lib/skill-spec";
import type {
  Candidate,
  MatchVerdict,
  SkillAnalysis,
  SkillFile,
  TestCase,
  TestVerdict,
  ValidationIssue,
} from "@/lib/types";

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

// Score every candidate so the user can choose, not just the top one
export async function scoreMatches(description: string, candidates: Candidate[]): Promise<MatchVerdict[]> {
  const list = candidates
    .map((c, i) => `[${i}] ${c.repo}/${c.path}\nname: ${c.name}\ndescription: ${c.description}`)
    .join("\n\n");
  const out = await generateJson<{ scores: MatchVerdict[] }>(
    `The user wants a skill that does:\n"""${description}"""\n\nExisting skills:\n${list}\n\n` +
      `Score every skill 0-100 for how well it covers the request as-is (90+ = same purpose ` +
      `and scope, 70 = close but missing parts, <50 = different task). Give a one-sentence reason each.`,
    {
      type: "object",
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer" },
              score: { type: "integer" },
              reason: { type: "string" },
            },
            required: ["index", "score", "reason"],
          },
        },
      },
      required: ["scores"],
    },
  );
  return out.scores.filter((s) => s.index >= 0 && s.index < candidates.length);
}

const dumpFiles = (files: SkillFile[]) => files.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n");

export async function writeTestCases(files: SkillFile[], count = 3): Promise<TestCase[]> {
  const out = await generateJson<{ cases: TestCase[] }>(
    `Here is a Claude Agent Skill:\n\n${dumpFiles(files)}\n\n` +
      `Write ${count} realistic test prompts a user would send that should make Claude use this skill. ` +
      `Make them varied (a simple case, a harder case, an edge case) and self-contained: include ` +
      `any input data inline, since Claude can't see the user's files. For each, list 2-4 concrete, ` +
      `checkable criteria a good answer must meet.`,
    {
      type: "object",
      properties: {
        cases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              prompt: { type: "string" },
              criteria: { type: "array", items: { type: "string" } },
            },
            required: ["prompt", "criteria"],
          },
        },
      },
      required: ["cases"],
    },
    { thinking: ThinkingLevel.MEDIUM, timeoutMs: 90_000 },
  );
  return out.cases.slice(0, count);
}

export function judgeOutput(testCase: TestCase, output: string) {
  return generateJson<TestVerdict>(
    `You are grading an AI assistant's answer.\n\nUser prompt:\n"""${testCase.prompt}"""\n\n` +
      `Criteria:\n${testCase.criteria.map((c) => `- ${c}`).join("\n")}\n\n` +
      `Answer:\n"""${output || "(empty)"}"""\n\n` +
      `Score 0-100 for how well the answer meets the criteria. passed = true only if every ` +
      `criterion is met. feedback: one or two sentences on what was missing or wrong.`,
    {
      type: "object",
      properties: {
        score: { type: "integer" },
        passed: { type: "boolean" },
        feedback: { type: "string" },
      },
      required: ["score", "passed", "feedback"],
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

// Make the smallest set of changes to an existing skill so it covers the request,
// and explain them so we can tell the user exactly what was modified.
export async function adaptSkill(
  description: string,
  files: SkillFile[],
  origin: { repo: string; license: string | null },
): Promise<{ files: SkillFile[]; changes: string[] }> {
  return generateJson(
    `A user wants a Claude Agent Skill for this request:\n"""${description}"""\n\n` +
      `The skill below (from ${origin.repo}, ${origin.license} license) already does most of it. ` +
      `Adapt it with the smallest set of changes that makes it fully cover the request:\n` +
      `- Keep everything that already works, and keep the author's structure and style.\n` +
      `- Add or change only what the request needs; remove only what would contradict it.\n` +
      `- Leave LICENSE, NOTICE and attribution files exactly as they are.\n` +
      `- Update the description so it says what the adapted skill does and when to use it. ` +
      `Change the name only if the purpose meaningfully changed.\n\n` +
      `Return the complete file set, and in "changes" list 2-6 short plain-English bullets ` +
      `describing what you changed and why.\n\nFiles:\n${dumpFiles(files)}`,
    {
      type: "object",
      properties: {
        files: FILES_SCHEMA.properties.files,
        changes: { type: "array", items: { type: "string" } },
      },
      required: ["files", "changes"],
    },
    { system: GENERATOR_SYSTEM, thinking: ThinkingLevel.MEDIUM, timeoutMs: 150_000 },
  );
}

export async function repairSkill(files: SkillFile[], issues: ValidationIssue[]): Promise<SkillFile[]> {
  const out = await generateJson<{ files: SkillFile[] }>(
    `This skill failed validation. Fix every problem and return the full corrected file set.\n\n` +
      `Problems:\n${issues.map((i) => `- [${i.level}] ${i.message}`).join("\n")}\n\nFiles:\n${dumpFiles(files)}`,
    FILES_SCHEMA,
    { system: GENERATOR_SYSTEM, thinking: ThinkingLevel.MEDIUM, timeoutMs: 150_000 },
  );
  return out.files;
}

// --- Simulated Claude (used when no ANTHROPIC_API_KEY is configured) ---

export type ChatTurn = { role: "user" | "assistant"; text: string };

function simulationSystem(files: SkillFile[]) {
  return (
    `You are Claude, an AI assistant made by Anthropic. You have one Agent Skill installed, ` +
    `shown below. Behave the way Claude does with skills: when a request falls within the ` +
    `skill's description, follow SKILL.md closely and consult its bundled files as it directs; ` +
    `otherwise answer normally. You can't execute code in this environment, so when the skill ` +
    `says to run a script, show the command you'd run and work through what it would do.\n\n` +
    `Installed skill files:\n\n${dumpFiles(files)}`
  );
}

// Same model fallback as generate(), but for streaming: move on if a model fails to start
async function startStream(req: Request) {
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      return await ai().models.generateContentStream({ ...req, model });
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      console.warn(`[gemini] stream ${model} failed (${status})`);
      if (status !== 503 && status !== 429 && status !== 404) throw err;
    }
  }
  throw lastErr;
}

export async function simulateChat(files: SkillFile[], history: ChatTurn[], onText: (text: string) => void) {
  const stream = await startStream({
    contents: history.map((t) => ({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.text }] })),
    config: {
      systemInstruction: simulationSystem(files),
      maxOutputTokens: 4000,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  let full = "";
  for await (const chunk of stream) {
    if (chunk.text) {
      full += chunk.text;
      onText(chunk.text);
    }
  }
  return full;
}

export async function simulateRun(files: SkillFile[], prompt: string) {
  // Gemini occasionally returns an empty answer on long outputs; retry once before giving up
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await generate(
      {
        contents: prompt,
        config: { systemInstruction: simulationSystem(files), thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } },
      },
      120_000,
    );
    if (res.text?.trim()) return res.text;
    console.warn(`[gemini] empty simulated answer (finish: ${res.candidates?.[0]?.finishReason}), attempt ${attempt}`);
  }
  throw new Error("No answer came back for this test. Run it again.");
}
