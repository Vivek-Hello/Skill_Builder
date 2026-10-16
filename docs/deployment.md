# Deployment

The app is a standard Next.js project and deploys to [Vercel](https://vercel.com) with no extra configuration.

## Vercel

1. Push the repo to GitHub.
2. In Vercel, choose **Add New → Project** and import the repo. Vercel detects Next.js.
3. Under **Environment Variables**, add at least `GEMINI_API_KEY`, plus `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` if you have them. See [configuration](configuration.md). Use different keys from your local ones.
4. Click **Deploy**. Every push to `main` redeploys.
5. If you use the skills hub, add your production URL in Supabase under **Authentication → URL Configuration** (Site URL, plus `https://your-domain/auth/callback` as a redirect URL), and update the GitHub OAuth app's homepage URL. See [hub-setup.md](hub-setup.md).

Builds and test runs can take a minute or more. Routes declare their own time limits (`maxDuration`, up to 300 s), which fit within Vercel's limits.

## Before sharing the link publicly

The app has no login yet, so anyone with the link spends your API quota. Check these first:

1. **Move playground limits to shared storage.** Sessions and usage counts are kept in server memory. On Vercel, functions restart often and run as several copies, so counts reset and aren't shared, and the per-visitor limits won't hold. Move the `store` in [`playground-sessions.ts`](../src/server/playground-sessions.ts) to Redis (Upstash's free tier is enough). A playground session also has to be served by the instance that holds it, which shared storage solves too.
2. **Rate-limit `/api/build` and `/api/test`.** They have no per-visitor limit yet and are the most expensive routes on Gemini.
3. **Set spending limits** in the Google AI Studio and Anthropic consoles.
4. **Use a paid Gemini tier** if more than a few people will use it at once. Free-tier rate limits are low, and builds will fail with "quota exceeded".

## Other hosts

Any Node.js host works:

```bash
npm ci
npm run build
npm start        # port 4321
```

The same in-memory caveat applies whenever more than one server instance runs.
