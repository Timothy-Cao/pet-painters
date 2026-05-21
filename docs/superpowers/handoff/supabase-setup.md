# Supabase setup — Pet Painters online play

Step-by-step guide to wire up the backend after the code is in place. Estimated time: **20–30 minutes**.

You'll do four things:

1. Create a Supabase project (5 min)
2. Run the SQL migration to create tables, policies, and functions (5 min)
3. Configure Google OAuth in Google Cloud Console + Supabase (10 min)
4. Put the project's URL and anon key into `.env.local` and (optionally) into your deployment environment (2 min)

Once these are done, online play works end-to-end.

---

## Prerequisites

- A Google account for the user `tctctc888@gmail.com` (you).
- A Google Cloud Console project (free).
- A Supabase account (free tier is plenty for this game).
- The Pet Painters repo cloned locally with the implementation already in place (it is).

---

## Step 1 — Create the Supabase project

1. Go to <https://supabase.com/dashboard> and sign in.
2. Click **New project**.
3. Pick an org (or create one — name doesn't matter).
4. Project settings:
   - **Name:** `pet-painters`
   - **Database password:** generate a strong one. Save it in your password manager — you won't need it often but you can't recover it.
   - **Region:** pick the one closest to where you and your friends play. For the US east coast, `us-east-1` or `us-east-2`. For Asia, `ap-southeast-1` or `ap-northeast-1`.
   - **Pricing plan:** Free.
5. Click **Create new project**. Wait ~2 minutes for it to provision.

When it finishes, you'll land on the project dashboard. Note two things you'll need later:

- The **Project URL** (looks like `https://abcdefghijklmn.supabase.co`) — find it under **Project Settings → API → Project URL**.
- The **anon public key** (a long JWT) — find it under **Project Settings → API → Project API keys → anon public**.

Don't worry about the `service_role` key — Pet Painters doesn't use it.

---

## Step 2 — Run the SQL migration

The full schema, RLS policies, and RPC functions live in `docs/superpowers/handoff/supabase-schema.sql`.

1. Open the Supabase dashboard for your project.
2. Click **SQL Editor** in the left nav.
3. Click **+ New query**.
4. Open `docs/superpowers/handoff/supabase-schema.sql` from this repo, copy its contents, paste into the editor.
5. Click **Run** (or press Cmd/Ctrl+Enter).

You should see "Success. No rows returned." at the bottom. If you see an error mentioning `extension "pgcrypto" already exists`, that's fine — pgcrypto is enabled in some Supabase projects by default; the script uses `create extension if not exists`.

To verify the schema:
- Click **Table Editor** in the left nav. You should see three tables: `profiles`, `rooms`, `round_submissions`.
- Click each one and confirm the columns match.

---

## Step 3 — Configure Google OAuth

This is the longest step, mostly clicking through Google Cloud Console.

### 3a. Create a Google Cloud project (or pick an existing one)

1. Go to <https://console.cloud.google.com/>.
2. Click the project dropdown in the top bar → **New Project**.
3. Name: `pet-painters` (or any name). Click **Create**.

### 3b. Create an OAuth consent screen

1. In the left nav, go to **APIs & Services → OAuth consent screen**.
2. Pick **External** (since you'll be inviting friends with arbitrary Google accounts). Click **Create**.
3. Fill in:
   - **App name:** `Pet Painters`
   - **User support email:** `tctctc888@gmail.com`
   - **Developer contact email:** `tctctc888@gmail.com`
   - Leave the rest blank. Click **Save and continue**.
4. **Scopes:** click **Save and continue** (no extra scopes needed; Supabase asks for email/profile automatically).
5. **Test users:** click **+ Add users** and add the Google email of anyone you want to invite during testing. Add `tctctc888@gmail.com` and any friends you plan to play with. Click **Save and continue**.
6. Review summary, click **Back to dashboard**.

   Note: while the app is in "Testing" status, only listed test users can sign in. To open it up to anyone with a Google account, you'd need to publish the app — but for a private friend-game, Testing mode is correct.

### 3c. Create the OAuth client ID

1. In the left nav, go to **APIs & Services → Credentials**.
2. Click **+ Create credentials → OAuth client ID**.
3. **Application type:** Web application.
4. **Name:** `Pet Painters Web`.
5. **Authorized JavaScript origins:** add (one per line):
   - `http://localhost:5173` (for local dev)
   - The deployed URL of your site (e.g., `https://pet-painters.vercel.app`) — add this once you've deployed; you can come back and edit this list later.
6. **Authorized redirect URIs:** add:
   - `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     — replace `YOUR-PROJECT-REF` with the part of your Supabase URL between `https://` and `.supabase.co`.
7. Click **Create**. Google shows your **Client ID** and **Client secret**. Copy both.

### 3d. Plug Google OAuth into Supabase

1. Back in the Supabase dashboard, go to **Authentication → Providers**.
2. Find **Google**, expand it, toggle **Enabled** on.
3. Paste your **Client ID** and **Client secret** from Google.
4. Leave **Authorized Client IDs** blank.
5. Click **Save**.

Supabase will now accept Google sign-ins from the OAuth client you created.

---

## Step 4 — Local + deployed environment variables

### Local dev (.env.local)

1. From the repo root, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Edit `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...your-anon-public-key
   ```
3. Run `npm run dev`. Open <http://localhost:5173>. Click **Online Play**. You should land on a Google sign-in button. Click it, sign in with `tctctc888@gmail.com`, and you'll land on the lobby.

### Deployed (Vercel / Netlify / Cloudflare Pages)

In your hosting provider's dashboard, add these environment variables for your project:

- `VITE_SUPABASE_URL` → same value
- `VITE_SUPABASE_ANON_KEY` → same value

Trigger a rebuild. The deployed site now works the same as local.

The anon key is **safe to expose** in client code — it's specifically designed for that. Row-level security (configured in the SQL migration) is what actually protects your data.

---

## Step 5 — Grant yourself admin

The very first time you sign in with `tctctc888@gmail.com`, the app creates a row in `profiles` with `is_admin = false`. You need to flip that bit once.

1. Sign in once at the deployed (or local) app with `tctctc888@gmail.com`.
2. In the Supabase dashboard, open **SQL Editor → New query**.
3. Run:
   ```sql
   update public.profiles
   set is_admin = true
   where email = 'tctctc888@gmail.com';
   ```
4. Refresh the lobby in your browser. You should now see an "Admin: active rooms" panel.

---

## Step 6 — Manual smoke test

Run the checklist in README.md → "Online play → Manual test checklist". If anything fails, the most common issues are:

- **Sign-in pops up but rejects with "redirect URI mismatch"** → Authorized redirect URI in Google Cloud doesn't match the Supabase callback URL. Double-check Step 3c.6.
- **Sign-in succeeds but lobby shows "must be signed in"** → RLS policy on `profiles` is missing or wrong. Re-run the schema SQL.
- **Create Room throws "room cap reached"** → there are already 20 active rooms. Delete some via the admin panel.
- **Realtime doesn't fire** → in Supabase, go to **Database → Replication → Postgres changes** and ensure `public.rooms` and `public.round_submissions` are in the **Source** tables. (Free tier limits Realtime to 200 messages/sec, more than enough.)

---

## Step 7 — Periodic cleanup (optional but recommended)

Idle rooms eventually accumulate. To auto-prune them every 5 minutes, you can run this scheduled SQL via Supabase's Edge Functions or [pg_cron extension](https://supabase.com/docs/guides/database/extensions/pg_cron):

```sql
-- Run as a scheduled job every 5 minutes.
-- Marks abandoned rooms; hard-deletes them after a day.
update public.rooms
  set status = 'abandoned'
  where status = 'waiting'
    and created_at < now() - interval '30 minutes';

update public.rooms
  set status = 'abandoned'
  where status = 'playing'
    and last_activity_at < now() - interval '15 minutes';

delete from public.rooms
  where status in ('abandoned', 'ended')
    and last_activity_at < now() - interval '1 day';
```

For v1, you can just run this manually every so often via the SQL editor. Setting up pg_cron is fiddly on Supabase free tier; if you outgrow this, you can pay for the Pro tier or move to scheduled Edge Functions.

---

## You're done

If steps 1–5 are green, online play works. Test it with a friend (they sign in with their Google account, you give them the 6-letter code, they join).

If something breaks, the most useful tools are:

- Supabase **Logs** (left nav → **Database → Logs → Postgres logs**) to see SQL errors.
- Browser DevTools → Network tab to see what the Supabase calls are returning.
- Browser DevTools → Console for client-side errors.
