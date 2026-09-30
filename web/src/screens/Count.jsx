import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Empty, PageHeader } from '../components/ui'
import { Camera, Upload, Check } from '../components/icons'
import { countImage, makeThumb } from '../lib/api'
import { queuePut } from '../lib/queue'
import { fmt } from '../lib/format'
import PhotoViewer from '../components/PhotoViewer'
import { tap } from '../lib/haptics'
import { evidencePut, labelPut, renderEvidence, shrinkPhoto } from '../lib/evidence'
import { buildLabel } from '../lib/labels'
import { activeTray, inside, readTrays, toPixels, withActive, withoutTray, withTray, writeTrays } from '../lib/tray'
import { SPECIES } from '../lib/counts'
import { t } from '../lib/i18n'

const spName = (x) => (x === 'Other' ? t('species_other') : x)

// Live frame checks. Thresholds are starting points: tune them on real photos from the hatchery.
const LIGHT_MIN = 90, LIGHT_MAX = 235, GLARE_MAX = 0.02, TILT_MAX = 6

// The tray the previous photo belonged to, per batch, so repeat shots of one tray can be averaged.
const lastTrayByBatch = {}

// Above roughly this many marks per photo, overlapped larvae are hidden behind each other and the reading is low
// (a stress test with known counts showed the counter still reading a few percent low there; see docs/exception-cases.md).
const CROWDED = 3500

