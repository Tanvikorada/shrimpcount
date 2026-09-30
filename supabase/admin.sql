-- Admin dashboard support: who counts as an admin, and what they are allowed to see and change that a normal
-- hatchery member cannot. Safe to run again. Run after schema.sql, the same way (SQL Editor, paste, Run).

-- ---------- who is an admin ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- Bootstrap: the account already signed up at tanvikorada@gmail.com (via the app's private /new-account page).
insert into public.admins (user_id)
  select id from auth.users where email = 'tanvikorada@gmail.com'
  on conflict (user_id) do nothing;

-- ---------- billing fields on a hatchery, for the admin to fill in by hand (no payment processing here) ----------
alter table public.hatcheries add column if not exists plan_status text not null default 'trial' check (plan_status in ('trial', 'active', 'expired'));
alter table public.hatcheries add column if not exists paid_until date;
alter table public.hatcheries add column if not exists admin_notes text;

-- ---------- admins can see (and lightly manage) every hatchery, not just ones they are a member of ----------
drop policy if exists hatcheries_admin_read on public.hatcheries;
create policy hatcheries_admin_read on public.hatcheries for select to authenticated using (public.is_admin());
drop policy if exists hatcheries_admin_update on public.hatcheries;
create policy hatcheries_admin_update on public.hatcheries for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant update (plan_status, paid_until, admin_notes) on public.hatcheries to authenticated;

drop policy if exists members_admin_read on public.members;
create policy members_admin_read on public.members for select to authenticated using (public.is_admin());

-- Counts and other records: read-only for admins, and only what is needed for a usage count (never delivery/customer detail).
drop policy if exists records_admin_read on public.records;
create policy records_admin_read on public.records for select to authenticated using (public.is_admin());
