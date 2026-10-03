import type { CommandInput, CommandName, CommandResult } from './commands'
import type { BusinessMemberRole, Database } from '../types/domain'
import type { TierGap } from '../domain/engagement'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let token: string | null = null
let onUnauthorized: () => void = () => {}

export function setApiToken(value: string | null) {
  token = value
}

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function request<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }
  if (response.status === 204) return undefined as T
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized()
    throw new ApiError(response.status, data.error ?? `Error ${response.status}`)
  }
  return data as T
}

// ---------- Idempotent writes ----------

const INTENT_TTL_MS = 10 * 60_000
const intents = new Map<string, { key: string; at: number }>()

/** `crypto.randomUUID` needs a secure context; the phone may open the app over plain http on the LAN. */
const newKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

/** Short hash of the request so a large body (the ID photo) is not kept as a map key. */
function fingerprint(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}-${text.length}`
}

/**
 * POST with an `Idempotency-Key`. Retrying the same request while its outcome is unknown (no answer, server error
 * or still in flight, e.g. a double tap) reuses the key, so the server applies it once. After a definite answer the
 * next identical request is a new action and gets a new key.
 */
async function idempotentPost<T>(path: string, body: unknown): Promise<T> {
  const now = Date.now()
  for (const [id, intent] of intents) if (now - intent.at > INTENT_TTL_MS) intents.delete(id)
  const id = fingerprint(`${path}\n${JSON.stringify(body)}`)
  const intent = intents.get(id) ?? { key: newKey(), at: now }
  intents.set(id, intent)
  try {
    const data = await request<T>(path, { method: 'POST', body, idempotencyKey: intent.key })
    intents.delete(id)
    return data
  } catch (err) {
    if (err instanceof ApiError && err.status > 0 && err.status < 500) intents.delete(id)
    throw err
  }
}

export interface SessionPayload {
  token: string
  userId: number
}

export interface SnapshotPayload {
  version: number
  db: Database
}

export interface IdentifiedCustomer {
  id: number
  firstName: string
  lastName: string
  email: string
  nextTier: TierGap | null
  birthdayToday: boolean
}

export const api = {
  login: (email: string, password: string) =>
    request<SessionPayload>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (input: { email: string; password: string; firstName: string; lastName: string; phone: string }) =>
    request<SessionPayload>('/auth/register', { method: 'POST', body: input }),
  /** Resolves to `undefined` when the server version equals `since`. */
  snapshot: (since: number) => request<SnapshotPayload | undefined>(`/snapshot?since=${since}`),
  command: <K extends CommandName>(name: K, input: CommandInput<K>) =>
    idempotentPost<SnapshotPayload & { result: CommandResult<K> }>(`/commands/${name}`, input),
  qrToken: () => request<{ token: string; code: string; expiresAt: string }>('/me/qr-token'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/me/password', { method: 'POST', body: { currentPassword, newPassword } }),
  createMerchant: (input: {
    email: string
    password: string
    firstName: string
    lastName: string
    phone: string
    businessId: number
    role: BusinessMemberRole
  }) => idempotentPost<SnapshotPayload & { result: { id: number } }>('/admin/merchants', input),
  identifyCustomer: (code: string) =>
    request<IdentifiedCustomer>('/customers/identify', { method: 'POST', body: { code } }),
  /** `photo` is a `data:image/...;base64,` URL of the ID card. */
  submitKyc: (birthDate: string, photo: string) =>
    idempotentPost<SnapshotPayload & { result: true }>('/me/kyc', { birthDate, photo }),
  /** Object URL of the ID photo of a pending verification (admin only). Revoke it when done. */
  kycDocumentUrl: async (requestId: number) => {
    let response: Response
    try {
      response = await fetch(`/api/admin/kyc/${requestId}/document`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor')
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      throw new ApiError(response.status, data.error ?? `Error ${response.status}`)
    }
    return URL.createObjectURL(await response.blob())
  },
  resetDemo: () => request<{ ok: true }>('/demo/reset', { method: 'POST' }),
}
