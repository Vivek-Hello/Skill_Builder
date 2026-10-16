# Configuration

Settings come from environment variables. Locally, put them in `.env.local` (git ignores it) and restart `npm run dev` after changing them. [`.env.example`](../.env.example) lists them all.

## API keys

| Variable | Required | Used for |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Analyzing requests, web search, scoring matches, writing skills and test cases, grading, and simulated mode. Get one at https://aistudio.google.com/apikey |
| `GITHUB_TOKEN` | Recommended | GitHub code search for existing `SKILL.md` files; also raises GitHub's rate limit from 60 to 5,000 requests an hour. Use a fine-grained token with **Public repositories (read-only)** and no extra permissions. |
| `ANTHROPIC_API_KEY` | Optional | Running "Try it" and tests on real Claude. Without it, both run in simulated mode with Gemini. Get one at https://console.anthropic.com/settings/keys (the API needs prepaid credit) |

Never commit keys, paste them in chats or put them in `.env.example`. If a key leaks, delete it in the provider's console and create a new one.

## Models

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_MODEL` | `gemini-pro-latest` | Main Gemini model. Free-tier keys may have no quota for Pro; the fallbacks then take over. |
| `GEMINI_FALLBACK_MODELS` | `gemini-3-flash-preview,gemini-flash-lite-latest` | Comma-separated, tried in order when the main model is overloaded, rate-limited, unavailable or too slow. |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Model for graded tests. |
| `PLAYGROUND_MODEL` | `claude-haiku-5-5` | Model for the free chat. Haiku keeps per-message cost very low. |

## Free playground limits

| Variable | Default | Meaning |
|---|---|---|
| `PLAYGROUND_MINUTES` | `10` | Length of one session, counted from when it starts |
| `PLAYGROUND_SESSIONS_PER_DAY` | `3` | Sessions per visitor in any 24-hour window |
| `PLAYGROUND_MAX_MESSAGES` | `30` | Hidden cap per session, so a fast sender can't run up the bill within the time window |

On a local machine, every browser shares one allowance because they all come from the same IP. Restarting the server resets it.

## Built-in limits

These are constants in the code, not environment variables.

| Limit | Value | Where |
|---|---|---|
| Description length | 10–4000 characters | `api/build/route.ts` |
| Use as-is | Match score 85+ and a permissive license | `CLONE_THRESHOLD` in `server/pipeline.ts` |
| Adapt | Match score 60–84 and a permissive license | `ADAPT_THRESHOLD` in `server/pipeline.ts` |
| Largest skill that can be adapted | 150,000 characters | `MAX_ADAPT_CHARS` in `server/pipeline.ts` |
| Matches shown | Score 40+ | `MIN_LISTED_SCORE` in `server/pipeline.ts` |
| Files downloaded when cloning | 60 files, 300 KB each, text only | `server/github.ts` |
| Files accepted by test and playground routes | 60 files, 1 MB total | `server/request.ts` |
| Test cases per run | 5 | `parseCases` in `server/request.ts` |
| Playground reply length | 4,000 tokens | `MAX_REPLY_TOKENS` in `server/playground-sessions.ts` |
| Playground message length | 6,000 characters | `api/playground/message/route.ts` |
| Saved skills per browser | 30 | `MAX_SAVED` in `lib/history.ts` |
| Route time limits | build 300 s, adapt 300 s, test 300 s, playground message 120 s, test cases 120 s, clone and start 60 s | `maxDuration` in each route |

## Port

`npm run dev` and `npm start` use port **4321** (set in `package.json`). To use another, run `npx next dev -p 5000`.

## Product name

The name, tagline and repo link are in [`src/lib/brand.ts`](../src/lib/brand.ts).
