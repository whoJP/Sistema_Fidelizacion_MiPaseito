import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { createMerchant, registerCustomer, submitKyc } from '../../frontend/src/data/actions.ts'
import { isCommandName } from '../../frontend/src/data/commands.ts'
import { isBirthdayToday, tierGap } from '../../frontend/src/domain/engagement.ts'
import { LIMITS, passwordError } from '../../frontend/src/domain/validation.ts'
import {
  HttpError,
  createCustomerToken,
  hashPassword,
  isCustomerCode,
  matchCustomerCode,
  readCustomerToken,
  requireAuth,
  signSession,
  verifyPassword,
  type AuthedRequest,
} from './auth.ts'
import { config } from './config.ts'
import { resetDemo } from './demo.ts'
import {
  DomainError,
  currentSnapshot,
  executeCommand,
  expirePendingRedemptions,
  purgeIdempotencyKeys,
  runScheduledJobs,
  transact,
  type Idempotency,
} from './engine.ts'
import { customerQrRouter, integrationRouter } from './integration.ts'
import { prisma } from './prisma.ts'
import { viewFor } from './snapshot.ts'

const KYC_PATH = '/api/me/kyc'
const app = express()
app.disable('x-powered-by')
const smallJson = express.json({ limit: '200kb' })
app.use((req, res, next) => (req.path === KYC_PATH ? next() : smallJson(req, res, next)))

const userId = (req: Request) => (req as AuthedRequest).userId
const text = (input: unknown, max: number = LIMITS.scanCode) => {
  const value = typeof input === 'string' ? input.trim() : ''
  if (value.length > max) throw new HttpError(422, 'Uno de los campos es demasiado largo')
  return value
}

function newPassword(value: unknown): string {
  const password = typeof value === 'string' ? value : ''
  const error = passwordError(password)
  if (error) throw new HttpError(422, error)
  return password
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/

/**
 * Optional `Idempotency-Key` header of a write. The client sends the same key when it retries a request whose
 * answer it never got; the server then returns the first result instead of applying the write twice.
 */
function idempotencyOf(req: Request, endpoint: string): Idempotency | undefined {
  const key = req.get('Idempotency-Key')
  if (key === undefined) return undefined
  if (!IDEMPOTENCY_KEY.test(key)) throw new HttpError(400, 'Clave de idempotencia inválida')
  const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex')
  return { userId: userId(req), key, endpoint, requestHash }
}

const markReplay = (res: Response, replayed: boolean) => {
  if (replayed) res.set('Idempotent-Replayed', 'true')
}

app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ ok: true, database: 'mysql' })
})

// ---------- Auth ----------

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password) throw new HttpError(422, 'Escribe tu correo y tu contraseña')
  const tooLong = email.length > LIMITS.email || password.length > LIMITS.passwordMax * 4
  const user = tooLong ? null : await prisma.user.findFirst({ where: { email, deletedAt: null } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos')
  }
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'Esta cuenta está suspendida')
  res.json({ token: signSession(user.id), userId: user.id })
})

// Registration needs no idempotency key: the email is unique, so a retry fails with "Ese correo ya está registrado".
app.post('/api/auth/register', async (req, res) => {
  const password = newPassword(req.body?.password)
  const { result: user } = await transact(
    (draft) =>
      registerCustomer(draft, {
        email: text(req.body?.email),
        firstName: text(req.body?.firstName),
        lastName: text(req.body?.lastName),
        phone: text(req.body?.phone) || null,
      }),
    { newUserPasswordHash: await hashPassword(password) },
  )
  res.status(201).json({ token: signSession(user.id), userId: user.id })
})

