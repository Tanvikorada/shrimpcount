-- ShrimpCount cloud schema for Supabase (Postgres).
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Design: the phone keeps working offline and stays the working copy. The cloud is a backup and a way to share records between
-- phones. Every record (batch, count, order, ...) is stored as one JSON row in `records`, private to one hatchery. Deleting a
-- record leaves a "tombstone" row (deleted = true) so other phones learn about it. Nobody can read another hatchery's rows.

-- ---------- tables ----------
create table if not exists public.hatcheries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  hatchery_id uuid not null references public.hatcheries (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  email       text,
  created_at  timestamptz not null default now(),
  primary key (hatchery_id, user_id)
);

create table if not exists public.records (
  hatchery_id uuid not null references public.hatcheries (id) on delete cascade,
  collection  text not null check (collection in ('settings', 'batches', 'samples', 'events', 'orders', 'water', 'inventory', 'tasks', 'quality', 'tests', 'prices', 'growth')),
  id          text not null,
  data        jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  primary key (hatchery_id, collection, id)
);
create index if not exists records_pull_idx on public.records (hatchery_id, updated_at);

-- The server, not the phone, decides when and by whom a row was changed (a phone's clock can be wrong).
create or replace function public.touch_record() returns trigger language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records for each row execute function public.touch_record();

-- ---------- who is in which hatchery ----------
create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where hatchery_id = h and user_id = auth.uid())
$$;

-- ---------- row level security ----------
alter table public.hatcheries enable row level security;
alter table public.members    enable row level security;
alter table public.records    enable row level security;

drop policy if exists hatcheries_read on public.hatcheries;
create policy hatcheries_read on public.hatcheries for select to authenticated using (public.is_member(id));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member(hatchery_id));

drop policy if exists records_read on public.records;
create policy records_read on public.records for select to authenticated using (public.is_member(hatchery_id));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated with check (public.is_member(hatchery_id));
drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated using (public.is_member(hatchery_id)) with check (public.is_member(hatchery_id));
-- no delete policy on purpose: records are never really deleted, only marked deleted.
-- no insert/update policy on hatcheries or members: they change only through the functions below.

-- Supabase gives new tables broad default permissions; take them all away, then grant only what is needed.
revoke all on public.hatcheries, public.members, public.records from anon, authenticated;
grant select on public.hatcheries, public.members to authenticated;
grant select, insert, update on public.records to authenticated;

-- ---------- creating and joining a hatchery ----------
create or replace function public.create_hatchery(p_name text) returns public.hatcheries
language plpgsql security definer set search_path = public as $$
declare h public.hatcheries;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.hatcheries (name, created_by) values (trim(p_name), auth.uid()) returning * into h;
  insert into public.members (hatchery_id, user_id, role, email)
    values (h.id, auth.uid(), 'owner', (select email from auth.users where id = auth.uid()));
  return h;
end $$;

create or replace function public.join_hatchery(p_code text) returns public.hatcheries
language plpgsql security definer set search_path = public as $$
declare h public.hatcheries;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.hatcheries where invite_code = upper(trim(p_code));
  if not found then raise exception 'invalid invite code'; end if;
  insert into public.members (hatchery_id, user_id, role, email)
    values (h.id, auth.uid(), 'member', (select email from auth.users where id = auth.uid()))
    on conflict (hatchery_id, user_id) do nothing;
  return h;
end $$;

-- The owner can replace the invite code (for example when someone left).
create or replace function public.rotate_invite_code(p_hatchery uuid) returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not exists (select 1 from public.members where hatchery_id = p_hatchery and user_id = auth.uid() and role = 'owner') then
    raise exception 'only the owner can do this';
  end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update public.hatcheries set invite_code = code where id = p_hatchery;
  return code;
end $$;

revoke all on function public.create_hatchery(text), public.join_hatchery(text), public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.create_hatchery(text), public.join_hatchery(text), public.rotate_invite_code(uuid) to authenticated;

-- ---------- photos (the marked evidence photo of each count) ----------
-- A private bucket. Files live under "<hatchery id>/<count id>.jpg" and only members of that hatchery can touch them.
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false) on conflict (id) do nothing;

drop policy if exists evidence_read on storage.objects;
create policy evidence_read on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists evidence_insert on storage.objects;
create policy evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists evidence_update on storage.objects;
create policy evidence_update on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and public.is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'evidence' and public.is_member(((storage.foldername(name))[1])::uuid));
