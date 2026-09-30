import { useState } from 'react'
import { Button, Card, Empty, PageHeader } from '../components/ui'
import { ago, statusText } from '../components/CloudStatus'
import { cloudConfigured, createHatchery, joinHatchery, rotateInvite, signIn, signOut, signUp, syncNow, useCloud } from '../lib/cloud'
import { COLLECTIONS } from '../lib/cloudEngine'
import { shareText } from '../lib/format'
import { t } from '../lib/i18n'

// Turn the server's English error into a plain sentence in the person's language (anything unknown is shown as it is).
export function friendly(msg = '') {
  if (/invalid login|invalid_credentials/i.test(msg)) return t('acc_e_login')
  if (/invalid invite code/i.test(msg)) return t('acc_e_code')
  if (/already registered|already exists/i.test(msg)) return t('acc_e_exists')
  if (/at least 6|password should be|weak password/i.test(msg)) return t('acc_e_short')
  if (/failed to fetch|network|load failed/i.test(msg) || !navigator.onLine) return t('acc_e_net')
  return t('acc_err', { msg })
}
const input = 'mt-1.5 min-h-14 w-full rounded-2xl bg-surface px-4 text-base text-slate-900 ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-teal-600'
const Err = ({ msg }) => (msg ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{friendly(msg)}</p> : null)

function AuthForm({ go }) {
  const [mode, setMode] = useState('in')   // self-serve sign-up is not offered here: an owner-issued account signs in; anyone else is sent to request access
  const [f, setF] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(''); setNote('')
    try {
      if (mode === 'up') { const r = await signUp(f.email, f.password); if (r.needsConfirm) setNote(t('acc_confirm_mail')) }
      else await signIn(f.email, f.password)
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Card className="p-5">
      <p className="mb-4 text-[0.9375rem] leading-snug text-slate-600">{t('acc_intro')}</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('acc_email')}</span>
          <input type="email" required autoComplete="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
        <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('acc_password')}</span>
          <input type="password" required minLength={6} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={input} /></label>
        <Button className="w-full" disabled={busy}>{mode === 'up' ? t('acc_signup') : t('acc_signin')}</Button>
      </form>
      {note && <p role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{note}</p>}
      <Err msg={err} />
      <button onClick={() => go('/access')} className="mt-4 min-h-12 w-full text-[0.9375rem] font-semibold text-teal-700">{t('acc_new')}</button>
    </Card>
  )
}

function Setup({ store }) {
  const [name, setName] = useState(store.settings.hatchery || '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const run = (kind, fn) => async (e) => {
    e.preventDefault(); setBusy(kind); setErr('')
    try { await fn() } catch (x) { setErr(x.message) } finally { setBusy('') }
  }
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-[1.125rem] font-bold text-slate-900">{t('acc_create_h')}</h3>
        <form onSubmit={run('create', () => createHatchery(name))} className="mt-3 space-y-3">
          <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('acc_hname')}</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
          <Button className="w-full" disabled={!!busy}>{t('acc_create_btn')}</Button>
        </form>
      </Card>
      <p className="text-center text-[0.9375rem] font-medium text-slate-500">{t('acc_or')}</p>
      <Card className="p-5">
        <h3 className="text-[1.125rem] font-bold text-slate-900">{t('acc_join_h')}</h3>
        <form onSubmit={run('join', () => joinHatchery(code))} className="mt-3 space-y-3">
          <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('acc_code')}</span>
            <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck="false" className={`${input} font-mono tracking-widest`} /></label>
          <Button variant="ghost" className="w-full" disabled={!!busy}>{t('acc_join_btn')}</Button>
        </form>
      </Card>
      <Err msg={err} />
    </div>
  )
}

function Dashboard({ store }) {
  const c = useCloud()
  const [err, setErr] = useState('')
  const records = COLLECTIONS.reduce((n, k) => n + (store[k]?.length || 0), 0)
  const bad = c.status === 'error' || c.status === 'offline'
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="text-[0.8125rem] text-slate-500">{t('acc_signed_as', { email: c.user.email })}</div>
        <div className="mt-1 text-[1.375rem] font-bold tracking-tight text-slate-900">{c.hatchery.name}</div>
        <div className={`mt-3 rounded-2xl p-3 text-[0.9375rem] ${bad ? 'bg-amber-100 text-amber-900' : 'bg-good-100 text-teal-900'}`} role="status">{statusText(c)}</div>
        <Button className="mt-3 w-full" onClick={() => syncNow()} disabled={c.status === 'syncing'}>{t('acc_now')}</Button>
        <p className="mt-3 text-[0.8125rem] text-slate-500">{t('acc_records', { n: records })}</p>
        <p className="mt-1 text-[0.8125rem] text-slate-500">{t('acc_new_phone')}</p>
        {c.conflicts > 0 && <p className="mt-2 rounded-xl bg-slate-100 p-3 text-[0.8125rem] text-slate-600">{t('acc_conflicts', { n: c.conflicts })}</p>}
      </Card>

      <Card className="p-5">
        <h3 className="text-[1.125rem] font-bold text-slate-900">{t('acc_team')}</h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {c.members.map((m) => (
            <li key={m.email} className="flex min-h-12 items-center justify-between gap-3 py-2 text-[0.9375rem]">
              <span className="truncate text-slate-800">{m.email}</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{m.role === 'owner' ? t('acc_owner') : t('acc_member')}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-2xl bg-teal-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-teal-800">{t('acc_invite')}</div>
          <div className="mt-1 font-mono text-[1.75rem] font-bold tracking-[0.25em] text-teal-900" aria-label={t('acc_invite')}>{c.hatchery.invite_code}</div>
          <p className="mt-1 text-[0.8125rem] text-teal-900/80">{t('acc_invite_hint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => shareText(`${c.hatchery.name}: ${c.hatchery.invite_code}`)}>{t('acc_share')}</Button>
            {c.role === 'owner' && <Button variant="ghost" onClick={async () => { try { await rotateInvite() } catch (x) { setErr(x.message) } }}>{t('acc_new_code')}</Button>}
          </div>
        </div>
        <Err msg={err} />
      </Card>

      <Button variant="danger" className="w-full" onClick={() => window.confirm(t('acc_signout_confirm')) && signOut()}>{t('acc_signout')}</Button>
      {c.lastSync && <p className="text-center text-xs text-slate-400">{ago(c.lastSync)}</p>}
    </div>
  )
}

export default function Account({ store, go }) {
  const c = useCloud()
  return (
    <>
      <PageHeader title={t('acc_title')} onBack={() => go('/more')} />
      {!cloudConfigured ? <Empty title={t('acc_title')} body={t('acc_off')} />
        : !c.ready ? <p className="text-slate-500">{t('acc_loading')}</p>
        : !c.user ? <AuthForm go={go} />
        : !c.hatchery ? <Setup store={store} />
        : <Dashboard store={store} />}
    </>
  )
}