/** Admin creates a store staff account (MERCHANT) already assigned to its business. */
app.post('/api/admin/merchants', requireAuth, async (req, res) => {
  const password = newPassword(req.body?.password)
  const businessId = req.body?.businessId
  if (typeof businessId !== 'number' || !Number.isInteger(businessId) || businessId <= 0) throw new HttpError(422, 'Establecimiento inválido')
  const role = req.body?.role
  if (role !== 'STAFF' && role !== 'MANAGER') throw new HttpError(422, 'Cargo inválido')
  const { result: user, version, db, replayed } = await transact(
    (draft) =>
      createMerchant(
        draft,
        {
          email: text(req.body?.email),
          firstName: text(req.body?.firstName),
          lastName: text(req.body?.lastName),
          phone: text(req.body?.phone) || null,
          businessId,
          role,
        },
        userId(req),
      ),
    { newUserPasswordHash: await hashPassword(password) },
    undefined,
    idempotencyOf(req, 'admin/merchants'),
  )
  markReplay(res, replayed)
  res.status(201).json({ result: { id: user.id }, version, db: viewFor(db, userId(req)) })
})

// ---------- Data ----------

app.get('/api/snapshot', requireAuth, async (req, res) => {
  const { version, db } = await currentSnapshot()
  if (Number(req.query.since) === version) {
    res.status(204).end()
    return
  }
  res.json({ version, db: viewFor(db, userId(req)) })
})

app.post('/api/commands/:name', requireAuth, async (req, res) => {
  const name = String(req.params.name)
  if (!isCommandName(name)) throw new HttpError(404, 'Comando desconocido')
  const body: unknown = req.body ?? {}
  if (typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'El envío debe ser un objeto JSON')
  const { result, version, db, replayed } = await executeCommand(name, userId(req), body, idempotencyOf(req, `command:${name}`))
  markReplay(res, replayed)
  res.json({ result, version, db: viewFor(db, userId(req)) })
})

// Changing the password is idempotent by nature: a retry fails on "contraseña actual" or sets the same hash again.
app.post('/api/me/password', requireAuth, async (req, res) => {
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  if (!current) throw new HttpError(422, 'Escribe tu contraseña actual')
  const next = newPassword(req.body?.newPassword)
  if (next === current) throw new HttpError(422, 'La nueva contraseña debe ser distinta a la actual')
  const user = await prisma.user.findFirst({ where: { id: userId(req), deletedAt: null } })
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw new HttpError(422, 'La contraseña actual no es correcta')
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } })
  res.json({ ok: true })
})

app.get('/api/me/qr-token', requireAuth, (req, res) => {
  res.json(createCustomerToken(userId(req)))
})

// ---------- Birthday verification (KYC) ----------

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
}

/** `data:image/jpeg;base64,...` → validated bytes. The declared type must match the file content. */
function parsePhoto(value: unknown): { mimeType: string; data: Buffer } {
  const match = typeof value === 'string' ? /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(value) : null
  if (!match) throw new HttpError(422, 'Adjunta una foto de tu carnet')
  const [, mimeType, base64] = match
  const data = Buffer.from(base64, 'base64')
  if (!PHOTO_SIGNATURES[mimeType]?.(data)) throw new HttpError(422, 'La foto debe ser JPG, PNG o WEBP')
  if (data.length > MAX_PHOTO_BYTES) throw new HttpError(413, 'La foto es demasiado pesada (máximo 5 MB)')
  return { mimeType, data }
}

app.post(KYC_PATH, requireAuth, express.json({ limit: '8mb' }), async (req, res) => {
  const photo = parsePhoto(req.body?.photo)
  const { version, db, replayed } = await transact(
    (draft) => submitKyc(draft, userId(req), text(req.body?.birthDate, 10)),
    {},
    (tx, request) => tx.kycDocument.create({ data: { requestId: request.id, mimeType: photo.mimeType, data: new Uint8Array(photo.data) } }),
    idempotencyOf(req, 'me/kyc'),
  )
  markReplay(res, replayed)
  res.status(201).json({ result: true, version, db: viewFor(db, userId(req)) })
})

