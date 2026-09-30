import { TEXT_SIZES } from '../lib/haptics'
import { LANGS, getLang, t } from '../lib/i18n'
import { InstallRow } from '../components/Install'
import { useState } from 'react'
import { Field, PageHeader, Button, Card } from '../components/ui'
import { API } from '../lib/api'
import { snapshot } from '../lib/store'
import { download } from '../lib/format'

const KEYS = ['settings', 'batches', 'samples', 'events', 'orders', 'water', 'inventory', 'tasks', 'quality', 'tests', 'prices', 'growth']

export default function Settings({ store, go, openLang }) {
  const { settings, setSettings } = store
  const [msg, setMsg] = useState('')

  const restore = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!KEYS.some((k) => k in data)) throw new Error('This is not a ShrimpCount backup file.')
      if (!confirm('Replace ALL data on this device with the backup? This cannot be undone.')) return
      store.restore(data)
      setMsg('Backup restored.')
    } catch (err) { setMsg(`Could not restore: ${err.message}`) }
  }

  return (
    <>
      <PageHeader title={t('s_title')} onBack={() => go('/more')} />
      <div className="space-y-4">
        <InstallRow />
        <Field label={t('s_hatchery')} value={settings.hatchery} onChange={(e) => setSettings({ hatchery: e.target.value })} hint={t('s_hatchery_hint')} />
        <Field label={t('s_operator')} value={settings.operator} onChange={(e) => setSettings({ operator: e.target.value })} />

        <Card className="p-4">
          <button onClick={openLang} className="flex min-h-12 w-full items-center justify-between text-left">
            <span className="text-base font-semibold text-slate-900">{t('lang_label')}</span>
            <span className="text-[1.0625rem] font-semibold text-teal-700" lang={getLang()}>{LANGS.find(([k]) => k === getLang())?.[1]} ›</span>
          </button>
        </Card>

        <Card className="p-4">
          <div className="text-base font-semibold text-slate-900">{t('text_size')}</div>
          <p className="mt-1 text-[0.8125rem] text-slate-500">{t('text_size_hint')}</p>
          <div className="mt-3 flex gap-1.5 rounded-2xl bg-slate-100 p-1.5" role="group" aria-label={t('text_size')}>
            {TEXT_SIZES.map(([k]) => (
              /* label below */
              <button key={k} aria-pressed={(settings.textSize || 'large') === k} onClick={() => setSettings({ textSize: k })}
                className={`min-h-12 flex-1 rounded-xl px-1 text-[0.9375rem] font-semibold ${(settings.textSize || 'large') === k ? 'bg-surface text-teal-700' : 'text-slate-500'}`}>{t(`size_${k}`)}</button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-medium text-slate-900">{t('s_backup')}</div>
          <p className="mt-1 text-xs text-slate-500">{t('s_backup_body')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="dark" onClick={() => download(`shrimpcount-backup-${new Date().toLocaleDateString('en-CA')}.json`, snapshot(), 'application/json')}>{t('s_download')}</Button>
            <label className="inline-flex cursor-pointer items-center rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              {t('s_restore')}<input type="file" accept="application/json,.json" className="hidden" onChange={restore} />
            </label>
          </div>
          {msg && <p className="mt-2 text-sm text-slate-700" role="status">{msg}</p>}
        </Card>

        <Card className="p-4 text-sm text-slate-600">
          <div className="font-medium text-slate-900">{t('s_service')}</div>
          <div className="mt-1 break-all font-mono text-xs">{API}</div>
        </Card>
        <Button variant="ghost" onClick={() => go('/')}>{t('s_done')}</Button>
      </div>
    </>
  )
}