export default function Count({ batchId, store, go }) {
  const batch = store.batches.find((b) => b.id === batchId)
  const [phase, setPhase] = useState('capture') // capture | analyzing | review
  const [cam, setCam] = useState('idle') // idle | live | denied
  const [checks, setChecks] = useState({ light: null, glare: null, level: null })
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [showMarks, setShowMarks] = useState(true)
  const [dets, setDets] = useState([])
  const [predicted, setPredicted] = useState(null)
  const [engine, setEngine] = useState(null)
  const [method, setMethod] = useState('ai')
  const [offline, setOffline] = useState(false)
  const [ms, setMs] = useState(null)
  const [note, setNote] = useState('')
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState('remove')
  const [zoom, setZoom] = useState(1)
  const [trayNorm, setTrayNorm] = useState(null) // outline of the water, fractions of the photo
  const [editTray, setEditTray] = useState(false)
  const [glare, setGlare] = useState(0)
  const [trays, setTrays] = useState(readTrays) // saved tray outlines; one per tray type or camera setup
  const [species, setSpecies] = useState(() => {
    try { return batch?.species || localStorage.getItem('shrimpcount.species') || 'Vannamei' } catch { return 'Vannamei' }
  })
  const [manualCount, setManualCount] = useState('')   // optional: the operator's own hand count, for checking accuracy
  const [otherCount, setOtherCount] = useState('')     // optional: another app's count of the same tray
  // Larger larvae (about PL13 and up) show several dark spots each and need the "large" setting. The starting choice comes from the
  // PL stage the hatchery wrote on the batch (for example "PL14"); the operator can change it, and it is saved with the count.
  const [larva, setLarva] = useState(() => { const m = /\d+/.exec(batch?.plStage || ''); return m && Number(m[0]) >= 13 ? 'large' : 'small' })
  const [larvaUsed, setLarvaUsed] = useState('small')
  const drag = useRef(null)
  const [sameTray, setSameTray] = useState(!!lastTrayByBatch[batchId])
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const svgRef = useRef(null)
  const tilt = useRef(null)
  const presetRef = useRef(null)
  const trayLive = useRef([]) // latest outline while dragging

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  // sample the live video a few times a second for light, glare and level
  useEffect(() => {
    if (cam !== 'live') return undefined
    const c = document.createElement('canvas')
    c.width = c.height = 96
    const g = c.getContext('2d', { willReadFrequently: true })
    const onTilt = (e) => { if (e.beta != null && e.gamma != null) tilt.current = { b: e.beta, g: e.gamma } }
    window.addEventListener('deviceorientation', onTilt)
    const id = setInterval(() => {
      const v = videoRef.current
      if (!v?.videoWidth) return
      const s = Math.min(v.videoWidth, v.videoHeight)
      g.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, 96, 96)
      const px = g.getImageData(0, 0, 96, 96).data
      let sum = 0, hot = 0
      for (let i = 0; i < px.length; i += 4) {
        const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
        sum += y
        if (y >= 250) hot++
      }
      const mean = sum / (px.length / 4)
      const t = tilt.current
      setChecks({
        light: mean < LIGHT_MIN ? 'dark' : mean > LIGHT_MAX ? 'bright' : 'ok',
        glare: hot / (px.length / 4) > GLARE_MAX ? 'glare' : 'ok',
        level: t ? (Math.abs(t.b) <= TILT_MAX && Math.abs(t.g) <= TILT_MAX ? 'ok' : 'tilt') : null,
      })
    }, 500)
    return () => { clearInterval(id); window.removeEventListener('deviceorientation', onTilt) }
  }, [cam])

  const trayPx = useMemo(() => (trayNorm ? toPixels(trayNorm, size.width, size.height) : null), [trayNorm, size])
  // a mark counts only inside the tray outline; a mark the operator added by hand always counts
  const inTray = useMemo(() => dets.map((d) => d.added || !trayPx || inside(trayPx, d.cx, d.cy)), [dets, trayPx])
  const count = useMemo(() => dets.filter((d, i) => !d.removed && inTray[i]).length, [dets, inTray])
  const baseline = useMemo(() => dets.filter((d, i) => !d.added && inTray[i]).length, [dets, inTray])
  const hidden = useMemo(() => dets.filter((d, i) => d.est && !d.removed && inTray[i]).length, [dets, inTray]) // estimated hidden larvae inside the outline
  const outsideN = useMemo(() => dets.filter((d, i) => !d.added && !inTray[i]).length, [dets, inTray])
  const edits = useMemo(() => ({ added: dets.filter((d) => d.added).length, removed: dets.filter((d, i) => d.removed && inTray[i]).length }), [dets, inTray])
  const medR = useMemo(() => {
    const rs = dets.filter((d) => !d.added).map((d) => d.r).sort((a, b) => a - b)
    return Math.max(rs.length ? rs[Math.floor(rs.length / 2)] : 0, size.width / 90)
  }, [dets, size.width])

  if (!batch) return <Empty title={t('b_none')} body={t('home_start_body')} action={<Button onClick={() => go('/batches')}>{t('nav_batches')}</Button>} />

  async function startCamera() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        await DeviceOrientationEvent.requestPermission().catch(() => {}) // iOS asks once, needs a tap
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 3072 } }, audio: false })
      streamRef.current = stream
      setCam('live')
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream })
    } catch { setCam('denied') }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCam('idle')
    setChecks({ light: null, glare: null, level: null })
  }

  function shoot() {
    const v = videoRef.current
    if (!v?.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob((blob) => { stopCamera(); analyse(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })) }, 'image/jpeg', 0.95)
  }

  async function analyse(f, size = larva) {
    setFile(f); setNote(''); setDets([]); setPredicted(null); setEngine(null); setOffline(false); setZoom(1); setNotes(''); setManualCount(''); setOtherCount('')
    const u = URL.createObjectURL(f)
    setUrl(u)
    const img = new Image()
    img.onload = () => setSize({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = u
    setPhase('analyzing')
    try {
      const data = await countImage(f, size)
      setLarvaUsed(size)
      setDets(data.detections.map((d) => ({ cx: (d.x1 + d.x2) / 2, cy: (d.y1 + d.y2) / 2, r: Math.max(4, (d.x2 - d.x1 + d.y2 - d.y1) / 4), added: false, removed: false, est: data.engine === 'classical' && d.confidence === 0.5 })))
      presetRef.current = data.tray_fit || data.tray_preset || null; setTrayNorm(activeTray(readTrays())?.norm || presetRef.current); setGlare(data.meta?.glare_ignored || 0); setEditTray(false)
      setPredicted(data.count); setEngine(data.engine); setMs(data.processing_ms); setMethod('ai'); setMode('remove')
    } catch (err) {
      const noNet = err instanceof TypeError || !navigator.onLine
      setMethod('manual'); setMode('add'); setOffline(noNet)
      setNote(noNet
        ? t('err_offline')
        : t('err_failed', { msg: err.message }))
    }
    setPhase('review')
  }

  function svgPoint(e) {
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    return pt.matrixTransform(svgRef.current.getScreenCTM().inverse())
  }

  function onTap(e) {
    if (mode !== 'add' || editTray || !svgRef.current) return
    const p = svgPoint(e)
    setDets((d) => [...d, { cx: p.x, cy: p.y, r: medR, added: true, removed: false }])
  }

  function onDragStart(i, ev) {
    ev.stopPropagation()
    drag.current = i
    trayLive.current = trayNorm
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId) } catch { /* not all pointers can be captured */ }
  }
  function onDragMove(ev) {
    if (drag.current == null || !svgRef.current) return
    const p = svgPoint(ev)
    const x = Math.min(1, Math.max(0, p.x / size.width)), y = Math.min(1, Math.max(0, p.y / size.height))
    const next = trayLive.current.map((q, j) => (j === drag.current ? [x, y] : q))
    trayLive.current = next
    setTrayNorm(next)
  }
  function onDragEnd() {
    if (drag.current == null) return
    drag.current = null
    persistNorm(trayLive.current)
  }
  function storeTrays(next) { writeTrays(next); setTrays(next) }
  // the corners the operator drags are saved into the selected tray (or into a new "My tray" the first time)
  function persistNorm(norm) {
    const cur = readTrays(), a = activeTray(cur)
    storeTrays(withTray(cur, a ? { ...a, norm } : { id: crypto.randomUUID(), name: 'My tray', norm }))
  }
  function showNorm(norm) { trayLive.current = norm; setTrayNorm(norm) }
  function pickTray(id) {
    const next = withActive(readTrays(), id)
    storeTrays(next)
    showNorm(activeTray(next)?.norm || presetRef.current)
  }
  function newTray() {
    const name = window.prompt(t('tray_name_prompt'), '')
    if (!name?.trim() || !trayNorm) return
    storeTrays(withTray(readTrays(), { id: crypto.randomUUID(), name: name.trim(), norm: trayNorm }))
  }
  function deleteTray() {
    const a = activeTray(readTrays())
    if (!a || !window.confirm(t('tray_delete_confirm', { name: a.name }))) return
    storeTrays(withoutTray(readTrays(), a.id))
    showNorm(presetRef.current)
  }
  function resetTray() {
    showNorm(presetRef.current)
    if (activeTray(readTrays())) persistNorm(presetRef.current)
  }

  const toggle = (i, ev) => {
    ev.stopPropagation()
    if (mode !== 'remove' || editTray || !inTray[i]) return
    setDets((d) => d.flatMap((x, j) => (j !== i ? [x] : x.added ? [] : [{ ...x, removed: !x.removed }])))
  }

  async function save(next) {
    const trayId = sameTray && lastTrayByBatch[batchId] ? lastTrayByBatch[batchId] : crypto.randomUUID()
    try { localStorage.setItem('shrimpcount.species', species) } catch { /* ignore */ }
    const num = (v) => (v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)
    let row
    try {
      const thumb = await makeThumb(url)
      row = store.addSample({ batchId, trayId, count, predicted: baseline, engine, method, notes, thumb, aiPending: offline, species, larvaSize: larvaUsed, added: edits.added, removed: edits.removed, manualCount: num(manualCount), otherCount: num(otherCount) })
    } catch {
      // the photo and every mark are still on screen untouched - the operator can just try again
      window.dispatchEvent(new CustomEvent('sc-toast', { detail: { text: t('save_failed_toast'), tone: 'error' } }))
      return
    }
    // keep the marked photo with a caption bar, so the report can show a customer exactly what was counted
    try {
      const blob = await renderEvidence({
        url, width: size.width, height: size.height, count, outline: trayPx,
        marks: dets.filter((d, i) => !d.removed && inTray[i]).map((d) => ({ cx: d.cx, cy: d.cy, r: Math.max(d.r, r), added: d.added })),
        title: `${batch.code} · ${species}`, subtitle: new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), hatchery: store.settings.hatchery,
      })
      if (blob) await evidencePut(row.id, blob)
    } catch { /* the count is saved either way */ }
    // keep the counter's marks and the person's corrections with the plain photo, for the accuracy export
    try {
      const small = await shrinkPhoto(url)
      if (small && method === 'ai') {
        const label = buildLabel({
          id: row.id, dets, inTray, outline: trayPx, width: size.width, height: size.height, scale: small.scale,
          meta: {
            batch: batch.code, pl_stage: batch.plStage || '', species, larva_size: larvaUsed, engine, counter_result: baseline, final_count: count,
            hand_count: num(manualCount), other_app_count: num(otherCount), taken: new Date().toISOString(),
          },
        })
        await labelPut(row.id, label, small.blob)
      }
    } catch { /* optional */ }
    window.dispatchEvent(new CustomEvent('sc-toast', { detail: t('saved_toast', { n: fmt(count) }) }))
    if (offline && file) await queuePut(row.id, file)
    lastTrayByBatch[batchId] = next ? trayId : null
    if (next) { setSameTray(true); setPhase('capture'); setUrl(null); setFile(null) } else go(`/batch/${batchId}`)
  }

  const r = Math.max(4, size.width / 200)
  const chipTone = (v) => (v === 'ok' ? 'bg-teal-900/80 text-teal-100' : 'bg-amber-500/90 text-slate-900')
  const chipText = {
    light: { ok: t('chip_light_ok'), dark: t('chip_dark'), bright: t('chip_bright') },
    glare: { ok: t('chip_glare_ok'), glare: t('chip_glare') },
    level: { ok: t('chip_level_ok'), tilt: t('chip_tilt') },
  }

  const flags = [
    count > CROWDED && ['amber', t('flag_crowded')],
    hidden > 0 && ['slate', t('flag_hidden', { n: hidden })],
    glare > 0 && ['slate', t('flag_glare', { n: glare })],
  ].filter(Boolean)
  const detail = [batch.tank && t('tank_n', { t: batch.tank }), batch.plStage].filter(Boolean).join(' · ')

  return (
    <>
      {phase !== 'review' && <PageHeader title={phase === 'review' ? t('count_title_review') : phase === 'analyzing' ? t('count_title_analyzing') : t('count_title_capture')} sub={`${phase === 'review' ? t('count_step2') : t('count_step1')} · ${batch.code}${detail ? ` · ${detail}` : ''}`} onBack={() => go(`/batch/${batchId}`)} />}

      {phase === 'capture' && cam !== 'live' && (
        <div className="space-y-4">
          <Card className="p-4">
            <label className="flex items-center justify-between gap-3">
              <span className="text-[0.9375rem] font-semibold">{t('shrimp_type')}</span>
              <select value={species} onChange={(e) => setSpecies(e.target.value)} className="min-h-12 rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-4 text-base font-medium">
                {SPECIES.map((x) => <option key={x} value={x}>{spName(x)}</option>)}
              </select>
            </label>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="text-[0.9375rem] font-semibold">{t('larva_size')}</div>
              <div className="mt-2 flex gap-1.5 rounded-2xl bg-slate-100 p-1.5" role="group" aria-label={t('larva_size')}>
                {[['small', t('size_small')], ['large', t('size_large')]].map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={larva === k} onClick={() => setLarva(k)}
                    className={`min-h-12 flex-1 rounded-xl px-2 text-[0.875rem] font-semibold leading-tight ${larva === k ? 'bg-surface text-teal-700' : 'text-slate-500'}`}>{l}</button>
                ))}
              </div>
              <p className="mt-2 text-[0.8125rem] leading-snug text-slate-500">{t('larva_hint')}</p>
            </div>
          </Card>

          <div className="grid gap-3">
            <button onClick={startCamera} className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-teal-700 px-5 text-lg font-semibold text-on-accent active:bg-teal-900">
              <Camera width={26} height={26} />{t('take_photo')}
            </button>
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-5 text-base font-semibold text-slate-800 active:bg-slate-100">
              <Upload width={22} height={22} />{t('choose_phone')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && analyse(e.target.files[0])} />
            </label>
          </div>
          {cam === 'denied' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">{t('camera_blocked')}</p>}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{t('good_count')}</div>
            <ul className="grid grid-cols-1 gap-2">
              {[t('check_1'), t('check_2'), t('check_3'), t('check_4')].map((c) => (
                <li key={c} className="flex items-start gap-2 rounded-xl bg-surface p-3 text-[0.8125rem] leading-snug text-slate-700">
                  <Check width={16} height={16} className="mt-0.5 shrink-0 text-teal-700" />{c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {phase === 'capture' && cam === 'live' && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-square w-[86%] max-w-md rounded-3xl border-2 border-white/85" />
            </div>
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button onClick={stopCamera} aria-label={t('cancel')} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <span className="font-display text-[0.9375rem] font-bold">{batch.code}{batch.plStage ? ` · ${batch.plStage}` : ''}</span>
              <span className="w-11" />
            </div>
            <div className="absolute inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] flex flex-wrap justify-center gap-2 px-3" aria-live="polite">
              {['light', 'glare', 'level'].filter((k) => checks[k]).map((k) => (
                <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold ${chipTone(checks[k])}`}>
                  {checks[k] === 'ok' && <Check width={15} height={15} />}{chipText[k][checks[k]]}
                </span>
              ))}
            </div>
            <p className="absolute inset-x-0 bottom-4 text-center text-[0.9375rem] font-semibold">{t('fit_tray_frame')}</p>
          </div>
          <div className="flex items-center justify-between bg-black px-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
            <label className="flex min-h-12 w-20 cursor-pointer items-center text-[0.875rem] font-medium leading-tight text-white/85">
              {t('choose_phone')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { stopCamera(); analyse(f) } }} />
            </label>
            <button onClick={shoot} aria-label={t('take_photo')} className="flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full border-4 border-white active:scale-95"><span className="h-16 w-16 rounded-full bg-surface" /></button>
            <span className="w-20" />
          </div>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="py-20 text-center" role="status">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
          <p className="mt-4 text-base font-medium text-slate-700">Counting larvae…</p>
          <p className="mt-1 text-sm text-slate-500">{t('usually_seconds')}</p>
        </div>
      )}

      {phase === 'review' && url && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black">
          <div className="flex h-14 shrink-0 items-center justify-between pl-1 pr-3 text-white">
            <button onClick={() => { setPhase('capture'); setUrl(null) }} aria-label={t('retake')} className="flex h-12 w-12 items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="font-display text-[1.0625rem] font-bold tracking-tight">{t('count_title_review')}</span>
            <span className="max-w-[9rem] truncate rounded-full bg-white/15 px-3 py-1.5 text-[0.75rem] font-semibold">{larvaUsed === 'large' ? t('size_large') : t('size_small')}</span>
          </div>
          <div className="shrink-0">
            {/* the whole photo fits in view; pinch, drag, double-tap or the buttons to look closely */}
            <div className="relative">
            <PhotoViewer src={url} width={size.width} height={size.height} alt="Sample tray" maxVh={window.innerWidth > 900 ? 56 : 42}>
              <svg ref={svgRef} viewBox={`0 0 ${size.width} ${size.height}`} onClick={onTap} onPointerMove={onDragMove} onPointerUp={onDragEnd}
                className={`absolute inset-0 h-full w-full ${mode === 'add' && !editTray ? 'cursor-crosshair' : ''}`}>
                {dets.map((d, i) => {
                  const hit = Math.max(d.r, r)               // easy to tap, even though the visible mark is small
                  // a thin ring around each larva's head with a small centre dot: the larva stays visible inside the mark
                  const ring = Math.max(hit * 0.72, size.width / 220), sw = Math.max(0.8, size.width / 1500)
                  const col = d.added ? '#f5b400' : '#ff5a36'
                  return inTray[i] ? (
                    <g key={i} onClick={(ev) => toggle(i, ev)} style={{ cursor: 'pointer' }} opacity={showMarks ? 1 : 0}>
                      <circle cx={d.cx} cy={d.cy} r={hit} fill="transparent" />
                      {d.removed
                        ? <circle cx={d.cx} cy={d.cy} r={ring} fill="none" stroke="#b8c2c5" strokeWidth={sw} strokeDasharray={`${sw * 2.5} ${sw * 2}`} />
                        : <>
                            <circle cx={d.cx} cy={d.cy} r={ring} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={sw * 2.2} />
                            <circle cx={d.cx} cy={d.cy} r={ring} fill="none" stroke={col} strokeWidth={sw * 1.4} />
                            <circle cx={d.cx} cy={d.cy} r={sw * 0.9} fill={col} />
                          </>}
                    </g>
                  ) : (
                    <circle key={i} cx={d.cx} cy={d.cy} r={ring * 0.6} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={sw} pointerEvents="none" opacity={showMarks ? 1 : 0} />
                  )
                })}
                {trayPx && (
                  <polygon points={trayPx.map((q) => q.join(',')).join(' ')} fill="none" stroke={editTray ? '#f5c451' : 'rgba(255,255,255,0.75)'}
                    strokeWidth={Math.max(2, size.width / 500)} strokeDasharray={`${size.width / 60} ${size.width / 120}`} pointerEvents="none" />
                )}
                {editTray && trayPx?.map(([x, y], i) => (
                  <g key={i} onPointerDown={(ev) => onDragStart(i, ev)} className="cursor-grab">
                    <circle cx={x} cy={y} r={size.width / 22} fill="transparent" />
                    <circle cx={x} cy={y} r={size.width / 60} fill="#f5c451" stroke="#0d2b31" strokeWidth={size.width / 400} />
                  </g>
                ))}
              </svg>
            </PhotoViewer>
            {/* see the photo without marks, to check the larvae underneath */}
            <button type="button" onClick={() => setShowMarks((v) => !v)} aria-pressed={!showMarks}
              className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur active:bg-black/80">
              {showMarks ? 'Hide marks' : 'Show marks'}
            </button>
            </div>
            <p className="py-1.5 text-center text-xs text-white/60">{t('zoom_hint')}</p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-t-2xl bg-slate-100">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-4">
              {note && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">{note}</p>}
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('final_count')}</div>
                  <div className="font-display text-[3rem] font-bold leading-none tabular-nums tracking-tight text-slate-900" aria-live="polite">{fmt(count)}</div>
                </div>
                <div className="pb-1 text-right text-[0.8125rem] leading-snug text-slate-500">
                  {method === 'ai' ? t('counter_found', { n: fmt(baseline) }) : t('manual_count')}
                  {(edits.added > 0 || edits.removed > 0) && <div className="font-semibold text-amber-700">{t('you_edits', { a: edits.added, r: edits.removed })}</div>}
                </div>
              </div>

          <div className="mt-3 flex gap-1.5 rounded-2xl bg-slate-200/70 p-1.5" role="group" aria-label="Correction mode">
            {[['remove', t('remove_mode')], ['add', t('add_mode')]].map(([k, l]) => (
              <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}
                className={`min-h-12 flex-1 rounded-xl px-2 text-[0.9375rem] font-semibold leading-tight ${mode === k ? 'bg-surface text-teal-700' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          <p className="mt-2 px-1 text-xs leading-relaxed text-slate-500">
            <span className="text-coral-600">●</span> {t('legend_counted')} &nbsp;<span className="text-amber-500">●</span> {t('legend_added')} &nbsp;<span className="text-slate-400">◌</span> {t('legend_removed')}
            {engine === 'classical' && <><br />{t('auto_count')}</>}
            {engine === 'classical' && file && (
              <><br />{larvaUsed === 'large' ? t('counted_large') : t('counted_small')}{' '}
                <button type="button" onClick={() => analyse(file, larvaUsed === 'large' ? 'small' : 'large')} className="min-h-11 font-semibold text-teal-700 underline">
                  {larvaUsed === 'large' ? t('recount_small') : t('recount_large')}
                </button></>
            )}
          </p>

          {flags.length > 0 && (
            <ul className="mt-3 space-y-2">
              {flags.map(([tone, text]) => (
                <li key={text} role={tone === 'amber' ? 'alert' : undefined} className={`rounded-xl p-3 text-[0.8125rem] leading-snug ${tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-slate-200/70 text-slate-700'}`}>{text}</li>
              ))}
            </ul>
          )}

          {trayPx && (
            <div className="mt-3 rounded-xl bg-slate-200/70 p-3 text-[0.8125rem] leading-snug text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {editTray
                    ? <>{t('outline_edit')}</>
                    : <>{t('outline_counting')}{outsideN > 0 ? <> {t('outline_outside', { n: outsideN })}</> : null}</>}
                </span>
                <button onClick={() => setEditTray((v) => !v)} className="min-h-11 shrink-0 rounded-lg bg-surface px-3 text-[0.8125rem] font-semibold text-teal-700">{editTray ? t('done') : t('adjust')}</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex items-center gap-2 text-[0.8125rem]">{t('tray')}
                  <select value={activeTray(trays)?.id || ''} onChange={(e) => pickTray(e.target.value)} className="min-h-10 rounded-lg ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-2 text-[0.8125rem]">
                    <option value="">{t('tray_fitted')}</option>
                    {trays.list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                {editTray && <>
                  <button onClick={newTray} className="min-h-10 text-[0.8125rem] font-medium text-teal-700 underline">{t('tray_save_new')}</button>
                  {activeTray(trays) && <button onClick={deleteTray} className="min-h-10 text-[0.8125rem] font-medium text-slate-500 underline">{t('delete')}</button>}
                  <button onClick={resetTray} className="min-h-10 text-[0.8125rem] font-medium text-slate-500 underline">{t('tray_fit_again')}</button>
                </>}
              </div>
            </div>
          )}

          <details className="mt-3 rounded-xl bg-surface">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-[0.9375rem] font-semibold text-slate-800">
              {t('details')}<span className="text-sm font-normal text-slate-500">{spName(species)}{notes ? ' · …' : ''}</span>
            </summary>
            <div className="space-y-3 border-t border-slate-100 p-4">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span className="font-medium">{t('shrimp_type')}</span>
                <select value={species} onChange={(e) => setSpecies(e.target.value)} className="min-h-11 rounded-lg ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3 text-[0.9375rem]">
                  {SPECIES.map((x) => <option key={x} value={x}>{spName(x)}</option>)}
                </select>
              </label>
              <label className="block text-sm text-slate-700"><span className="font-medium">{t('field_manual')}</span>
                <input type="number" inputMode="numeric" min="0" value={manualCount} onChange={(e) => setManualCount(e.target.value)} className="mt-1 min-h-14 w-full rounded-2xl bg-surface px-4 text-base ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-teal-600" /></label>
              <label className="block text-sm text-slate-700"><span className="font-medium">{t('field_other')}</span>
                <input type="number" inputMode="numeric" min="0" value={otherCount} onChange={(e) => setOtherCount(e.target.value)} className="mt-1 min-h-14 w-full rounded-2xl bg-surface px-4 text-base ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-teal-600" /></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t('notes_ph')} className="w-full rounded-xl ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-teal-600 bg-surface px-3.5 py-2.5 text-base" />
              {lastTrayByBatch[batchId] && (
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input type="checkbox" checked={sameTray} onChange={(e) => setSameTray(e.target.checked)} className="mt-0.5 h-6 w-6 accent-teal-700" />
                  <span>{t('same_tray')}</span>
                </label>
              )}
            </div>
          </details>

            </div>
            <div className="shrink-0 border-t border-white/[0.06] bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <div className="mt-3 grid grid-cols-5 gap-3">
                <button onClick={() => { tap(); save(true) }} className="col-span-2 min-h-14 rounded-2xl bg-surface text-[0.9375rem] font-semibold leading-tight text-slate-800 ring-1 ring-slate-300 active:bg-slate-100">{t('save_next').split('\n').map((l, i) => <span key={i} className="block">{l}</span>)}</button>
                <button onClick={() => { tap(14); save(false) }} className="col-span-3 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-teal-700 text-[1.125rem] font-bold text-on-accent active:bg-teal-900"><Check width={22} height={22} />{t('save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