app.get('/api/admin/kyc/:id/document', requireAuth, async (req, res) => {
  const admin = await prisma.user.findFirst({ where: { id: userId(req), role: 'ADMIN', status: 'ACTIVE', deletedAt: null } })
  if (!admin) throw new HttpError(403, 'Solo un administrador puede ver documentos')
  const requestId = Number(req.params.id)
  if (!Number.isInteger(requestId) || requestId <= 0 || requestId > 2_147_483_647) throw new HttpError(404, 'El documento ya no está disponible')
  const document = await prisma.kycDocument.findUnique({ where: { requestId } })
  if (!document) throw new HttpError(404, 'El documento ya no está disponible')
  res.set('Cache-Control', 'no-store').type(document.mimeType).send(Buffer.from(document.data))
})

/** Resolves a customer QR code or email for staff registering a purchase. */
app.post('/api/customers/identify', requireAuth, async (req, res) => {
  const { db } = await currentSnapshot()
  const staff = db.users.find((u) => u.id === userId(req))
  const isStaff = staff?.role === 'MERCHANT' && db.businessMembers.some((m) => m.userId === staff.id && m.status === 'ACTIVE')
  if (!staff || (!isStaff && staff.role !== 'ADMIN')) throw new HttpError(403, 'Solo el personal de un establecimiento puede identificar clientes')

  const code = text(req.body?.code)
  if (!code) throw new HttpError(422, 'Escanea el QR del cliente o escribe su código')
  let customer
  if (isCustomerCode(code)) {
    const candidates = db.users.filter((u) => u.role === 'CUSTOMER' && u.deletedAt === null).map((u) => u.id)
    const matches = matchCustomerCode(code, candidates)
    if (matches.length === 0) throw new HttpError(404, 'Código incorrecto o vencido. Pide al cliente el código que ve ahora en su tarjeta.')
    if (matches.length > 1) throw new HttpError(422, 'Ese código coincide con más de un cliente. Pide al cliente que lo actualice.')
    customer = db.users.find((u) => u.id === matches[0])
  } else if (code.includes('@')) {
    customer = db.users.find((u) => u.email.toLowerCase() === code.toLowerCase() && u.deletedAt === null)
  } else {
    customer = db.users.find((u) => u.id === readCustomerToken(code) && u.deletedAt === null)
  }
  if (!customer || customer.role !== 'CUSTOMER') throw new HttpError(404, 'Cliente no encontrado')
  if (customer.status !== 'ACTIVE') throw new HttpError(422, 'La cuenta del cliente está suspendida')
  res.json({
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    nextTier: tierGap(db, customer.id),
    birthdayToday: isBirthdayToday(customer),
  })
})

app.post('/api/demo/reset', async (_req, res) => {
  if (!config.allowDemoReset) throw new HttpError(403, 'El reinicio de datos de demo está deshabilitado')
  await resetDemo()
  res.json({ ok: true })
})

app.use('/api/integration/v1', integrationRouter)
app.use('/api/integrations/customer-qr', customerQrRouter)

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')))

// ---------- Built frontend (optional: `npm run build` in frontend/) ----------

const dist = path.resolve(import.meta.dirname, '../../frontend/dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
  } else if (err instanceof DomainError) {
    res.status(422).json({ error: err.message })
  } else if ((err as { type?: string })?.type === 'entity.too.large') {
    res.status(413).json({ error: 'El envío es demasiado pesado' })
  } else if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'JSON inválido' })
  } else {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

setInterval(() => {
  expirePendingRedemptions().catch((err) => console.error('Expiring redemptions failed', err))
}, 15_000).unref()

const scheduledJobs = () => {
  runScheduledJobs().catch((err) => console.error('Scheduled jobs failed', err))
  purgeIdempotencyKeys().catch((err) => console.error('Purging idempotency keys failed', err))
}
setInterval(scheduledJobs, 5 * 60_000).unref()
void scheduledJobs()

app.listen(config.port, () => {
  console.log(`Paseo Points API en http://localhost:${config.port}`)
})
