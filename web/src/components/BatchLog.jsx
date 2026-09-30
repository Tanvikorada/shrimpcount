import { useState } from 'react'
import { Button, Card } from './ui'
import { fmtDate, fmtTime } from '../lib/format'

const TYPES = {
  stage: 'Stage change',
  feed: 'Feeding',
  water: 'Water quality',
  mortality: 'Mortality',
  treatment: 'Treatment',
  note: 'Note',
}

export default function BatchLog({ batch, events, store }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('note')
  const [value, setValue] = useState('')
  const [text, setText] = useState('')

  const valueHint = { stage: 'New stage, e.g. PL10', feed: 'Feed and amount', water: 'e.g. Salinity 15, pH 7.9, 30°C', mortality: 'Dead count or %', treatment: 'Product and dose', note: '' }[type]

  const submit = (e) => {
    e.preventDefault()
    store.addEvent({ batchId: batch.id, type, value: value.trim(), text: text.trim() })
    if (type === 'stage' && value.trim()) store.updateBatch(batch.id, { plStage: value.trim() })
    setValue(''); setText(''); setOpen(false)
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Production log</h2>
        <button onClick={() => setOpen(!open)} className="text-sm font-medium text-teal-700">{open ? 'Cancel' : 'Add entry'}</button>
      </div>

      {open && (
        <form onSubmit={submit} className="mb-3 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Entry type">
            {Object.entries(TYPES).map(([k, l]) => (
              <button type="button" key={k} onClick={() => setType(k)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${type === k ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-300 text-slate-600'}`}>{l}</button>
            ))}
          </div>
          {type !== 'note' && (
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={valueHint} required={type === 'stage'}
              className="w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 px-3.5 py-2.5 text-base" />
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Details (optional)" required={type === 'note'}
            className="w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 px-3.5 py-2.5 text-sm" />
          <Button className="w-full">Save entry</Button>
        </form>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-slate-500">Log stage changes, feeding, water quality, mortality and treatments for this batch.</p>
      ) : (
        <Card className="divide-y divide-slate-100">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 p-3">
              <div className="mt-0.5 w-24 shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-center text-xs font-medium text-slate-700">{TYPES[ev.type]}</div>
              <div className="flex-1 text-sm">
                {ev.value && <div className="font-medium">{ev.value}</div>}
                {ev.text && <div className="text-slate-600">{ev.text}</div>}
                <div className="text-xs text-slate-500">{fmtDate(ev.timestamp)} · {fmtTime(ev.timestamp)}</div>
              </div>
              <button className="min-h-11 min-w-11 shrink-0 rounded-xl px-2 text-[0.8125rem] font-semibold text-red-700 active:bg-red-50" aria-label="Delete entry" onClick={() => confirm('Delete this entry?') && store.deleteEvent(ev.id)}>Delete</button>
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}
