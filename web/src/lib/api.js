export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Serverless hosts reject large request bodies (Vercel: 4.5 MB). Phone photos are bigger, so the copy sent for
// counting is shrunk. The original file is what gets stored and queued; detections are mapped back to its size.
const MAX_UPLOAD = 3.5 * 1024 * 1024
const STEPS = [2560, 2048, 1600, 1280]

async function shrink(file) {
  if (file.size <= MAX_UPLOAD) return { blob: file, scale: 1, width: null }
  const bmp = await createImageBitmap(file)
  const { width: W, height: H } = bmp
  for (const side of STEPS) {
    const k = Math.min(1, side / Math.max(W, H))
    const c = document.createElement('canvas')
    c.width = Math.round(W * k); c.height = Math.round(H * k)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
    if (blob && blob.size <= MAX_UPLOAD) { bmp.close?.(); return { blob, scale: W / c.width, width: W, height: H } }
  }
  bmp.close?.()
  throw new Error('Photo is too large to send. Try a lower camera resolution.')
}

export async function countImage(file, size = 'small') {
  const { blob, scale, width, height } = await shrink(file)
  const body = new FormData()
  body.append('file', blob, file.name || 'sample.jpg')
  const res = await fetch(`${API}/count?size=${size}`, { method: 'POST', body })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Server error ${res.status}`)
  const data = await res.json()
  if (scale !== 1) {
    data.detections = data.detections.map((d) => ({ ...d, x1: d.x1 * scale, y1: d.y1 * scale, x2: d.x2 * scale, y2: d.y2 * scale }))
    data.image_size = { width, height }
  }
  return data
}

export function makeThumb(url, width = 360) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = width
      c.height = Math.round((img.naturalHeight / img.naturalWidth) * width)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.6))
    }
    img.onerror = () => resolve('')
    img.src = url
  })
}
