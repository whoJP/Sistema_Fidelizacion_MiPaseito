import { createHmac, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config.ts'

const SESSION_TTL = '12h'
const CUSTOMER_TOKEN_TTL_MS = 5 * 60 * 1000

export const hashPassword = (password: string) => bcrypt.hash(password, 10)
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

export function signSession(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: SESSION_TTL })
}

export interface AuthedRequest extends Request {
  userId: number
}

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload
    ;(req as AuthedRequest).userId = Number(payload.sub)
    next()
  } catch {
    next(new HttpError(401, 'Tu sesión expiró, vuelve a ingresar'))
  }
}

// ---------- Customer QR token: PP1.<base64url payload>.<base64url HMAC> ----------
// Alongside the QR the customer sees a 6-digit code for the same time window, so staff can type it when the camera
// can't read the screen. Both stay valid for the current window and the previous one.

const sign = (payload: string) => createHmac('sha256', config.jwtSecret).update(payload).digest('base64url')

const windowOf = (now: number) => Math.floor(now / CUSTOMER_TOKEN_TTL_MS)

function customerCode(userId: number, window: number): string {
  const digest = createHmac('sha256', config.jwtSecret).update(`code:${userId}:${window}`).digest()
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, '0')
}

export function createCustomerToken(userId: number, now = Date.now()) {
  const window = windowOf(now)
  const expiresAt = (window + 1) * CUSTOMER_TOKEN_TTL_MS
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: expiresAt + CUSTOMER_TOKEN_TTL_MS })).toString('base64url')
  return {
    token: `PP1.${payload}.${sign(payload)}`,
    code: customerCode(userId, window),
    expiresAt: new Date(expiresAt).toISOString(),
  }
}

export const isCustomerCode = (value: string) => /^\d{6}$/.test(value.replace(/[\s-]/g, ''))

/** Customer ids whose current (or previous) 6-digit code equals `value`. */
export function matchCustomerCode(value: string, userIds: number[], now = Date.now()): number[] {
  const code = value.replace(/[\s-]/g, '')
  const window = windowOf(now)
  return userIds.filter((id) => customerCode(id, window) === code || customerCode(id, window - 1) === code)
}

export function readCustomerToken(token: string, now = Date.now()): number {
  const [prefix, payload, signature] = token.trim().split('.')
  if (prefix !== 'PP1' || !payload || !signature) {
    throw new HttpError(422, 'Código no válido. Escanea el QR del cliente o escribe los 6 números de su tarjeta.')
  }
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new HttpError(422, 'Este QR no es de Paseo Club')
  }
  const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: number; exp: number }
  if (exp < now) throw new HttpError(422, 'El código del cliente expiró, pídele que lo actualice')
  return u
}
