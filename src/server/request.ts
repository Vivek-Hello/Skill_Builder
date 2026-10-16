import type { SkillFile, TestCase } from "@/lib/types";

const MAX_FILES = 60;
const MAX_TOTAL_BYTES = 1_000_000;

// Skill files come back from the browser, so check shape and size before using them
export function parseFiles(value: unknown): SkillFile[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_FILES) return null;
  let total = 0;
  const files: SkillFile[] = [];
  for (const f of value) {
    if (typeof f?.path !== "string" || typeof f?.content !== "string") return null;
    if (!f.path || f.path.startsWith("/") || f.path.split("/").includes("..")) return null;
    total += f.content.length;
    files.push({ path: f.path, content: f.content });
  }
  if (total > MAX_TOTAL_BYTES || !files.some((f) => f.path === "SKILL.md")) return null;
  return files;
}

export function parseCases(value: unknown, max = 5): TestCase[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) return null;
  const cases: TestCase[] = [];
  for (const c of value) {
    if (typeof c?.prompt !== "string" || !c.prompt.trim() || c.prompt.length > 8000) return null;
    const criteria = Array.isArray(c.criteria)
      ? c.criteria.filter((x: unknown): x is string => typeof x === "string" && x.trim() !== "")
      : [];
    cases.push({ prompt: c.prompt.trim(), criteria });
  }
  return cases;
}

export const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
