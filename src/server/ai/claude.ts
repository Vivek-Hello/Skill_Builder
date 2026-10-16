import "server-only";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import type { SkillFile } from "@/lib/types";

// Skills are tested on the model they'll actually run on for most users
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const MAX_CONTINUATIONS = 4;

let client: Anthropic | null = null;
export function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic();
  return client;
}

export type SkillRun = {
  output: string;
  skillLoaded: boolean;
  toolCalls: number;
  stopReason: string | null;
  model: string;
};

// Upload as a private custom skill. Every file must sit under one top-level folder.
export async function uploadSkill(skillName: string, files: SkillFile[]) {
  const uploads = await Promise.all(
    files.map((f) => toFile(Buffer.from(f.content, "utf8"), `${skillName}/${f.path}`)),
  );
  const skill = await claude().skills.create({
    files: uploads,
    display_name: `${skillName} (skill-builder test)`,
  });
  return skill.id;
}

// Test uploads are throwaway; versions have to go before the skill itself
export async function deleteSkill(skillId: string) {
  try {
    for await (const v of claude().skills.versions.list(skillId)) {
      await claude().skills.versions.delete(v.id, { skill_id: skillId });
    }
    await claude().skills.delete(skillId);
  } catch (err) {
    console.warn(`[claude] couldn't delete test skill ${skillId}`, err);
  }
}

export async function runWithSkill(skillId: string, skillName: string, prompt: string): Promise<SkillRun> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  let containerId: string | undefined;
  let response: Anthropic.Beta.BetaMessage | undefined;
  const blocks: Anthropic.Beta.BetaContentBlock[] = [];

  // Code execution turns can pause; resend with the same container to let Claude finish
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    response = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["code-execution-2025-08-25", "server-side-fallback-2026-07-01"],
      fallbacks: "default",
      container: {
        ...(containerId ? { id: containerId } : {}),
        skills: [{ type: "custom", skill_id: skillId, version: "latest" }],
      },
      tools: [{ type: "code_execution_20260521", name: "code_execution" }],
      messages,
    });
    blocks.push(...response.content);
    containerId = response.container?.id ?? containerId;
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }

  const toolUses = blocks.filter((b) => b.type === "server_tool_use");
  // Claude loads a skill by reading its SKILL.md inside the container
  const skillLoaded = toolUses.some((b) => {
    const input = JSON.stringify(b.input);
    return input.includes("SKILL.md") || input.includes(`/${skillName}/`);
  });
  const output = blocks
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    output: response?.stop_reason === "refusal" ? "(Claude declined this request)" : output,
    skillLoaded,
    toolCalls: toolUses.length,
    stopReason: response?.stop_reason ?? null,
    model: response?.model ?? MODEL,
  };
}
