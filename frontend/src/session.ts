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
  workplaces: Workplace[]
}

export function useSession(): Session {
  const current = useSyncExternalStore(subscribe, () => session)
  const db = useDbOrNull()
  if (!current) return { loading: false, user: null, workplaces: [] }
  if (!db) return { loading: true, user: null, workplaces: [] }
  const user = db.users.find((u) => u.id === current.userId && u.deletedAt === null && u.status === 'ACTIVE') ?? null
  const workplaces = user
    ? db.businessMembers
        .filter((m) => m.userId === user.id && m.status === 'ACTIVE')
        .flatMap((membership) => {
          const business = db.businesses.find((b) => b.id === membership.businessId && b.deletedAt === null)
          return business ? [{ membership, business }] : []
        })
    : []
  return { loading: false, user, workplaces }
}

/** For components rendered inside authenticated layouts. */
export function useUser(): User {
  const { user } = useSession()
  if (!user) throw new Error('useUser called without a signed-in user')
  return user
}
