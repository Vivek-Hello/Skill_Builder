import { parse as parseYaml } from "yaml";
import {
  BODY_LINE_SOFT_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  NAME_PATTERN,
  RESERVED_WORDS,
} from "@/lib/skill-spec";
import type { SkillFile, ValidationIssue } from "@/lib/types";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseSkillMd(content: string): {
  meta: Record<string, unknown> | null;
  body: string;
} {
  const m = content.match(FRONTMATTER);
  if (!m) return { meta: null, body: content };
  try {
    const meta = parseYaml(m[1]);
    return { meta: meta && typeof meta === "object" ? meta : null, body: m[2] };
  } catch {
    return { meta: null, body: m[2] };
  }
}

export function validateSkill(files: SkillFile[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  const skillMd = files.find((f) => f.path === "SKILL.md");
  if (!skillMd) {
    err("SKILL.md is missing from the skill root.");
    return issues;
  }

  const { meta, body } = parseSkillMd(skillMd.content);
  if (!meta) {
    err("SKILL.md must start with valid YAML frontmatter between --- lines.");
    return issues;
  }

  const name = meta.name;
  if (typeof name !== "string" || !name) {
    err("Frontmatter is missing `name`.");
  } else {
    if (name.length > NAME_MAX) err(`\`name\` is longer than ${NAME_MAX} characters.`);
    if (!NAME_PATTERN.test(name))
      err("`name` must use only lowercase letters, digits and single hyphens.");
    if (RESERVED_WORDS.some((w) => name.includes(w)))
      err(`\`name\` must not contain "${RESERVED_WORDS.join('" or "')}".`);
  }

  const description = meta.description;
  if (typeof description !== "string" || !description.trim()) {
    err("Frontmatter is missing `description`.");
  } else {
    if (description.length > DESCRIPTION_MAX)
      err(`\`description\` is longer than ${DESCRIPTION_MAX} characters.`);
    if (/[<>]/.test(description)) err("`description` must not contain < or >.");
    if (description.length < 80)
      warn("`description` is very short; Claude may not know when to use this skill.");
    if (!/\b(use|when|whenever|trigger)/i.test(description))
      warn("`description` should say when to use the skill, not just what it does.");
  }

  const lines = body.split("\n").length;
  if (!body.trim()) err("SKILL.md has no instructions after the frontmatter.");
  else if (lines > BODY_LINE_SOFT_MAX)
    warn(`SKILL.md body is ${lines} lines; move detail into references/.`);

  // Every bundled file mentioned in SKILL.md should exist
  const paths = new Set(files.map((f) => f.path));
  const referenced = body.match(/\b(?:scripts|references|assets)\/[\w./-]+\w/g) ?? [];
  for (const ref of new Set(referenced)) {
    if (!paths.has(ref)) warn(`SKILL.md mentions ${ref}, but that file isn't in the skill.`);
  }

  for (const f of files) {
    if (f.path.startsWith("/") || f.path.includes(".."))
      err(`Unsafe file path: ${f.path}`);
  }

  return issues;
}

// The model sometimes nests everything under the skill's own folder
// ("my-skill/SKILL.md"); SKILL.md must sit at the root of the file set.
export function stripWrapperFolder(files: SkillFile[]): SkillFile[] {
  if (files.some((f) => f.path === "SKILL.md")) return files;
  const top = files[0]?.path.split("/")[0];
  if (!top || !files.every((f) => f.path.startsWith(`${top}/`))) return files;
  if (!files.some((f) => f.path === `${top}/SKILL.md`)) return files;
  return files.map((f) => ({ ...f, path: f.path.slice(top.length + 1) }));
}
