# Skill Builder

Describe a skill in plain English. The app looks for an existing Claude Agent Skill
that already does it (GitHub code search + Gemini web search). If it finds a close
match with a permissive license, it clones that skill. If not, it generates a new one
with Gemini. Either way, the result is checked against the skill format before you
download it.

## Run locally

```bash
cp .env.example .env.local   # add GEMINI_API_KEY (and GITHUB_TOKEN)
npm install
npm run dev                  # http://localhost:4321
```

## How it works

| Step | Code |
|---|---|
| Understand the description | `src/lib/gemini.ts` → `analyzeDescription` |
| Search GitHub + web | `src/lib/github.ts`, `searchWebForSkills` |
| Score matches, clone if ≥ 85 and permissive license | `src/lib/pipeline.ts` |
| Generate (+1 auto-repair pass) | `generateSkill`, `repairSkill` |
| Validate | `src/lib/validate.ts`, rules in `src/lib/skill-spec.ts` |

`POST /api/build` streams progress as newline-delimited JSON.
