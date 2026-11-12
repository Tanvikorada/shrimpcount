-- Applied to the live project on 2026-11-12 (migration "harden_function_access"). Safe to run again.
-- Signed-out visitors have no business calling these. Signed-in users keep EXECUTE: row-level security runs the two
-- helpers as the caller, and the three RPCs are how the app creates / joins a hatchery and rotates its code.
alter function public.touch_record() set search_path = public;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.create_hatchery(text) from public, anon;
revoke execute on function public.join_hatchery(text) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.create_hatchery(text) to authenticated;
grant execute on function public.join_hatchery(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- A hatchery's own team can delete its photos (the app removes a count's photo when the count is deleted; nobody else can).
drop policy if exists evidence_delete on storage.objects;
create policy evidence_delete on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and public.is_member(((storage.foldername(name))[1])::uuid));
