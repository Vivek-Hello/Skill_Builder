import { deleteSkill, runWithSkill, uploadSkill } from "@/server/ai/claude";
import { judgeOutput, simulateRun } from "@/server/ai/gemini";
import { simulated } from "@/server/playground-sessions";
import { parseCases, parseFiles, SKILL_NAME } from "@/server/request";
import type { TestEvent } from "@/lib/types";

// Each case is a full Claude run with code execution, so give the whole batch room
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const files = parseFiles(body?.files);
  const cases = parseCases(body?.cases);
  const skillName = typeof body?.skillName === "string" ? body.skillName : "";
  if (!files || !cases || !SKILL_NAME.test(skillName)) {
    return Response.json({ error: "Invalid test request." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: TestEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let skillId: string | null = null;
      try {
        // Without a Claude key, Gemini plays Claude with the skill in its instructions
        const sim = simulated();
        if (!sim) {
          emit({ type: "status", message: "Uploading skill to Claude" });
          skillId = await uploadSkill(skillName, files);
        }
        emit({ type: "status", message: sim ? "Running test prompts (simulated with Gemini)" : "Running test prompts" });

        const id = skillId;
        const results = await Promise.all(
          cases.map(async (testCase, index) => {
            emit({ type: "case", index, status: "running" });
            try {
              const run = id
                ? await runWithSkill(id, skillName, testCase.prompt)
                : { output: await simulateRun(files, testCase.prompt), skillLoaded: true, toolCalls: 0 };
              const verdict = await judgeOutput(testCase, run.output);
              emit({
                type: "case",
                index,
                status: "done",
                output: run.output,
                skillLoaded: run.skillLoaded,
                toolCalls: run.toolCalls,
                simulated: !id,
                verdict,
              });
              return verdict.passed;
            } catch (err) {
              console.error(`test case ${index} failed`, err);
              emit({ type: "case", index, status: "error", message: err instanceof Error ? err.message : "Run failed" });
              return false;
            }
          }),
        );
        emit({ type: "done", passed: results.filter(Boolean).length, total: cases.length });
      } catch (err) {
        console.error("skill test failed", err);
        emit({ type: "error", message: err instanceof Error ? err.message : "Test failed" });
      } finally {
        if (skillId) await deleteSkill(skillId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
