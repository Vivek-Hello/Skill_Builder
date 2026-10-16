# Skills hub setup (Supabase)

The skills hub (accounts, publishing, Explore, profiles, stars, forks and versions) runs on [Supabase](https://supabase.com). It's optional: without it, the builder works and hub pages say the hub isn't set up. The free plan is enough and needs no card.

## 1. Create a project

1. Sign in at https://supabase.com/dashboard and click **New project**.
2. Name it `skillforge`, set a database password (save it somewhere safe), pick the region closest to your users, and create it.

## 2. Create the database tables

1. In the project, open **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/migrations/0001_skills_hub.sql`](../supabase/migrations/0001_skills_hub.sql) and click **Run**.

This creates the `profiles`, `skills`, `skill_versions` and `stars` tables, their security rules, and the `publish_skill` function. Run it once per project.

## 3. Connect the app

1. Open **Project Settings → API Keys** (or the **Connect** button at the top).
2. Copy the **Project URL** and the **publishable key** (`sb_publishable_…`). The legacy `anon` key also works.
3. Add them to `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
   ```

4. Restart `npm run dev`.

Both values are safe in the browser: every table is protected by row-level security. Never put the **secret** (`service_role`) key in the app.

## 4. Set the sign-in URLs

In **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:4321` (your production URL once deployed)
- **Redirect URLs:** add `http://localhost:4321/auth/callback` and, when deployed, `https://your-domain/auth/callback`

## 5. Sign-in methods

**Email** works out of the box: users get a magic link. Supabase's built-in email sender is rate-limited (a few emails an hour), which is fine for testing. For real users, add your own SMTP under **Authentication → Emails → SMTP Settings**.

**GitHub** (recommended, since skill authors usually have GitHub):

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Homepage URL: `http://localhost:4321`
   - Authorization callback URL: copy it from Supabase **Authentication → Sign In / Providers → GitHub** (looks like `https://xxxx.supabase.co/auth/v1/callback`)
2. Create the app, then generate a client secret.
3. In Supabase, enable the **GitHub** provider and paste the client ID and secret.

New accounts get a profile automatically, with the GitHub username (or the part of the email before `@`) as their username.

## 6. Try it

1. Open http://localhost:4321, click **Sign in**, and sign in.
2. Build a skill, then click **Publish** in the workspace.
3. Open **Explore**: your skill is listed. Its page is `/<username>/<skill-name>`.
4. From another account, **Star** it and **Fork** it (as-is or adapted).
5. Back in your build, click **Publish update** to add v2. The skill page's **Versions** list shows both.

## How the data is protected

| Table | Anyone can | Only the owner can |
|---|---|---|
| `profiles` | read | change display name and avatar |
| `skills` | read | create, edit description and license, delete |
| `skill_versions` | read | add versions (never edit them) |
| `stars` | read | star and unstar as themselves |

Star and fork counts are maintained by database triggers, and users can't write them directly.
