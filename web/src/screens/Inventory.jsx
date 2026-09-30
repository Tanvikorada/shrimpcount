import { useState } from 'react'
import { Card, Empty, Button, Field, PageHeader, Badge } from '../components/ui'
import { fmt } from '../lib/format'

const low = (i) => i.reorderAt !== '' && i.reorderAt != null && Number(i.qty) <= Number(i.reorderAt)

export default function Inventory({ store, go }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', unit: 'kg', qty: '', reorderAt: '' })
  const [amt, setAmt] = useState({})
  const items = store.inventory
  const lowCount = items.filter(low).length

  const submit = (e) => {
    e.preventDefault()
    store.addItem('inventory', { ...f, name: f.name.trim(), qty: Number(f.qty) })
    setF({ name: '', unit: 'kg', qty: '', reorderAt: '' }); setOpen(false)
  }
  const adjust = (i, sign) => {
    const n = Number(amt[i.id])
    if (!(n > 0)) return
    store.patchItem('inventory', i.id, { qty: Math.max(0, Number(i.qty) + sign * n) })
    setAmt({ ...amt, [i.id]: '' })
  }

  return (
    <>
      <PageHeader title="Inventory" sub={lowCount ? `${lowCount} item${lowCount === 1 ? '' : 's'} low` : 'Feed, artemia, chemicals, supplies'} onBack={() => go('/more')}
        right={<Button onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'Add item'}</Button>} />

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface p-4">
          <Field label="Item" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Artemia cysts" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            <Field label="In stock" required type="number" step="any" inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
            <Field label="Alert at or below" type="number" step="any" inputMode="decimal" value={f.reorderAt} onChange={(e) => setF({ ...f, reorderAt: e.target.value })} />
          </div>
          <Button className="w-full">Save item</Button>
        </form>
      )}

      {items.length === 0 ? (
        <Empty title="No items yet" body="Track stock and get a warning when something runs low." />
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold">{i.name}{low(i) && <Badge tone="amber">Low</Badge>}</div>
                  <div className="text-xs text-slate-500">{i.reorderAt !== '' && i.reorderAt != null ? `Alert at ${fmt(i.reorderAt)} ${i.unit}` : 'No alert set'}</div>
                </div>
                <div className="text-right"><div className="text-2xl font-semibold tabular-nums">{fmt(i.qty)}</div><div className="text-xs text-slate-500">{i.unit}</div></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input aria-label={`Amount for ${i.name}`} type="number" step="any" inputMode="decimal" value={amt[i.id] ?? ''} onChange={(e) => setAmt({ ...amt, [i.id]: e.target.value })}
                  placeholder="Amount" className="w-24 rounded-lg ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 px-2.5 py-1.5 text-sm" />
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => adjust(i, +1)}>Received</Button>
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => adjust(i, -1)}>Used</Button>
                <button className="ml-auto text-xs text-red-700" onClick={() => confirm(`Delete ${i.name}?`) && store.removeItem('inventory', i.id)}>Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
