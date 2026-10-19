# SkillForge: project guide for Claude

Read this before exploring the codebase; it should answer most "where is X / how does Y work" questions. Open only the files a task needs. Deeper references live in `docs/` (architecture, api, configuration, hub-setup, deployment, roadmap).

@AGENTS.md

## What it is

A SaaS web app (working name **SkillForge**, set in `src/lib/brand.ts`) that turns a plain-English description into a Claude Agent Skill (`SKILL.md` folder). It searches GitHub and the web first, then **reuses** (score 85+), **adapts** (60–84) or **generates** a skill with Gemini; lets users **try** it (free time-boxed chat) and **test** it (graded prompts); and has a **skills hub** (GitHub for skills: publish, profiles, Explore, stars, forks, versions) on Supabase.

## Stack and commands

Next.js 16 (App Router, Cache Components on) · React 19 · TypeScript · Tailwind 4 · `@google/genai` (Gemini) · `@anthropic-ai/sdk` (Claude) · Octokit · Supabase (`@supabase/ssr`) · JSZip · react-markdown · lucide-react.

- `npm run dev` / `npm start` → **port 4321**. `npm run build`, `npm run lint`, `npx tsc --noEmit`.
- After adding a route folder, run `npx next typegen` or `PageProps<"/route">` types fail.
- No test suite. Verify with tsc, lint, build, then live API calls (curl) against a running server.

## Folder map (`src/`)

| Path | What's there |
|---|---|
| `app/page.tsx` | Landing + builder (renders `Studio`) |
| `app/skills/`, `app/skills/[id]/` | "My skills" (browser-saved builds) and one build's workspace |
| `app/explore/`, `app/login/`, `app/[username]/`, `app/[username]/[skill]/` | Hub: browse/search, sign in, profile, public skill page. `[x]` = dynamic URL segment |
| `app/auth/callback/route.ts` | Supabase sign-in callback |
| `app/api/build` | Main pipeline, streams NDJSON progress |
| `app/api/clone`, `app/api/adapt` | Use a picked match as-is / adapted |
| `app/api/test`, `app/api/test/cases` | Graded tests (stream) / write test cases |
| `app/api/playground/{start,message,end}` | Free "Try it" chat |
| `app/api/hub/{publish,star,fork}` | Hub writes (need sign-in) |
| `features/studio/` | `studio.tsx` state machine (landing → building → workspace), `landing.tsx`, `build-progress.tsx` |
| `features/workspace/` | `workspace.tsx` (header, tabs, adaptation card), `file-browser.tsx`, `matches-list.tsx` |
| `features/playground/playground.tsx`, `features/testing/test-panel.tsx` | Try it chat, test panel (also exports `SimulatedNote`) |
| `features/hub/` | publish button, skill actions (star/fork/download), cards, login form, user menu, `use-hub-user` hook |
| `components/` | Shared UI: `site-header.tsx` (header + footer), `markdown.tsx` |
| `server/` | **Server-only** (`import "server-only"`) |
| `server/pipeline.ts` | `buildSkill`, `cloneSkill`, `adaptExisting`; thresholds `CLONE_THRESHOLD=85`, `ADAPT_THRESHOLD=60` |
| `server/ai/gemini.ts` | Every Gemini call; `generate()` model fallback + time budgets; `simulateChat`/`simulateRun` (Gemini plays Claude) |
| `server/ai/claude.ts` | Upload skill to Claude, `runWithSkill` (code execution + `container.skills`), delete |
| `server/github.ts` | Code search, candidate loading, folder download (adds repo LICENSE), `PERMISSIVE` licenses |
| `server/playground-sessions.ts` | In-memory sessions + per-visitor limits, `simulated()` |
| `server/hub.ts`, `server/hub-auth.ts`, `server/supabase.ts` | Hub reads/writes, `requireUser()`, Supabase clients |
| `server/request.ts`, `server/visitor.ts` | Input validation (`parseFiles`), visitor id (cookie + hashed IP) |
| `lib/` | Shared browser+server: `types.ts`, `hub-types.ts`, `skill-spec.ts` (Agent Skill rules), `validate.ts` (`validateSkill`, `stripWrapperFolder`, `keepLicenseFiles`), `history.ts` (localStorage), `ndjson.ts`, `zip.ts`, `supabase/` |
| `proxy.ts` | Next 16 "middleware": refreshes Supabase session (skips non-hub `/api/*`) |

Outside `src/`: `supabase/migrations/0001_skills_hub.sql` (whole hub schema, RLS, triggers, `publish_skill` fn), `docs/`, `.env.example`.

## Key flows

- **Build:** analyze (Gemini) → search GitHub + web → score all matches → clone (85+, permissive) / adapt (60–84) / generate → validate (+1 repair pass). Result type `BuildResult` in `lib/types.ts` (`origin`: cloned|adapted|generated, `source`, `adaptation.changes`, `matches`, `examples`).
- **Real vs simulated:** with `ANTHROPIC_API_KEY`, Try it/Test use real Claude (playground: `claude-haiku-5-5`, tests: `claude-opus-5-5`); without it Gemini simulates and the UI labels results "Simulated". Grading is always Gemini.
- **Hub:** pages read with a cookie-less public client inside `<Suspense>`; writes go through `/api/hub/*` as the signed-in user. Publishing calls the `publish_skill` SQL function (creates skill or next version atomically). Forks set `forked_from`, keep license files, rename slug to `<name>-fork` on collision. Hub is **off** when `NEXT_PUBLIC_SUPABASE_URL`/`_PUBLISHABLE_KEY` are unset (`hubEnabled` in `lib/supabase/config.ts`).

## Rules and gotchas

- **Next 16 + Cache Components:** reading `params`, `searchParams`, `cookies()`, `useParams`/`useSearchParams`/`usePathname` or uncached data must sit inside `<Suspense>`, or the build fails. Page files may only export the page (and allowed config); put helpers in `features/`.
- Imports always use `@/…` aliases. Server code goes in `src/server/`, never imported from client components.
- Styling uses design tokens from `app/globals.css` (`bg-panel`, `bg-panel-2`, `border-line`, `text-muted`, `text-accent`, `bg-accent-soft`, `text-success|warning|danger`). Light + dark both supported.
- Gemini's free tier is often overloaded (503) or slow; `generate()` falls back across models. `.env.local` sets `GEMINI_MODEL=gemini-3-flash-preview`.
- Gemini sometimes nests files under `<skill-name>/`; `stripWrapperFolder` fixes it. `SKILL.md` must be at the root.
- Cloned/adapted/forked skills keep their source license (`keepLicenseFiles`); only permissive licenses can be copied.
- Commits: Conventional Commits (`feat(scope):`, `docs:`, `chore:`), with the `Co-Authored-By` trailer.
- Windows + Git Bash: backticks inside `node -e "…"` get mangled by the shell; write scripts to a file (scratchpad) instead.
- Next allows only **one dev server per project**. The user usually has `npm run dev` running on 4321; don't kill it. For testing use `npm run build && npx next start -p 4400`, then stop it.

## Status (keep updated)

- Done: build pipeline (reuse/adapt/generate), model fallback, Try it + Test (real or simulated), product UI, My skills, skills hub code, docs.
- Hub **not yet tested live**: needs the user to create a Supabase project (`docs/hub-setup.md`).
- Keys present: Gemini, GitHub. Missing: Anthropic (no card), Supabase.
- Commits on `main` not pushed yet; pushing needs the user's GitHub sign-in in their own terminal.
- Next up (`docs/roadmap.md`): Redis for playground limits, rate limits on build/test, deploy to Vercel, LICENSE / privacy / terms docs.
