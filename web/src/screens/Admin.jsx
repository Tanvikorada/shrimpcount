import { useEffect, useState } from 'react'
import { Card, PageHeader, Stat } from '../components/ui'
import { cloudConfigured, useCloud } from '../lib/cloud'
import { isAdmin as checkIsAdmin, fetchDashboard, updateBilling } from '../lib/admin'
import { PRICE_MONTHLY_INR, PRICE_SETUP_INR } from '../lib/pricing'

// Not translated: this screen is for the owner only, reached at #/admin (not linked anywhere - the same quiet pattern
// as #/new-account). The database's own rules (supabase/admin.sql), not this file, are what actually keep everyone
// else out: an admin session can see every hatchery, anyone else still only sees their own, exactly as before.

const STATUS = { trial: 'bg-slate-100 text-slate-700', active: 'bg-good-100 text-teal-900', expired: 'bg-red-50 text-red-700' }
const input = 'min-h-10 rounded-lg bg-surface px-2 text-[0.8125rem] ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-slate-900'

function Row({ h, onSave }) {
  const [status, setStatus] = useState(h.plan_status)
  const [paidUntil, setPaidUntil] = useState(h.paid_until || '')
  const [notes, setNotes] = useState(h.admin_notes || '')
  const [busy, setBusy] = useState(false)
  const dirty = status !== h.plan_status || paidUntil !== (h.paid_until || '') || notes !== (h.admin_notes || '')
  const save = async () => {
    setBusy(true)
    try { await onSave(h.id, { plan_status: status, paid_until: paidUntil || null, admin_notes: notes }) } finally { setBusy(false) }
  }
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[1.0625rem] font-semibold text-slate-900">{h.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${STATUS[status]}`}>{status}</span>
          </div>
          <div className="mt-0.5 text-[0.8125rem] text-slate-500">{h.members.map((m) => `${m.email} (${m.role})`).join(', ') || 'no members yet'}</div>
          <div className="mt-1 text-[0.8125rem] text-slate-500">
            Created {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            {h.lastActive && ` · Last counted ${new Date(h.lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
            {' · Invite '}<span className="font-mono">{h.invite_code}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[1.75rem] font-bold leading-none tabular-nums text-slate-900">{h.counts.toLocaleString('en-IN')}</div>
          <div className="text-[0.75rem] text-slate-500">counts total{h.countsToday ? ` · ${h.countsToday} today` : ''}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-white/[0.06] pt-3">
        <label className="text-[0.75rem] font-semibold text-slate-600">Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} mt-1 block w-28`}>
            <option value="trial">trial</option><option value="active">active</option><option value="expired">expired</option>
          </select>
        </label>
        <label className="text-[0.75rem] font-semibold text-slate-600">Paid until
          <input type="date" value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} className={`${input} mt-1 block`} />
        </label>
        <label className="min-w-[10rem] flex-1 text-[0.75rem] font-semibold text-slate-600">Notes
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. paid ₹10,000 setup 25 Sep" className={`${input} mt-1 block w-full`} />
        </label>
        <button onClick={save} disabled={!dirty || busy} className="min-h-10 rounded-lg bg-slate-900 px-4 text-[0.8125rem] font-semibold text-on-accent disabled:opacity-40">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Card>
  )
}

export default function Admin({ go }) {
  const cloud = useCloud()
  const [state, setState] = useState('checking') // checking | denied | ready
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')

  const load = async () => {
    setState('checking')
    try {
      if (!(await checkIsAdmin())) { setState('denied'); return }
      setRows(await fetchDashboard())
      setState('ready')
    } catch (x) { setErr(x.message); setState('denied') }
  }
  useEffect(() => { if (cloudConfigured && cloud.ready) load() }, [cloudConfigured, cloud.ready, cloud.user])

  const save = async (id, patch) => { await updateBilling(id, patch); setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))) }

  if (!cloudConfigured) return <><PageHeader title="Admin" onBack={() => go('/')} /><Card className="p-6 text-slate-600">Cloud is not switched on.</Card></>
  if (!cloud.ready || state === 'checking') return <><PageHeader title="Admin" onBack={() => go('/')} /><p className="text-slate-500">Loading…</p></>
  if (!cloud.user) return <><PageHeader title="Admin" onBack={() => go('/')} /><Card className="p-6 text-slate-600">Sign in first, at #/login.</Card></>
  if (state === 'denied') return <><PageHeader title="Admin" onBack={() => go('/')} /><Card className="p-6 text-slate-600">This account is not an admin.{err && <div className="mt-2 text-red-700">{err}</div>}</Card></>

  const active = rows.filter((r) => r.plan_status === 'active')
  const totalCounts = rows.reduce((n, r) => n + r.counts, 0)
  const countsToday = rows.reduce((n, r) => n + r.countsToday, 0)

  return (
    <>
      <PageHeader title="Admin" sub="Every hatchery, its usage, and its billing status - visible only to you." onBack={() => go('/')} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Hatcheries" value={rows.length} sub={`${active.length} active, ${rows.length - active.length} trial/expired`} />
        <Stat label="Est. MRR" value={`₹${(active.length * PRICE_MONTHLY_INR).toLocaleString('en-IN')}`} sub={`${active.length} × ₹${PRICE_MONTHLY_INR.toLocaleString('en-IN')}/mo`} />
        <Stat label="Counts, all time" value={totalCounts.toLocaleString('en-IN')} sub={`${countsToday} today`} />
        <Stat label="Setup fee" value={`₹${PRICE_SETUP_INR.toLocaleString('en-IN')}`} sub="one-time, per new hatchery" />
      </div>
      <div className="mt-6 space-y-3">
        {rows.length === 0 ? <Card className="p-6 text-slate-500">No hatcheries yet.</Card> : rows.map((h) => <Row key={h.id} h={h} onSave={save} />)}
      </div>
    </>
  )
}
