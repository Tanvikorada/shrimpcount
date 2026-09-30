# Switching on accounts and cloud backup (about 15 minutes, free)

The app is built and tested. It stays in "local only" mode until it is given a Supabase project. Nothing below costs money.

## What you do (the parts I cannot do for you)

1. **Create a free Supabase account and a project** at supabase.com. Pick a region close to India (Mumbai / `ap-south-1`).
   Choose a database password and keep it safe. You will not need it again for this.
2. **Create the tables.** In the project: SQL Editor, New query. Open `supabase/schema.sql` from this project, paste it all,
   press Run. It should say "Success". It is safe to run again.
3. **Turn off email confirmation for the pilot.** Authentication, Sign In / Providers, Email: switch **off** "Confirm email".
   (Why: Supabase's built-in email sender is limited to a couple of emails an hour on the free plan, so confirmation
   emails would block new staff from joining. With it off, people sign in straight away. Later, add a proper email service
   and switch confirmation back on.)
4. **Copy two values.** Project Settings, API: the **Project URL** and the **anon public** key.
   The anon key is meant to be in the app; it is safe because the database rules (row level security) decide who can see what.
   **Do not share the `service_role` key with anyone, and never put it in the app.**
5. **Give me those two values**, or set them yourself: in the Vercel project `shrimpcount-app`, Settings, Environment Variables,
   add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.

After that, "Account and backup" appears in More, and Home offers "Set up backup".

## What staff see

- The first person opens **Account and backup**, makes an account, and **creates the hatchery**. Their records upload by themselves.
- A colleague makes their own account and taps **Join your team**, typing the **invite code** shown to the owner.
- On a new phone: sign in, and the records and the marked photos download by themselves.
- No signal is fine: everything still works, and it backs up when the signal returns.

## How it behaves (so nobody is surprised)

- The phone is the working copy. The cloud is a backup and a way to share records between phones.
- If two phones change the **same** count before syncing, the phone that syncs last wins, and the screen says how many clashes there were.
  Nobody's unsaved work is silently thrown away: an edit beats a deletion.
- Deleting a count deletes it for the whole team (it leaves a hidden "deleted" marker so other phones learn about it).
- Language, text size and the "extra tools" switch stay personal to each phone. Hatchery name and operator are shared.
- Photos go to a private storage area. Only members of that hatchery can open them.
- Free plan limits to be aware of: about 500 MB of database and 1 GB of photo storage. Each marked photo is roughly 0.2 MB, so
  roughly 4,000 photos before the storage fills. Projects on the free plan are paused after a week of no use.

## What has and has not been tested

Tested: the database rules on a real Postgres engine (nobody can read or change another hatchery's rows, members cannot promote
themselves, records are never truly deleted, photo access is limited to the hatchery folder); all the sync merge logic including
conflicts and interrupted uploads; and the app's real Supabase client end to end against a stand-in server that speaks Supabase's
protocol (sign up, create and join a hatchery, back up, restore on a "new phone", photo upload and download).

**Real Supabase project (gqixvanhkytgoscohhbj, Singapore) tested 2026-09-21 by script: sign-up, create/join hatchery, backup, restore visibility, outsider blocked, photo upload/download, invite rotation. Not tested by tapping through the app on a phone.**
reset and the storage server are Supabase's own and were not exercised. Not built: password reset, per-person roles beyond
owner and member, removing a member, and an audit trail of who edited what.

## Privacy note for the hatchery

Records are stored in Supabase's cloud (a US company; choose the Mumbai region for storage location). Staff email addresses are
stored. Tell the hatchery this before they use it, and agree who owns the data.
