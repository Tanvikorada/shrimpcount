// Tests the REAL schema file (supabase/schema.sql) on an embedded Postgres (PGlite), with Supabase's auth and storage pieces
// stubbed. It checks the privacy rules: a hatchery's rows are invisible to other people, members cannot escalate, and the
// server stamps who changed what. It does NOT test Supabase's own sign-in service or storage server.
// Run: node --test web/supabase.schema.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

async function fresh() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    grant usage on schema auth, storage, public to anon, authenticated;
    grant select on auth.users to authenticated;
    insert into auth.users values ('${A}', 'a@hatchery.test'), ('${B}', 'b@hatchery.test');
  `)
  await db.exec(schema)
  await db.exec('grant select, insert, update on storage.objects to authenticated; grant select on storage.buckets to authenticated')
  return db
}
const as = async (db, user, fn) => {
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${user || ''}', false)`)
  try { return await fn() } finally { await db.exec('reset role') }
}

test('the schema loads, and running it twice is safe', async () => {
  const db = await fresh()
  await db.exec(schema)
})

test('creating a hatchery makes the caller its owner', async () => {
  const db = await fresh()
  const h = await as(db, A, async () => (await db.query("select * from public.create_hatchery('MAS Aqua')")).rows[0])
  assert.equal(h.name, 'MAS Aqua')
  assert.equal(h.invite_code.length, 8)
  const m = await as(db, A, async () => (await db.query('select role, email from public.members')).rows)
  assert.deepEqual(m, [{ role: 'owner', email: 'a@hatchery.test' }])
})

test('a signed-out visitor cannot create a hatchery or read anything', async () => {
  const db = await fresh()
  await assert.rejects(as(db, null, () => db.query("select * from public.create_hatchery('x')")))
  await assert.rejects(as(db, null, () => db.query('select * from public.records')))
})

test("another person cannot read, add or change a hatchery's records", async () => {
  const db = await fresh()
  const h = await as(db, A, async () => (await db.query("select * from public.create_hatchery('MAS Aqua')")).rows[0])
  await as(db, A, () => db.query("insert into public.records (hatchery_id, collection, id, data) values ($1, 'samples', 's1', '{\"count\":1700}')", [h.id]))

  const seen = await as(db, B, async () => (await db.query('select * from public.records')).rows)
  assert.equal(seen.length, 0, 'B must see nothing')
  await assert.rejects(as(db, B, () => db.query("insert into public.records (hatchery_id, collection, id, data) values ($1, 'samples', 's2', '{}')", [h.id])))
  const upd = await as(db, B, () => db.query("update public.records set data = '{\"count\":1}' where id = 's1'"))
  assert.equal(upd.affectedRows, 0, 'B must not change A rows')
  assert.equal((await as(db, B, async () => (await db.query('select * from public.hatcheries')).rows)).length, 0)
})

test('a member cannot give themselves access or rewrite membership', async () => {
  const db = await fresh()
  const h = await as(db, A, async () => (await db.query("select * from public.create_hatchery('MAS Aqua')")).rows[0])
  await assert.rejects(as(db, B, () => db.query("insert into public.members (hatchery_id, user_id, role) values ($1, $2, 'owner')", [h.id, B])))
  await assert.rejects(as(db, A, () => db.query("update public.hatcheries set name = 'x'")))
  await assert.rejects(as(db, B, () => db.query('select public.rotate_invite_code($1)', [h.id])), /only the owner/)
})

test('joining needs the right code, then the member can read and write', async () => {
  const db = await fresh()
  const h = await as(db, A, async () => (await db.query("select * from public.create_hatchery('MAS Aqua')")).rows[0])
  await as(db, A, () => db.query("insert into public.records (hatchery_id, collection, id, data) values ($1, 'samples', 's1', '{\"count\":1700}')", [h.id]))
  await assert.rejects(as(db, B, () => db.query("select * from public.join_hatchery('WRONGCODE')")), /invalid invite code/)
  await as(db, B, () => db.query('select * from public.join_hatchery($1)', [h.invite_code.toLowerCase()])) // case does not matter
  const rows = await as(db, B, async () => (await db.query('select id, data from public.records')).rows)
  assert.deepEqual(rows.map((r) => r.id), ['s1'])
  await as(db, B, () => db.query("insert into public.records (hatchery_id, collection, id, data) values ($1, 'samples', 's2', '{}')", [h.id]))
  assert.equal((await as(db, A, async () => (await db.query('select * from public.records')).rows)).length, 2)
})

test('records are never really deleted, only marked; the server stamps time and author', async () => {
  const db = await fresh()
  const h = await as(db, A, async () => (await db.query("select * from public.create_hatchery('MAS Aqua')")).rows[0])
  await as(db, A, () => db.query("insert into public.records (hatchery_id, collection, id, data, updated_by, updated_at) values ($1, 'samples', 's1', '{}', $2, '2001-01-01')", [h.id, B]))
  const r = await as(db, A, async () => (await db.query('select updated_by, updated_at from public.records')).rows[0])
  assert.equal(r.updated_by, A, 'the author cannot be faked')
  assert.ok(new Date(r.updated_at).getFullYear() >= 2024, 'the time cannot be faked')
  // a real delete must not be possible: refused outright, or (with broader default permissions) it removes no row
  const removed = await as(db, A, () => db.query("delete from public.records where id = 's1'")).then((r) => r.affectedRows, () => 0)
  assert.equal(removed, 0)
  assert.equal((await as(db, A, async () => (await db.query('select * from public.records')).rows)).length, 1)
  await as(db, A, () => db.query("update public.records set deleted = true where id = 's1'"))
  assert.equal((await as(db, A, async () => (await db.query('select deleted from public.records')).rows[0])).deleted, true)
})

test('unknown collections are refused', async () => {
  const db = await fresh()
  const h = await as(db, A, async () => (await db.query("select * from public.create_hatchery('MAS Aqua')")).rows[0])
  await assert.rejects(as(db, A, () => db.query("insert into public.records (hatchery_id, collection, id, data) values ($1, 'passwords', 'x', '{}')", [h.id])))
})

test('photo files are limited to the hatchery folder the person belongs to', async () => {
  const db = await fresh()
  const h = await as(db, A, async () => (await db.query("select * from public.create_hatchery('MAS Aqua')")).rows[0])
  await as(db, A, () => db.query("insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${h.id}/s1.jpg`]))
  await assert.rejects(as(db, B, () => db.query("insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${h.id}/s2.jpg`])))
  assert.equal((await as(db, B, async () => (await db.query('select * from storage.objects')).rows)).length, 0)
  assert.equal((await as(db, A, async () => (await db.query('select * from storage.objects')).rows)).length, 1)
})
