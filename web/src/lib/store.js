import { useEffect, useState, useCallback } from 'react'
import { applyPlan } from './cloudEngine'

const KEY = 'shrimpcount.v2'
const empty = { settings: { hatchery: '', operator: '', ranges: {} }, batches: [], samples: [], events: [], orders: [], water: [], inventory: [], tasks: [], quality: [], tests: [], prices: [], growth: [] }

function load() {
  try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return empty }
}

let state = load()
const listeners = new Set()

function commit(next) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l())
}

export function useStore() {
  const [, tick] = useState(0)
  useEffect(() => {
    const l = () => tick((n) => n + 1)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  const addBatch = useCallback((b) => {
    const batch = { id: crypto.randomUUID(), status: 'active', createdAt: new Date().toISOString(), ...b }
    commit({ ...state, batches: [batch, ...state.batches] })
    return batch
  }, [])
  const updateBatch = useCallback((id, patch) =>
    commit({ ...state, batches: state.batches.map((b) => (b.id === id ? { ...b, ...patch } : b)) }), [])
  const deleteBatch = useCallback((id) =>
    commit({ ...state, batches: state.batches.filter((b) => b.id !== id), samples: state.samples.filter((s) => s.batchId !== id), events: state.events.filter((e) => e.batchId !== id), quality: state.quality.filter((e) => e.batchId !== id), tests: state.tests.filter((e) => e.batchId !== id), growth: state.growth.filter((e) => e.batchId !== id) }), [])
  const addSample = useCallback((s) => {
    const row = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...s }
    commit({ ...state, samples: [row, ...state.samples] })
    return row
  }, [])
  const deleteSample = useCallback((id) => commit({ ...state, samples: state.samples.filter((s) => s.id !== id) }), [])
  const addEvent = useCallback((e) =>
    commit({ ...state, events: [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...e }, ...state.events] }), [])
  const deleteEvent = useCallback((id) => commit({ ...state, events: state.events.filter((e) => e.id !== id) }), [])
  const addOrder = useCallback((o) => {
    const order = { id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString(), ...o }
    commit({ ...state, orders: [order, ...state.orders] })
    return order
  }, [])
  const updateOrder = useCallback((id, patch) =>
    commit({ ...state, orders: state.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), [])
  const deleteOrder = useCallback((id) => commit({ ...state, orders: state.orders.filter((o) => o.id !== id) }), [])
  const addItem = useCallback((col, item) => {
    const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...item }
    commit({ ...state, [col]: [row, ...state[col]] })
    return row
  }, [])
  const patchItem = useCallback((col, id, patch) =>
    commit({ ...state, [col]: state[col].map((r) => (r.id === id ? { ...r, ...patch } : r)) }), [])
  const removeItem = useCallback((col, id) => commit({ ...state, [col]: state[col].filter((r) => r.id !== id) }), [])
  const restore = useCallback((data) => commit({ ...empty, ...data, settings: { ...empty.settings, ...(data.settings || {}) } }), [])
  const setSettings = useCallback((p) => commit({ ...state, settings: { ...state.settings, ...p } }), [])
  return { ...state, addBatch, updateBatch, deleteBatch, addSample, deleteSample, addEvent, deleteEvent, addOrder, updateOrder, deleteOrder, addItem, patchItem, removeItem, restore, setSettings }
}

export const snapshot = () => JSON.stringify(state, null, 1)

// For the cloud sync: read the current state, apply changes downloaded from the team's cloud, and hear about local changes.
export const getState = () => state
export const applyRemote = (plan) => commit(applyPlan(state, plan))
export const subscribeStore = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

export { batchStats } from './stats'
