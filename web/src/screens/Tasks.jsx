import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader, Badge } from '../components/ui'
import { fmtDate, shareText } from '../lib/format'
import { Share } from '../components/icons'

export default function Tasks({ store, go }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', assignee: '', due: '', batchId: '' })
  const [tab, setTab] = useState('open')
  const tasks = store.tasks
  const shown = tasks.filter((t) => (tab === 'open' ? !t.done : t.done))
  const today = new Date().toLocaleDateString('en-CA')

  const submit = (e) => {
    e.preventDefault()
    store.addItem('tasks', { ...f, title: f.title.trim(), done: false })
    setF({ title: '', assignee: '', due: '', batchId: '' }); setOpen(false)
  }
  const complete = (t) => store.patchItem('tasks', t.id, t.done ? { done: false, doneAt: null } : { done: true, doneAt: new Date().toISOString() })

  return (
    <>
      <PageHeader title="Tasks and work log" sub="Assign work, track who did what" onBack={() => go('/more')}
        right={<Button onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'New task'}</Button>} />

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <Field label="Task" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Siphon tank T4" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assigned to" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} />
            <Field label="Due" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Batch</span>
            <select value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base">
              <option value="">None</option>
              {store.batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
            </select>
          </label>
          <Button className="w-full">Add task</Button>
        </form>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="Filter">
        {[['open', `Open (${tasks.filter((t) => !t.done).length})`], ['done', `Done (${tasks.filter((t) => t.done).length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${tab === k ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 bg-surface text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty title={tab === 'open' ? 'Nothing open' : 'Nothing done yet'} body="Tasks you complete are kept here as a work log." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {shown.map((t) => {
            const b = store.batches.find((x) => x.id === t.batchId)
            const overdue = !t.done && t.due && t.due < today
            return (
              <div key={t.id} className="flex items-start gap-3 p-3">
                <input type="checkbox" checked={t.done} onChange={() => complete(t)} aria-label={`Mark ${t.title} ${t.done ? 'open' : 'done'}`} className="mt-1 h-5 w-5 accent-teal-700" />
                <div className="flex-1">
                  <div className={`text-sm font-medium ${t.done ? 'text-slate-400 line-through' : ''}`}>{t.title}</div>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    {t.assignee && <span>{t.assignee}</span>}
                    {b && <span>Batch {b.code}</span>}
                    {t.due && <span className={overdue ? 'font-medium text-red-700' : ''}>due {fmtDate(t.due)}</span>}
                    {t.done && t.doneAt && <span>done {fmtDate(t.doneAt)}</span>}
                    {overdue && <Badge tone="amber">Overdue</Badge>}
                  </div>
                </div>
                {!t.done && <button aria-label="Share task" className="text-slate-500" onClick={() => shareText(`Task: ${t.title}${t.assignee ? `\nAssigned to: ${t.assignee}` : ''}${t.due ? `\nDue: ${fmtDate(t.due)}` : ''}`)}><Share width={18} /></button>}
                <button className="text-xs text-red-700" aria-label="Delete task" onClick={() => confirm('Delete this task?') && store.removeItem('tasks', t.id)}>Delete</button>
              </div>
            )
          })}
        </Card>
      )}
    </>
  )
}
