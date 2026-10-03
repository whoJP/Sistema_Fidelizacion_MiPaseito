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

const sign = (payload: string) => createHmac('sha256', config.jwtSecret).update(payload).digest('base64url')

export function createCustomerToken(userId: number, now = Date.now()) {
  const expiresAt = now + CUSTOMER_TOKEN_TTL_MS
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: expiresAt })).toString('base64url')
  return { token: `PP1.${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt).toISOString() }
}

export function readCustomerToken(token: string, now = Date.now()): number {
  const [prefix, payload, signature] = token.trim().split('.')
  if (prefix !== 'PP1' || !payload || !signature) throw new HttpError(422, 'Código de cliente inválido')
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new HttpError(422, 'Firma del código inválida')
  }
  const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { u: number; exp: number }
  if (exp < now) throw new HttpError(422, 'El código del cliente expiró, pídele que lo actualice')
  return u
}
