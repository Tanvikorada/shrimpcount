import { useCallback, useEffect, useRef, useState } from 'react'

const MAX = 8
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * A photo you can look at closely: pinch to zoom, drag to move, wheel on a computer, and plus / minus / fit buttons.
 * (No double-tap zoom: a tap on the photo adds or removes a mark, and a stray double-tap must not change the count.) The whole photo fits the box at the start. Zoom goes toward the fingers, not the corner.
 * Children (the marks) are drawn on top and move and scale with the photo. A drag never counts as a tap on a mark.
 */
export default function PhotoViewer({ src, width, height, alt = '', maxVh = 58, children }) {
  const box = useRef(null)
  const [W, setW] = useState(320)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const pts = useRef(new Map())
  const last = useRef(null)          // previous pinch / drag state
  const moved = useRef(false)
  const start = useRef({ x: 0, y: 0 })

  const aspect = width / height
  const H = Math.min(W / aspect, (window.innerHeight * maxVh) / 100)
  const fitW = Math.min(W, H * aspect)
  const fitH = fitW / aspect

  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => setW(el.clientWidth || 320))
    ro.observe(el)
    setW(el.clientWidth || 320)
    return () => ro.disconnect()
  }, [])

  const limit = useCallback((v) => {
    const mx = Math.max(0, (fitW * v.k - W) / 2), my = Math.max(0, (fitH * v.k - H) / 2)
    return { k: v.k, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) }
  }, [fitW, fitH, W, H])

  // zoom to k2 keeping the photo point under (fx, fy), given relative to the box centre, where it is
  const zoomAt = useCallback((k2, fx, fy) => {
    setView((v) => {
      const k = clamp(k2, 1, MAX)
      const r = k / v.k
      return limit({ k, x: fx - (fx - v.x) * r, y: fy - (fy - v.y) * r })
    })
  }, [limit])

  const rel = (e) => {
    const r = box.current.getBoundingClientRect()
    return { x: e.clientX - r.left - W / 2, y: e.clientY - r.top - H / 2 }
  }

  const onDown = (e) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 1) { start.current = { x: e.clientX, y: e.clientY }; moved.current = false }
    last.current = null
  }
  const onMove = (e) => {
    if (!pts.current.has(e.pointerId)) return
    const prev = pts.current.get(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const list = [...pts.current.values()]
    if (list.length === 2) {                                   // pinch
      const [a, b] = list
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (last.current?.d) {
        const r = box.current.getBoundingClientRect()
        const fx = c.x - r.left - W / 2, fy = c.y - r.top - H / 2
        setView((v) => {
          const k = clamp(v.k * (d / last.current.d), 1, MAX), s = k / v.k
          return limit({ k, x: fx - (fx - v.x) * s + (c.x - last.current.c.x), y: fy - (fy - v.y) * s + (c.y - last.current.c.y) })
        })
      }
      last.current = { d, c }
      moved.current = true
    } else if (list.length === 1) {                            // drag
      const st = start.current
      if (!moved.current && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 6) moved.current = true
      if (moved.current) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y
        setView((v) => (v.k > 1 ? limit({ ...v, x: v.x + dx, y: v.y + dy }) : v))
      }
    }
  }
  const onUp = (e) => {
    pts.current.delete(e.pointerId)
    last.current = null
  }
  const onWheel = (e) => {
    const p = rel(e)
    zoomAt(view.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2), p.x, p.y)
  }
  // a drag or pinch must not also press a mark underneath
  const onClickCapture = (e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false } }

  const btn = 'flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-2xl font-medium leading-none text-white backdrop-blur active:bg-black/75'
  return (
    <div className="relative">
      <div ref={box} className="relative w-full select-none overflow-hidden bg-black" style={{ height: H, touchAction: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} onClickCapture={onClickCapture}>
        {/* zoom by laying the photo out bigger (not by scaling a flat picture), so it stays sharp at every zoom */}
        <div className="absolute" style={{ width: fitW * view.k, height: fitH * view.k, left: (W - fitW * view.k) / 2, top: (H - fitH * view.k) / 2, transform: `translate(${view.x}px, ${view.y}px)` }}>
          <img src={src} alt={alt} draggable={false} decoding="async" className="block h-full w-full" style={{ imageRendering: 'auto' }} />
          {children}
        </div>
      </div>
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <button type="button" aria-label="Zoom in" className={btn} onClick={() => zoomAt(view.k * 1.6, 0, 0)}>+</button>
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => zoomAt(view.k / 1.6, 0, 0)}>−</button>
        {view.k > 1.01 && <button type="button" aria-label="Show the whole photo" className={`${btn} text-xs font-semibold`} onClick={() => setView({ k: 1, x: 0, y: 0 })}>Fit</button>}
      </div>
      {view.k > 1.01 && <div className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">{view.k.toFixed(1)}×</div>}
    </div>
  )
}
