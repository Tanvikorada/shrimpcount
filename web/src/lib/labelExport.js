// Build and download the "corrected marks" file from what is stored on this phone.
import { labelGet, labelIds } from './evidence'
import { makeZip } from './labels'

export const countLabels = () => labelIds().then((k) => k.length).catch(() => 0)

export async function exportLabels() {
  const ids = await labelIds()
  const enc = new TextEncoder()
  const files = []
  const rows = ['id,batch,pl_stage,species,larva_size,counter_result,final_count,hand_count,other_app_count,marks_added,marks_removed']
  for (const id of ids) {
    const { label, photo } = await labelGet(id)
    if (!label || !photo) continue
    files.push({ name: `labels/${id}.json`, data: enc.encode(JSON.stringify(label)) })
    files.push({ name: label.photo, data: new Uint8Array(await photo.arrayBuffer()) })
    const add = label.marks.filter((m) => m.status === 'added').length, rem = label.marks.filter((m) => m.status === 'removed').length
    rows.push([id, label.batch, label.pl_stage, label.species, label.larva_size, label.counter_result, label.final_count, label.hand_count ?? '', label.other_app_count ?? '', add, rem].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
  }
  if (!files.length) return 0
  files.push({ name: 'summary.csv', data: enc.encode(rows.join('\n')) })
  const zip = makeZip(files)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  a.download = `shrimpcount-marks-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return files.length / 2 | 0
}
