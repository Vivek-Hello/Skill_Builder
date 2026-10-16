# SkillForge

**Agent Skills for Claude, built from a sentence.**

Describe what you want Claude to be able to do. SkillForge searches GitHub and the web for an [Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) that already does it. A near-exact match with an open license is reused as-is, a close one is **adapted** to your request (with every change listed), and if nothing fits it writes a new one to the official format. You can then chat with Claude using the skill, run graded tests, download a ready-to-install `.zip`, and publish it to the **skills hub**: a GitHub-style home for skills with profiles, stars, forks and versions.

> SkillForge is a working name, set in [`src/lib/brand.ts`](src/lib/brand.ts). Not affiliated with Anthropic.

## Features

| | |
|---|---|
| **Find before build** | Searches GitHub code and the web for existing `SKILL.md` files, scores each against your request, and reuses the best one as-is when it scores 85+ and has a permissive license. |
| **Adapt close matches** | A permissively licensed match scoring 60–84 is modified with the smallest changes that cover your request. Its license file is kept, and the workspace lists exactly what changed. |
| **Generate to spec** | When nothing fits, Gemini writes the skill (`SKILL.md` plus optional `scripts/` and `references/`) from the Agent Skill rules in [`skill-spec.ts`](src/lib/skill-spec.ts). |
| **Validation and auto-repair** | Checks name, description, structure and file references. A generated skill that fails gets one automatic repair pass. |
| **Pick from matches** | Every relevant existing skill is listed with a score and reason. Use any permissively licensed one as-is, or have it adapted to your request. |
| **Try it (free playground)** | A time-boxed chat with the skill loaded, limited per visitor (10 minutes, 3 sessions a day by default). |
| **Graded tests** | Writes 3 realistic test prompts with pass criteria, runs them with the skill loaded, and grades each answer. |
| **My skills** | Every build is saved in the browser and gets its own link at `/skills/<id>`. |
| **Skills hub** | Sign in with GitHub or email, publish skills to public pages at `/<username>/<skill>`, browse and search them on Explore, star them, fork them (as-is or adapted) and publish new versions. Optional; runs on Supabase. |
| **Simulated mode** | With no Claude API key, "Try it" and tests run on Gemini playing Claude, clearly labelled in the UI. |

## Quick start

Requirements: Node.js 20 or newer, and a free [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/Vivek-Hello/Skill_Builder.git
cd Skill_Builder
npm install
cp .env.example .env.local   # then add GEMINI_API_KEY (and GITHUB_TOKEN, recommended)
npm run dev
```

Open http://localhost:4321.

| Key | Needed for | Without it |
|---|---|---|
| `GEMINI_API_KEY` | Everything | The app can't build skills |
| `GITHUB_TOKEN` | Searching GitHub for existing skills | Only Gemini's web search is used, which finds far less |
| `ANTHROPIC_API_KEY` | Running "Try it" and tests on real Claude | Both run in simulated mode with Gemini |
| `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The skills hub | The hub is off; everything else works. Setup: [docs/hub-setup.md](docs/hub-setup.md) |

All settings are described in [docs/configuration.md](docs/configuration.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 4321 with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build on port 4321 |
| `npm run lint` | ESLint |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Gemini via `@google/genai` · Claude via `@anthropic-ai/sdk` · GitHub via Octokit · JSZip · react-markdown · lucide-react

## Project structure

```
src/
  app/                       Routes only: pages and API handlers (see docs/api.md)
    page.tsx                 Landing page and builder
    skills/page.tsx          My skills
    skills/[id]/page.tsx     Workspace for one saved skill
    explore/, login/         Hub: browse and search, sign in
    [username]/[skill]/      Hub: profile and public skill pages
    api/                     build, clone, adapt, test, playground, hub
  features/                  UI, grouped by feature
    studio/                  Landing → building → workspace flow
    workspace/               Workspace, file browser, matches list
    playground/              "Try it" chat
    testing/                 Graded test panel
    hub/                     Publish, star, fork, cards, sign-in, account menu
  components/                Shared UI: site header and footer, markdown
  server/                    Server-only code (never sent to the browser)
    pipeline.ts              Analyze → search → match → clone, adapt or generate → validate
    ai/gemini.ts             All Gemini calls, model fallback, Claude simulation
    ai/claude.ts             Upload skills to Claude, run graded tests
    github.ts                GitHub search, candidate loading, folder download
    playground-sessions.ts   Free sessions, limits, chat turns
    request.ts, visitor.ts   Input validation, visitor identity
    hub.ts, hub-auth.ts      Hub reads and writes, signed-in user
    supabase.ts              Supabase clients (as the user, or public)
  lib/                       Shared by browser and server
    types.ts                 Shared types
    skill-spec.ts, validate.ts   The Agent Skill rules and checker
    history.ts               "My skills" in browser storage
    supabase/                Supabase config and browser client
    brand.ts, ndjson.ts, zip.ts
  proxy.ts                   Refreshes the sign-in session
supabase/migrations/         Database schema for the hub
```

## Documentation

- [Architecture](docs/architecture.md): how a build flows and how each module fits
- [API](docs/api.md): every route, its request and its streamed events
- [Configuration](docs/configuration.md): environment variables and built-in limits
- [Skills hub setup](docs/hub-setup.md): Supabase project, sign-in providers, first publish
- [Deployment](docs/deployment.md): deploying to Vercel, and what to change first
- [Roadmap and known limitations](docs/roadmap.md)
