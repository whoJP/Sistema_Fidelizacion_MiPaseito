import { useSyncExternalStore } from 'react'
import type { Database } from '../types/domain'
import { api } from './api'

const POLL_INTERVAL_MS = 4000

type Listener = () => void

let db: Database | null = null
let version = -1
const listeners = new Set<Listener>()
let poller: ReturnType<typeof setInterval> | null = null

function emit() {
  listeners.forEach((l) => l())
}

/** Replaces the local copy with a snapshot returned by the API. */
export function applySnapshot(nextVersion: number, next: Database) {
  version = nextVersion
  db = next
  emit()
}

export async function refresh() {
  const payload = await api.snapshot(version)
  if (payload) applySnapshot(payload.version, payload.db)
}

/** Polls the API so changes made by other users (e.g. the cashier) show up without reloading. */
export function startSync() {
  if (poller) return
  void refresh().catch(() => undefined)
  poller = setInterval(() => {
    if (document.visibilityState === 'visible') void refresh().catch(() => undefined)
  }, POLL_INTERVAL_MS)
}

export function stopSync() {
  if (poller) clearInterval(poller)
  poller = null
  db = null
  version = -1
  emit()
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDb(): Database {
  if (!db) throw new Error('Database snapshot not loaded yet')
  return db
}

export function useDbOrNull(): Database | null {
  return useSyncExternalStore(subscribe, () => db)
}

/** For components rendered after the snapshot has loaded (inside the authenticated layout). */
export function useDb(): Database {
  const current = useDbOrNull()
  if (!current) throw new Error('useDb called before the snapshot loaded')
  return current
}
