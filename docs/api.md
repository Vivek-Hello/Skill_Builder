# API

All routes live under `src/app/api/` and take and return JSON. Long operations **stream newline-delimited JSON** (`Content-Type: application/x-ndjson`): one JSON object per line, sent as work progresses. Validation errors are returned before streaming starts, as a normal JSON body `{ "error": "..." }` with a 4xx status.

Types referenced below are defined in [`src/lib/types.ts`](../src/lib/types.ts).

A skill's files are always sent as an array of `{ "path": string, "content": string }`, with paths relative to the skill folder (`SKILL.md`, `scripts/run.py`). Routes that accept files require `SKILL.md` at the root, at most 60 files and 1 MB in total, and no absolute or `..` paths.

---

## `POST /api/build`

Find or generate a skill from a description. Streams progress.

**Request**

```json
{ "description": "Review SQL migrations for unsafe operations", "forceGenerate": false }
```

| Field | Type | Notes |
|---|---|---|
| `description` | string | 10–4000 characters |
| `forceGenerate` | boolean | Optional. Skip cloning even if a strong match exists |

**Stream events** (`BuildEvent`)

```json
{"type":"step","step":"analyze","status":"running"}
{"type":"step","step":"analyze","status":"done","detail":"sql-migration-reviewer: Reviews…"}
{"type":"step","step":"match","status":"skipped"}
{"type":"result","result":{ /* BuildResult */ }}
{"type":"error","message":"GEMINI_API_KEY is not set"}
```

- `step` is one of `analyze`, `search`, `match`, `clone`, `adapt`, `generate`, `validate`; `status` is `running`, `done` or `skipped`.
- The stream ends after one `result` or one `error`.

**`BuildResult`**

| Field | Type | Notes |
|---|---|---|
| `origin` | `"cloned"` \| `"adapted"` \| `"generated"` | |
| `skillName` | string | From `SKILL.md` frontmatter |
| `files` | `SkillFile[]` | |
| `issues` | `{ level: "error" \| "warning", message }[]` | Validation results |
| `matches` | `ScoredCandidate[]` | Existing skills scoring 40+, best first |
| `source` | `{ repo, url, license, stars }` | When cloned or adapted |
| `adaptation` | `{ changes: string[] }` | When adapted: plain-English list of what was changed |
| `examples` | string[] | Requests that should trigger the skill |

`ScoredCandidate` adds `score` (0–100), `reason` and `cloneable` (permissive license) to a candidate's `repo`, `path`, `url`, `stars`, `license`, `name`, `description` and `source` (`"github"` or `"web"`).

**Errors:** `400` if the description is too short or too long.

---

## `POST /api/clone`

Download one existing skill the user picked from the matches.

**Request:** `{ "repo": "owner/name", "path": "skills/foo/SKILL.md" }`

**Response:** a `BuildResult` with `origin: "cloned"`, `source` set and `matches: []` (the client keeps its existing list).

**Errors**

| Status | When |
|---|---|
| `400` | `repo` isn't `owner/name`, or `path` doesn't end in `SKILL.md` |
| `404` | The `SKILL.md` couldn't be loaded from GitHub |
| `422` | The repo's license doesn't allow copying |

---

## `POST /api/adapt`

Modify one existing skill so it fits the user's description, instead of writing a new one. Takes about a minute.

**Request:** `{ "repo": "owner/name", "path": "skills/foo/SKILL.md", "description": "…" }` (description 10–4000 characters)

**Response:** a `BuildResult` with `origin: "adapted"`, `source` and `adaptation.changes` set, and `matches: []`. The original license and notice files are always kept unchanged; if the skill folder has none, the repo's root license is added as `LICENSE`.

**Errors**

| Status | When |
|---|---|
| `400` | Invalid location or description |
| `404` | The `SKILL.md` couldn't be loaded from GitHub |
| `422` | License doesn't allow modifying, the skill is too large (over 150,000 characters), or adapting failed |

---

## `POST /api/test/cases`

Write realistic test prompts for a skill.

**Request:** `{ "files": SkillFile[] }`

**Response:** `{ "cases": [{ "prompt": string, "criteria": string[] }] }` (3 cases)

**Errors:** `400` invalid files; `502` Gemini failed.

---

## `POST /api/test`

Run test cases with the skill loaded and grade each answer. Streams results. Uses real Claude when `ANTHROPIC_API_KEY` is set, otherwise the Gemini simulation.

**Request**

```json
{ "skillName": "sql-migration-reviewer", "files": [/* SkillFile[] */], "cases": [{ "prompt": "…", "criteria": ["…"] }] }
```

At most 5 cases; each prompt at most 8000 characters. `skillName` must be kebab-case.

**Stream events** (`TestEvent`)

```json
{"type":"status","message":"Uploading skill to Claude"}
{"type":"case","index":0,"status":"running"}
{"type":"case","index":0,"status":"done","output":"…","skillLoaded":true,"toolCalls":3,"simulated":false,"verdict":{"score":92,"passed":true,"feedback":"…"}}
{"type":"case","index":1,"status":"error","message":"No answer came back for this test. Run it again."}
{"type":"done","passed":2,"total":3}
{"type":"error","message":"…"}
```

Cases run in parallel, so `case` events can arrive in any order; match them by `index`. When real Claude is used, the uploaded skill is deleted when the run finishes.

---

## Playground

A visitor is identified by the `sb_vid` cookie plus their IP; routes set the cookie if it's missing.

### `GET /api/playground/start`

Quota check without starting a session.

**Response:** `{ "sessionsLeft": 3, "sessionMinutes": 10, "simulated": true }`

### `POST /api/playground/start`

Start a free session. Uploads the skill to Claude unless in simulated mode.

**Request:** `{ "skillName": string, "files": SkillFile[] }`

**Response** (`PlaygroundSession`): `{ "sessionId": "uuid", "expiresAt": 1792051977799, "sessionsLeft": 2, "simulated": true }`

`expiresAt` is a Unix time in milliseconds.

| Status | When |
|---|---|
| `400` | Invalid skill |
| `429` | No free sessions left today (message says when the next one frees up) |
| `502` | Upload or start failed. The attempt doesn't use up a session |

### `POST /api/playground/message`

Send one message and stream Claude's reply. The server keeps the conversation; send only the new text.

**Request:** `{ "sessionId": "uuid", "text": "Review this migration…" }` (at most 6000 characters)

**Stream events** (`PlaygroundEvent`)

```json
{"type":"text","text":"I reviewed your "}
{"type":"tool"}
{"type":"skill_used"}
{"type":"done","messagesLeft":29}
{"type":"error","message":"Claude couldn't reply. Try again."}
```

- `text`: the next piece of the reply; append in order
- `tool`: Claude started running code in its container
- `skill_used`: Claude loaded the skill this turn (real Claude only)

| Status | When |
|---|---|
| `400` | Empty or too-long message |
| `404` | Unknown session, or it belongs to another visitor |
| `409` | A reply is still streaming for this session |
| `410` | The session's time is up |
| `429` | The session's message cap is reached |

### `POST /api/playground/end`

End a session early and delete its uploaded skill. Also sent by the browser with `navigator.sendBeacon` when the tab closes.

**Request:** `{ "sessionId": "uuid" }` → `{ "ok": true }`, or `404` if unknown.
