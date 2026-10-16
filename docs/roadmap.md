# Roadmap and known limitations

## Known limitations

| Area | Limitation | Impact |
|---|---|---|
| Drafts | Builds ("My skills") live in each visitor's browser until published. | Unpublished builds don't follow users across devices and are lost if browser data is cleared. |
| Free limits | Kept in server memory, keyed by cookie and IP. | Reset on restart; not shared across server instances; easy to get around with a VPN or incognito. Fine for testing, not for a public launch. |
| Cost control | `/api/build` and `/api/test` have no per-visitor rate limit. | A heavy user can use up the Gemini quota. |
| Simulated mode | Without a Claude key, Gemini plays Claude. | It can't run a skill's scripts, and real Claude may behave differently. Results are labelled "Simulated". |
| Grading | Gemini grades test answers, including answers Gemini wrote in simulated mode. | Scores are a useful signal, not proof. |
| Search | Without `GITHUB_TOKEN`, only Gemini's web search finds existing skills. | Many existing skills go unfound. |
| Gemini availability | Free-tier models are sometimes overloaded or slow. | Mitigated by model fallback and time budgets, but builds can still fail at busy times. |
| Skills used as-is | Copied unchanged; only validated, never repaired. | A skill used as-is can arrive with warnings or errors. Adapted skills do get a repair pass. |
| Binary files | Cloning skips binary files (images, fonts). | Skills that ship assets come back without them. |

## Roadmap

**Next: ready for public testers**
- [ ] Move playground sessions and limits to Redis (Upstash)
- [ ] Per-visitor rate limits on build and test
- [ ] Deploy to Vercel with production keys and spending limits

**Accounts and saved work**
- [x] Sign-in (GitHub and email)
- [x] Skills hub: publish, public pages, Explore and search, stars, forks, versions
- [ ] Sync unpublished drafts to the account
- [ ] Delete and rename skills from the hub UI
- [ ] Diff between versions
- [ ] Report abuse and moderation tools

**Better skills**
- [ ] Refine with chat: describe a change and have the skill edited in place
- [ ] Edit files directly in the workspace
- [ ] Show diffs between versions
- [x] Adapt a close existing skill instead of writing a new one

**Business**
- [ ] Plans and billing (Stripe): free tier with limits, paid tier with real-Claude testing and more sessions
- [ ] Usage dashboard per account
