import { useEffect, useState } from 'react'
import { useStore } from './lib/store'
import { flushQueue } from './lib/sync'
import { applyTextSize, tap } from './lib/haptics'
import { detectLang, setLang, t } from './lib/i18n'
import LanguageSheet from './components/LanguageSheet'
import Home from './screens/Home'
import { BatchList, NewBatch } from './screens/Batches'
import BatchDetail from './screens/BatchDetail'
import Count from './screens/Count'
import Report from './screens/Report'
import Settings from './screens/Settings'
import { OrderList, NewOrder } from './screens/Orders'
import OrderDetail from './screens/OrderDetail'
import Trace from './screens/Trace'
import Prices from './screens/Prices'
import Growth from './screens/Growth'
import More from './screens/More'
import Counts from './screens/Counts'
import Account from './screens/Account'
import { initCloud, useCloud } from './lib/cloud'
import Landing from './screens/Landing'
import { AuthPage, SetupPage } from './screens/Auth'
import Access from './screens/Access'
import Admin from './screens/Admin'
import { hasEntered, isInstalledApp } from './lib/entry'
import Tools from './screens/Tools'
import Water from './screens/Water'
import Inventory from './screens/Inventory'
import Tasks from './screens/Tasks'
import { Home as HomeIcon, Layers, Camera, Cart, More as MoreIcon } from './components/icons'

