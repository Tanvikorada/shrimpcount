import { useEffect, useState } from 'react'
import { Button, Card, PageHeader } from '../components/ui'
import { exportLabels, countLabels } from '../lib/labelExport'
import { t } from '../lib/i18n'
import { InstallRow } from '../components/Install'
import { cloudConfigured, useCloud } from '../lib/cloud'
import { statusText } from '../components/CloudStatus'

// The core of the app is counting and the count records that go to customers. Everything else is optional and hidden
// until the hatchery turns it on: none of it is needed to count.
const core = (cloud) => [
  ...(cloudConfigured ? [['/account', t('acc_title'), cloud.user && cloud.hatchery ? `${cloud.hatchery.name} · ${statusText(cloud)}` : t('acc_banner_body')]] : []),
  ['/counts', t('m_history'), t('m_history_body')],
  ['/settings', t('m_settings'), t('m_settings_body')],
  ['/about', t('ab_title'), t('ab_row_body')],
]

const extras = () => [
  ['/water', t('wq_title'), t('mx_water_b')],
  ['/inventory', t('inv_title'), t('mx_inv_b')],
  ['/tasks', t('tsk_title'), t('mx_tsk_b')],
  ['/growth', t('gr_title'), t('mx_gr_b')],
  ['/prices', t('mx_pr_t'), t('mx_pr_b')],
  ['/tools', t('cx_title'), t('mx_tools_b')],
]

function LabelExport() {
  const [n, setN] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { countLabels().then(setN) }, [])
  return (
    <Card className="mt-3 p-4">
      <div className="text-base font-semibold">{t('lab_title')}</div>
      <div className="mt-1 text-sm text-slate-500">{t('lab_body')}</div>
      <Button variant="ghost" className="mt-3 w-full" disabled={!n || busy} onClick={async () => { setBusy(true); setMsg(''); try { setMsg(t('lab_done', { n: await exportLabels() })) } catch { setMsg(t('lab_fail')) } finally { setBusy(false) } }}>
        {n === null ? '…' : n ? t('lab_btn', { n }) : t('lab_none')}
      </Button>
      {msg && <p role="status" className="mt-2 text-sm text-teal-800">{msg}</p>}
    </Card>
  )
}

export default function More({ store, go }) {
  const cloud = useCloud()
  const on = !!store.settings.showExtras
  const low = store.inventory.filter((i) => i.reorderAt !== '' && i.reorderAt != null && Number(i.qty) <= Number(i.reorderAt)).length
  const open = store.tasks.filter((t) => !t.done).length
  const badge = { '/inventory': low ? `${low} low` : '', '/tasks': open ? `${open} open` : '' }
  const row = ([to, title, body]) => (
    <Card key={to}>
      <button onClick={() => go(to)} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left">
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="text-sm text-slate-500">{body}</div>
        </div>
        {badge[to] ? <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">{badge[to]}</span> : <span className="text-slate-400">›</span>}
      </button>
    </Card>
  )

  return (
    <>
      <PageHeader title={t('m_title')} />
      <div className="space-y-3"><InstallRow />{core(cloud).map(row)}</div>
      <LabelExport />

      <Card className="mt-6 p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={on} onChange={(e) => store.setSettings({ showExtras: e.target.checked })} className="mt-1 h-6 w-6 shrink-0 accent-teal-700" />
          <span>
            <span className="block text-base font-semibold">{t('m_extras')}</span>
            <span className="block text-sm text-slate-500">{t('m_extras_body')}</span>
          </span>
        </label>
      </Card>

      {on && <div className="mt-3 space-y-3">{extras().map(row)}</div>}
    </>
  )
}
