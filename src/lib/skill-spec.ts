// The Claude Agent Skill format, given to Gemini as ground truth for generation
// and shared with the validator so both agree on the rules.

export const NAME_MAX = 64;
export const DESCRIPTION_MAX = 1024;
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESERVED_WORDS = ["anthropic", "claude"];
export const BODY_LINE_SOFT_MAX = 500;

export const SKILL_SPEC = `
# Claude Agent Skill format

A skill is a folder that teaches Claude how to do one specific kind of task.
Claude sees only each skill's name + description up front, and loads the rest
on demand, so the description decides whether the skill is ever used.

## Folder layout
<skill-name>/
  SKILL.md            (required) frontmatter + instructions
  scripts/            (optional) executable helpers Claude runs (python/bash/node)
  references/         (optional) longer docs Claude reads only when needed
  assets/             (optional) templates or files used in output

## SKILL.md
Starts with YAML frontmatter, then a Markdown body.

---
name: <skill-name>
description: <what it does AND when to use it>
---

Frontmatter rules:
- name: required, lowercase letters, digits and hyphens only, max ${NAME_MAX} chars,
  must match the folder name, must not contain "${RESERVED_WORDS.join('" or "')}".
- description: required, non-empty, max ${DESCRIPTION_MAX} chars, written in third person.
  It must say both what the skill does and the concrete situations, phrases,
  file types or tasks that should trigger it. Be specific and slightly "pushy"
  so Claude reaches for it when relevant. No angle brackets (< or >).
- Only add other frontmatter keys if truly needed (e.g. license, allowed-tools).

Body rules:
- Imperative, concrete instructions for Claude. Explain the why behind rules
  instead of shouting MUST/NEVER.
- Keep SKILL.md under ~${BODY_LINE_SOFT_MAX} lines. Move long reference material into
  references/*.md and say in SKILL.md exactly when to read each file.
- Include a short workflow (numbered steps), input/output expectations,
  and at least one worked example.
- Put deterministic or repetitive work (parsing, conversions, validation) into
  scripts/ and tell Claude how to run them, rather than having Claude rewrite
  the code each time.
- Reference bundled files with relative paths (e.g. scripts/check.py).
- Don't include README.md, CHANGELOG.md or install guides inside the skill.
- Don't invent APIs, CLI flags or library functions. If unsure, tell Claude to
  check the tool's --help or docs.
`.trim();