// the home-screen shortcut: straight to counting in the first active batch, or to making one
function Quick({ store, go }) {
  useEffect(() => {
    const b = store.batches.find((x) => x.status === 'active')
    go(b ? `/count/${b.id}` : '/batches/new')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

const path = () => window.location.hash.replace(/^#/, '') || '/'
const go = (p) => { window.location.hash = p }

export default function App() {
  const store = useStore()
  const [online, setOnline] = useState(navigator.onLine)
  const [updated, setUpdated] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [toast, setToast] = useState('')
  const cloud = useCloud()
  const entered = hasEntered(store, cloud)
  const firstRun = !store.settings.language && entered
  setLang(store.settings.language || detectLang())          // before anything draws, so every screen reads the chosen language
  useEffect(() => { document.documentElement.lang = store.settings.language || detectLang() }, [store.settings.language])
  useEffect(() => {
    let timer
    const on = (e) => { setToast(e.detail); clearTimeout(timer); timer = setTimeout(() => setToast(''), 2600) }
    window.addEventListener('sc-toast', on)
    return () => { window.removeEventListener('sc-toast', on); clearTimeout(timer) }
  }, [])
  useEffect(() => { applyTextSize(store.settings.textSize) }, [store.settings.textSize])
  useEffect(() => { initCloud() }, []) // accounts and backup, when switched on
  useEffect(() => {
    const on = () => setUpdated(true)
    window.addEventListener('sc-updated', on)
    return () => window.removeEventListener('sc-updated', on)
  }, [])
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const [route, setRoute] = useState(path())
  useEffect(() => {
    const run = () => { if (navigator.onLine) flushQueue(store) }
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const on = () => { setRoute(path()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const [, a, b] = route.split('/')
  const active = store.batches.filter((x) => x.status === 'active')
  const countTarget = active[0]?.id
  const installed = isInstalledApp()

  // A plain browser tab is the shop window, nothing more: it shows the landing page and points people at installing the
  // app - real use (including the free trial) only starts once they have. The owner's own two unlinked pages are the one
  // exception, since managing the hatchery account from a phone home screen is not the point of them.
  const OWNER_ONLY = ['new-account', 'admin']
  if (!installed && !OWNER_ONLY.includes(a)) {
    return <div className="page-in"><Landing store={store} entered={entered} installed={false} /></div>
  }

  // the front door: landing page, sign in, sign up, and hatchery set-up. Nobody with records or an account is sent here by accident.
  const FRONT = ['welcome', 'login', 'signup', 'setup', 'new-account', 'admin']
  if (FRONT.includes(a) || !entered) {
    // self-serve sign-up is not offered publicly (see lib/demo.js): "/signup" is where a link to it lands people instead.
    // "/new-account" and "/admin" are not linked from any button anywhere - only ever reached by typing the URL directly.
    // "/new-account" lets the owner make their own unlimited account (they set their own password; nobody types it for
    // them). "/admin" is the owner's dashboard; the database's own rules, not this routing, are what actually keep
    // anyone else out (see supabase/admin.sql) - it also works before "entered" so a fresh browser can reach it.
    const page = a === 'login' ? <AuthPage mode="in" /> : a === 'new-account' ? <AuthPage mode="signup" /> : a === 'admin' ? <Admin go={go} />
      : a === 'signup' ? <Access store={store} go={go} /> : a === 'setup' ? <SetupPage store={store} />
      : <Landing store={store} entered={entered} installed={installed} />
    return <div className="page-in">{page}</div>
  }

  let view
  if (route === '/') view = <Home store={store} go={go} openLang={() => setLangOpen(true)} />
  else if (a === 'batches' && b === 'new') view = <NewBatch store={store} go={go} />
  else if (a === 'batches') view = <BatchList store={store} go={go} />
  else if (a === 'batch') view = <BatchDetail id={b} store={store} go={go} />
  else if (a === 'count') view = <Count key={b} batchId={b} store={store} go={go} />
  else if (a === 'report') view = <Report id={b} store={store} go={go} />
  else if (a === 'orders' && b === 'new') view = <NewOrder store={store} go={go} />
  else if (a === 'orders') view = <OrderList store={store} go={go} />
  else if (a === 'order') view = <OrderDetail id={b} store={store} go={go} />
  else if (a === 'trace') view = <Trace id={b} store={store} go={go} />
  else if (a === 'prices') view = <Prices store={store} go={go} />
  else if (a === 'growth') view = <Growth store={store} go={go} />
  else if (a === 'quick') view = <Quick store={store} go={go} />
  else if (a === 'account') view = <Account store={store} go={go} />
  else if (a === 'access') view = <Access store={store} go={go} />
  else if (a === 'counts') view = <Counts store={store} go={go} />
  else if (a === 'more') view = <More store={store} go={go} />
  else if (a === 'tools') view = <Tools go={go} />
  else if (a === 'water') view = <Water store={store} go={go} />
  else if (a === 'inventory') view = <Inventory store={store} go={go} />
  else if (a === 'tasks') view = <Tasks store={store} go={go} />
  else if (a === 'settings') view = <Settings store={store} go={go} openLang={() => setLangOpen(true)} />
  else view = <Home store={store} go={go} />

  const tab = (to, label, Icon, on) => (
    <button onClick={() => { tap(); go(to) }} aria-current={on ? 'page' : undefined}
      className={`group relative flex min-h-[3.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 pt-1 text-[0.6875rem] font-medium tracking-[0.01em] ${on ? 'text-slate-900' : 'text-slate-400'}`}>
      <span className={`absolute inset-x-4 top-0 h-[2px] bg-teal-700 transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      <Icon width={22} height={22} strokeWidth={on ? 2 : 1.6} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  )

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      {!online && (
        <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-white/[0.09] bg-amber-50 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-[0.8125rem] font-medium text-amber-900">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{t('offline_banner')}
        </div>
      )}
      {updated && (
        <button onClick={() => window.location.reload()} className="sticky top-0 z-40 flex w-full items-center justify-center gap-2 border-b border-white/[0.09] bg-slate-900 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-center text-[0.875rem] font-medium text-on-accent">
          {t('updated_banner')}
        </button>
      )}
      <main key={route} className="page-in mx-auto max-w-2xl px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))]">{view}</main>
      {toast && (
        <div role="status" className="page-in fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex w-fit max-w-[92vw] items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-[0.9375rem] font-medium text-on-accent">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-good-500"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></span>{toast}
        </div>
      )}
      {(firstRun || langOpen) && (
        <LanguageSheet onClose={firstRun ? undefined : () => setLangOpen(false)}
          onPick={(code) => { store.setSettings({ language: code }); setLang(code); setLangOpen(false) }} />
      )}
      {a !== 'count' && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.09] bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden" aria-label="Main">
          <div className="mx-auto flex max-w-2xl items-stretch px-2 pt-2">
            {tab('/', t('nav_home'), HomeIcon, route === '/')}
            {tab('/batches', t('nav_batches'), Layers, a === 'batches' || a === 'batch' || a === 'report' || a === 'trace')}
            {tab('/orders', t('nav_orders'), Cart, a === 'orders' || a === 'order')}
            {tab('/more', t('nav_more'), MoreIcon, ['more', 'tools', 'water', 'inventory', 'tasks', 'settings', 'prices', 'growth', 'counts', 'account'].includes(a))}
          </div>
        </nav>
      )}
    </div>
  )
}
