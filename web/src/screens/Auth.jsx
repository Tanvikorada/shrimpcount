import { useEffect, useState } from 'react'
import { friendly } from './Account'
import { cloudConfigured, createHatchery, joinHatchery, signIn, signUp, useCloud } from '../lib/cloud'
import { markEntered } from '../lib/entry'
import { t } from '../lib/i18n'
import Logo from '../components/Logo'

const go = (p) => { window.location.hash = p }
const input = 'mt-1.5 min-h-14 w-full rounded-2xl bg-surface px-4 text-base text-slate-900 ring-1 ring-white/10 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-teal-600'
const primary = 'min-h-14 w-full rounded-2xl bg-slate-900 px-5 text-[1.0625rem] font-semibold text-on-accent active:bg-slate-700 disabled:opacity-60'
const link = 'min-h-12 w-full text-[0.9375rem] font-semibold text-teal-800'

// The front-door frame: one hairline card on paper, nothing else to look at.
function Frame({ title, sub, children }) {
  return (
    <div className="min-h-dvh bg-slate-100 px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-md">
        <a href="#/welcome" className="flex items-center gap-2.5 py-2 text-slate-900"><Logo size={30} /><span className="font-display text-[1.0625rem] font-semibold tracking-tight">ShrimpCount</span></a>
        <div className="mt-6 rounded-3xl bg-surface p-6 ring-1 ring-white/[0.09]">
          <div className="mb-3 flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500"><span className="h-2 w-2 bg-aqua-400" />ShrimpCount</div>
          <h1 className="font-display text-[1.75rem] font-medium leading-tight tracking-[-0.03em] text-slate-900">{title}</h1>
          {sub && <p className="mt-1.5 text-[0.9375rem] leading-snug text-slate-600">{sub}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

const Err = ({ msg }) => (msg ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{friendly(msg)}</p> : null)

function LocalOnly() {
  return (
    <div className="mt-2 border-t border-slate-100 pt-3 text-center">
      <button onClick={() => { markEntered(); go('/setup') }} className={link}>{t('au_local')}</button>
      <p className="text-[0.8125rem] text-slate-500">{t('au_local_note')}</p>
    </div>
  )
}

export function AuthPage({ mode }) {
  const c = useCloud()
  const signup = mode === 'signup'
  const [f, setF] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => { if (!cloudConfigured) go('/setup') }, [])
  useEffect(() => { if (c.user) { markEntered(); go(c.hatchery ? '/' : '/setup') } }, [c.user, c.hatchery])
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(''); setNote('')
    try {
      if (signup) { const r = await signUp(f.email, f.password); if (r.needsConfirm) { setNote(t('acc_confirm_mail')); return } }
      else await signIn(f.email, f.password)
      markEntered(); go('/setup')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Frame title={signup ? t('au_up_h') : t('au_in_h')} sub={signup ? t('au_up_sub') : t('au_in_sub')}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('acc_email')}</span>
          <input type="email" required autoComplete="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
        <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('au_password')}</span>
          <input type="password" required minLength={6} autoComplete={signup ? 'new-password' : 'current-password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={input} /></label>
        <button className={primary} disabled={busy}>{signup ? t('acc_signup') : t('acc_signin')}</button>
      </form>
      {note && <p role="status" className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">{note}</p>}
      <Err msg={err} />
      <button onClick={() => go(signup ? '/login' : '/signup')} className={`${link} mt-3`}>{signup ? t('acc_have') : t('acc_new')}</button>
      <LocalOnly />
    </Frame>
  )
}

// Step two: name the hatchery (shown on every report). With an account: start a team or join one with an invite code.
export function SetupPage({ store }) {
  const c = useCloud()
  const [name, setName] = useState(store.settings.hatchery || '')
  const [you, setYou] = useState(store.settings.operator || '')
  const [code, setCode] = useState('')
  const [tab, setTab] = useState('create')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const account = cloudConfigured && c.ready && !!c.user
  useEffect(() => { if (account && c.hatchery) { markEntered(); go('/') } }, [account, c.hatchery])
  const finish = () => { markEntered(); go('/') }
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      if (account && tab === 'join') await joinHatchery(code)
      else {
        store.setSettings({ hatchery: name.trim(), operator: you.trim() })
        if (account) await createHatchery(name.trim())
      }
      finish()
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <Frame title={t('su_h')} sub={t('su_sub')}>
      {account && (
        <div className="mb-4 flex gap-1.5 rounded-2xl bg-slate-100 p-1.5" role="group">
          {[['create', t('acc_create_h')], ['join', t('acc_join_h')]].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}
              className={`min-h-12 flex-1 rounded-xl px-2 text-[0.9375rem] font-semibold leading-tight ${tab === k ? 'bg-surface text-teal-800' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        {account && tab === 'join' ? (
          <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('acc_code')}</span>
            <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck="false" className={`${input} font-mono tracking-widest`} /></label>
        ) : (
          <>
            <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('su_name')}</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
            <label className="block"><span className="text-[0.9375rem] font-semibold text-slate-800">{t('su_you')}</span>
              <input value={you} onChange={(e) => setYou(e.target.value)} autoComplete="name" className={input} /></label>
          </>
        )}
        <button className={primary} disabled={busy}>{account && tab === 'join' ? t('acc_join_btn') : t('su_start')}</button>
      </form>
      <Err msg={err} />
      <button onClick={finish} className={`${link} mt-3`}>{t('su_skip')}</button>
    </Frame>
  )
}
