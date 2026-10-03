import { useSyncExternalStore } from 'react'
import { setApiToken, setUnauthorizedHandler, type SessionPayload } from './data/api'
import { startSync, stopSync, useDbOrNull } from './data/store'
import type { Business, BusinessMember, User } from './types/domain'

const KEY = 'paseo-points:session:v2'

function readStored(): SessionPayload | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SessionPayload) : null
  } catch {
    return null
  }
}

let session: SessionPayload | null = readStored()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

setApiToken(session?.token ?? null)
setUnauthorizedHandler(() => signOut())
if (session) startSync()

export function signIn(payload: SessionPayload) {
  session = payload
  localStorage.setItem(KEY, JSON.stringify(payload))
  setApiToken(payload.token)
  stopSync()
  startSync()
  emit()
}

export function signOut() {
  session = null
  localStorage.removeItem(KEY)
  setApiToken(null)
  stopSync()
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export interface Workplace {
  membership: BusinessMember
  business: Business
}

export interface Session {
  /** Signed in but the first snapshot hasn't arrived yet. */
  loading: boolean
  user: User | null
  /** The business a MERCHANT account works at; null for customers, admins and unassigned staff. */
  workplace: Workplace | null
}

export function useSession(): Session {
  const current = useSyncExternalStore(subscribe, () => session)
  const db = useDbOrNull()
  if (!current) return { loading: false, user: null, workplace: null }
  if (!db) return { loading: true, user: null, workplace: null }
  const user = db.users.find((u) => u.id === current.userId && u.deletedAt === null && u.status === 'ACTIVE') ?? null
  const membership =
    user?.role === 'MERCHANT' ? db.businessMembers.find((m) => m.userId === user.id && m.status === 'ACTIVE') : undefined
  const business = membership && db.businesses.find((b) => b.id === membership.businessId && b.deletedAt === null)
  return { loading: false, user, workplace: membership && business ? { membership, business } : null }
}

/** For components rendered inside authenticated layouts. */
export function useUser(): User {
  const { user } = useSession()
  if (!user) throw new Error('useUser called without a signed-in user')
  return user
}
