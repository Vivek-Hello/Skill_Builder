import { writeTestCases } from "@/server/ai/gemini";
import { parseFiles } from "@/server/request";

export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const files = parseFiles(body?.files);
  if (!files) return Response.json({ error: "Invalid skill files." }, { status: 400 });

  try {
    return Response.json({ cases: await writeTestCases(files) });
  } catch (err) {
    console.error("test case generation failed", err);
    return Response.json({ error: "Couldn't write test cases. Try again." }, { status: 502 });
  }
}
