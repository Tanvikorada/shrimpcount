// A small stand-in for Supabase, for testing the app's account and backup code without a real project.
// It speaks the same web protocol the app's Supabase client uses (sign-up, sign-in, tables, the three functions, file storage)
// and keeps everything in memory. It is a TEST TOOL: it enforces membership like the real database rules do, but it is not the
// real thing, and passing against it does not prove the real Supabase behaves the same. Run: node supabase/mock-server.mjs
import http from 'node:http'
import { randomUUID, randomBytes } from 'node:crypto'

const PORT = Number(process.env.PORT || 54321)
const users = new Map()        // id -> { id, email, password }
const hatcheries = new Map()   // id -> { id, name, invite_code }
const members = []             // { hatchery_id, user_id, role, email }
const records = new Map()      // hatchery|collection|id -> row
const files = new Map()        // "evidence/<path>" -> Buffer
let clock = Date.UTC(2026, 8, 21, 10, 0, 0)
const now = () => new Date((clock += 1000)).toISOString()

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*' }
const send = (res, code, body, extra = {}) => {
  res.writeHead(code, { ...cors, 'Content-Type': typeof body === 'string' || Buffer.isBuffer(body) ? (extra['Content-Type'] || 'application/json') : 'application/json', ...extra })
  res.end(Buffer.isBuffer(body) ? body : typeof body === 'string' ? body : JSON.stringify(body))
}
const readBody = (req) => new Promise((resolve) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))) })
const session = (u) => ({ access_token: `tok-${u.id}`, refresh_token: `ref-${u.id}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } })
const who = (req) => { const t = (req.headers.authorization || '').replace('Bearer ', ''); return t.startsWith('tok-') ? users.get(t.slice(4)) : null }
const isMember = (uid, h) => members.some((m) => m.user_id === uid && m.hatchery_id === h)

function parseFilter(params, rows) {
  let out = rows
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const m = /^(eq|gte|gt|lte|lt)\.(.*)$/.exec(v)
    if (!m) continue
    const [, op, val] = m
    out = out.filter((r) => {
      const x = String(r[k]); return op === 'eq' ? x === val : op === 'gte' ? x >= val : op === 'gt' ? x > val : op === 'lte' ? x <= val : x < val
    })
  }
  return out
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname
  if (req.method === 'OPTIONS') return send(res, 204, '')
  try {
    // ---- auth
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const { email, password } = JSON.parse((await readBody(req)).toString())
      if ([...users.values()].some((u) => u.email === email)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' })
      const u = { id: randomUUID(), email, password }; users.set(u.id, u)
      return send(res, 200, session(u))
    }
    if (p === '/auth/v1/token' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString())
      if (url.searchParams.get('grant_type') === 'refresh_token') { const id = String(body.refresh_token).replace('ref-', ''); const u = users.get(id); return u ? send(res, 200, session(u)) : send(res, 400, { error: 'invalid_grant', error_description: 'bad refresh token' }) }
      const u = [...users.values()].find((x) => x.email === body.email && x.password === body.password)
      return u ? send(res, 200, session(u)) : send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
    }
    if (p === '/auth/v1/user') { const u = who(req); return u ? send(res, 200, session(u).user) : send(res, 401, { msg: 'not signed in' }) }
    if (p === '/auth/v1/logout') return send(res, 204, '')

    // ---- functions
    if (p.startsWith('/rest/v1/rpc/') && req.method === 'POST') {
      const u = who(req); if (!u) return send(res, 401, { message: 'not signed in' })
      const fn = p.split('/').pop(); const body = JSON.parse((await readBody(req)).toString() || '{}')
      if (fn === 'create_hatchery') {
        const h = { id: randomUUID(), name: String(body.p_name).trim(), invite_code: randomBytes(4).toString('hex').toUpperCase(), created_at: now() }
        hatcheries.set(h.id, h); members.push({ hatchery_id: h.id, user_id: u.id, role: 'owner', email: u.email }); return send(res, 200, h)
      }
      if (fn === 'join_hatchery') {
        const h = [...hatcheries.values()].find((x) => x.invite_code === String(body.p_code).trim().toUpperCase())
        if (!h) return send(res, 400, { message: 'invalid invite code' })
        if (!isMember(u.id, h.id)) members.push({ hatchery_id: h.id, user_id: u.id, role: 'member', email: u.email })
        return send(res, 200, h)
      }
      if (fn === 'rotate_invite_code') {
        const h = hatcheries.get(body.p_hatchery)
        if (!h || !members.some((m) => m.hatchery_id === h.id && m.user_id === u.id && m.role === 'owner')) return send(res, 400, { message: 'only the owner can do this' })
        h.invite_code = randomBytes(4).toString('hex').toUpperCase(); return send(res, 200, h.invite_code)
      }
    }

    // ---- tables
    if (p === '/rest/v1/members' && req.method === 'GET') {
      const u = who(req); if (!u) return send(res, 401, { message: 'not signed in' })
      let rows = parseFilter(url.searchParams, members.filter((m) => isMember(u.id, m.hatchery_id)))
      const embed = (url.searchParams.get('select') || '').includes('hatcheries')
      rows = rows.map((m) => (embed ? { role: m.role, hatchery_id: m.hatchery_id, hatcheries: hatcheries.get(m.hatchery_id) } : { email: m.email, role: m.role }))
      return send(res, 200, rows.slice(0, Number(url.searchParams.get('limit') || 1000)))
    }
    if (p === '/rest/v1/records') {
      const u = who(req); if (!u) return send(res, 401, { message: 'not signed in' })
      if (req.method === 'GET') {
        let rows = parseFilter(url.searchParams, [...records.values()].filter((r) => isMember(u.id, r.hatchery_id)))
        rows.sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id))
        const off = Number(url.searchParams.get('offset') || 0), lim = Number(url.searchParams.get('limit') || 1000)
        return send(res, 200, rows.slice(off, off + lim).map(({ collection, id, data, deleted, updated_at }) => ({ collection, id, data, deleted, updated_at })))
      }
      if (req.method === 'POST') {
        const rows = JSON.parse((await readBody(req)).toString())
        for (const r of rows) {
          if (!isMember(u.id, r.hatchery_id)) return send(res, 403, { message: 'new row violates row-level security policy for table "records"' })
          records.set(`${r.hatchery_id}|${r.collection}|${r.id}`, { ...r, updated_at: now(), updated_by: u.id })
        }
        return send(res, 201, '')
      }
    }

    // ---- storage
    const m = /^\/storage\/v1\/object\/(?:authenticated\/)?(.+)$/.exec(p)
    if (m) {
      const u = who(req); if (!u) return send(res, 401, { message: 'not signed in' })
      const path = decodeURIComponent(m[1])
      const hid = path.split('/')[1]
      if (!isMember(u.id, hid)) return send(res, req.method === 'GET' ? 404 : 403, { message: 'not allowed' })
      if (req.method === 'POST' || req.method === 'PUT') {
        const buf = await readBody(req)
        const ct = req.headers['content-type'] || ''
        if (process.env.DEBUG_UPLOAD) console.log('upload', req.method, { te: req.headers['transfer-encoding'], cl: req.headers['content-length'], ct, len: buf.length, head: JSON.stringify(buf.subarray(0, 40).toString('latin1')) })
        let data = buf
        if (ct.startsWith('multipart/form-data')) { // the client sends the photo as a form field: find the part that is a file
          const boundary = Buffer.from(`--${/boundary=(.+)$/.exec(ct)[1]}`)
          let at = 0, found = null
          while ((at = buf.indexOf(boundary, at)) !== -1) {
            const headEnd = buf.indexOf('\r\n\r\n', at)
            const next = buf.indexOf(boundary, headEnd)
            if (headEnd === -1 || next === -1) break
            if (buf.subarray(at, headEnd).toString('latin1').includes('filename=')) { found = buf.subarray(headEnd + 4, next - 2); break }
            at = next
          }
          if (found) data = found
        }
        files.set(path, Buffer.from(data)); return send(res, 200, { Key: path })
      }
      if (req.method === 'GET') return files.has(path) ? send(res, 200, files.get(path), { 'Content-Type': 'image/jpeg' }) : send(res, 404, { message: 'Object not found' })
    }

    // ---- test helper
    if (p === '/__debug') return send(res, 200, { users: users.size, hatcheries: [...hatcheries.values()], members, records: [...records.values()].map((r) => `${r.collection}:${r.id}${r.deleted ? ' (deleted)' : ''}`), files: [...files.keys()] })
    send(res, 404, { message: `not found: ${req.method} ${p}` })
  } catch (e) { send(res, 500, { message: String(e) }) }
}).listen(PORT, () => console.log(`mock Supabase on http://localhost:${PORT}`))
