import type { CommandInput, CommandName, CommandResult } from './commands'
import type { BusinessMemberRole, Database } from '../types/domain'

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

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
}

export const api = {
  login: (email: string, password: string) =>
    request<SessionPayload>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (input: { email: string; password: string; firstName: string; lastName: string; phone: string }) =>
    request<SessionPayload>('/auth/register', { method: 'POST', body: input }),
  /** Resolves to `undefined` when the server version equals `since`. */
  snapshot: (since: number) => request<SnapshotPayload | undefined>(`/snapshot?since=${since}`),
  command: <K extends CommandName>(name: K, input: CommandInput<K>) =>
    request<SnapshotPayload & { result: CommandResult<K> }>(`/commands/${name}`, { method: 'POST', body: input }),
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
  }) => request<SnapshotPayload & { result: { id: number } }>('/admin/merchants', { method: 'POST', body: input }),
  identifyCustomer: (code: string) =>
    request<IdentifiedCustomer>('/customers/identify', { method: 'POST', body: { code } }),
  resetDemo: () => request<{ ok: true }>('/demo/reset', { method: 'POST' }),
}
