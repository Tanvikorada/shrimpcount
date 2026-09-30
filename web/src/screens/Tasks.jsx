import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader, Badge } from '../components/ui'
import { fmtDate, shareText } from '../lib/format'
import { Share } from '../components/icons'
import { t } from '../lib/i18n'

export default function Tasks({ store, go }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', assignee: '', due: '', batchId: '' })
  const [tab, setTab] = useState('open')
  const tasks = store.tasks
  const shown = tasks.filter((k) => (tab === 'open' ? !k.done : k.done))
  const today = new Date().toLocaleDateString('en-CA')

  const submit = (e) => {
    e.preventDefault()
    store.addItem('tasks', { ...f, title: f.title.trim(), done: false })
    setF({ title: '', assignee: '', due: '', batchId: '' }); setOpen(false)
  }
  const complete = (k) => store.patchItem('tasks', k.id, k.done ? { done: false, doneAt: null } : { done: true, doneAt: new Date().toISOString() })

  return (
    <>
      <PageHeader title={t('tsk_title')} sub={t('tsk_sub')} onBack={() => go('/more')}
        right={<Button onClick={() => setOpen(!open)}>{open ? t('cancel') : t('tsk_new')}</Button>} />

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <Field label={t('tsk_task_label')} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('tsk_task_ph')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('tsk_assigned_label')} value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} />
            <Field label={t('tsk_due_label')} type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('fl_batch')}</span>
            <select value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })} className="mt-1 w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base">
              <option value="">{t('opt_none')}</option>
              {store.batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
            </select>
          </label>
          <Button className="w-full">{t('tsk_add')}</Button>
        </form>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label={t('tsk_filter_aria')}>
        {[['open', t('tsk_open_tab', { n: tasks.filter((k) => !k.done).length })], ['done', t('tsk_done_tab', { n: tasks.filter((k) => k.done).length })]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${tab === k ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 bg-surface text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty title={tab === 'open' ? t('tsk_empty_open') : t('tsk_empty_done')} body={t('tsk_empty_body')} />
      ) : (
        <Card className="divide-y divide-slate-100">
          {shown.map((k) => {
            const b = store.batches.find((x) => x.id === k.batchId)
            const overdue = !k.done && k.due && k.due < today
            return (
              <div key={k.id} className="flex items-start gap-3 p-3">
                <input type="checkbox" checked={k.done} onChange={() => complete(k)} aria-label={t('tsk_mark_aria', { title: k.title, state: k.done ? t('tsk_mark_open') : t('tsk_mark_done') })} className="mt-1 h-5 w-5 accent-teal-700" />
                <div className="flex-1">
                  <div className={`text-sm font-medium ${k.done ? 'text-slate-400 line-through' : ''}`}>{k.title}</div>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    {k.assignee && <span>{k.assignee}</span>}
                    {b && <span>{t('batch_code', { code: b.code })}</span>}
                    {k.due && <span className={overdue ? 'font-medium text-red-700' : ''}>{t('tsk_due', { date: fmtDate(k.due) })}</span>}
                    {k.done && k.doneAt && <span>{t('tsk_done_on', { date: fmtDate(k.doneAt) })}</span>}
                    {overdue && <Badge tone="amber">{t('tsk_overdue_badge')}</Badge>}
                  </div>
                </div>
                {!k.done && <button aria-label={t('tsk_share_aria')} className="text-slate-500" onClick={() => shareText(`${t('tsk_share_task', { title: k.title })}${k.assignee ? t('tsk_share_assigned', { name: k.assignee }) : ''}${k.due ? t('tsk_share_due', { date: fmtDate(k.due) }) : ''}`)}><Share width={18} /></button>}
                <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label={t('tsk_delete_aria')} onClick={() => confirm(t('tsk_delete_confirm')) && store.removeItem('tasks', k.id)}>{t('delete')}</button>
              </div>
            )
          })}
        </Card>
      )}
    </>
  )
}
