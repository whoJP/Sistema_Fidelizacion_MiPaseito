import { existsSync } from 'node:fs'
import path from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { createMerchant, registerCustomer } from '../../frontend/src/data/actions.ts'
import { isCommandName } from '../../frontend/src/data/commands.ts'
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
import { DomainError, currentSnapshot, executeCommand, expirePendingRedemptions, transact } from './engine.ts'
import { integrationRouter } from './integration.ts'
import { prisma } from './prisma.ts'
import { viewFor } from './snapshot.ts'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '200kb' }))

const userId = (req: Request) => (req as AuthedRequest).userId
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ ok: true, database: 'mysql' })
})

// ---------- Auth ----------

app.post('/api/auth/login', async (req, res) => {
  const email = text(req.body?.email).toLowerCase()
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos')
  }
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'Esta cuenta está suspendida')
  res.json({ token: signSession(user.id), userId: user.id })
})

app.post('/api/auth/register', async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (password.length < 6) throw new HttpError(422, 'La contraseña debe tener al menos 6 caracteres')
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
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (password.length < 6) throw new HttpError(422, 'La contraseña debe tener al menos 6 caracteres')
  const businessId = Number(req.body?.businessId)
  if (!Number.isInteger(businessId) || businessId <= 0) throw new HttpError(422, 'Establecimiento inválido')
  const role = req.body?.role
  if (role !== 'STAFF' && role !== 'MANAGER') throw new HttpError(422, 'Cargo inválido')
  const { result: user, version, db } = await transact(
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
  )
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
  if (!isCommandName(name)) throw new HttpError(404, `Comando desconocido: ${name}`)
  const { result, version, db } = await executeCommand(name, userId(req), req.body)
  res.json({ result, version, db: viewFor(db, userId(req)) })
})

app.post('/api/me/password', requireAuth, async (req, res) => {
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
  if (next.length < 6) throw new HttpError(422, 'La nueva contraseña debe tener al menos 6 caracteres')
  if (next.length > 72) throw new HttpError(422, 'La nueva contraseña es demasiado larga')
  const user = await prisma.user.findFirst({ where: { id: userId(req), deletedAt: null } })
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw new HttpError(422, 'La contraseña actual no es correcta')
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } })
  res.json({ ok: true })
})

app.get('/api/me/qr-token', requireAuth, (req, res) => {
  res.json(createCustomerToken(userId(req)))
})

/** Resolves a customer QR code or email for staff registering a purchase. */
app.post('/api/customers/identify', requireAuth, async (req, res) => {
  const { db } = await currentSnapshot()
  const staff = db.users.find((u) => u.id === userId(req))
  const isStaff = staff?.role === 'MERCHANT' && db.businessMembers.some((m) => m.userId === staff.id && m.status === 'ACTIVE')
  if (!staff || (!isStaff && staff.role !== 'ADMIN')) throw new HttpError(403, 'Solo el personal de un establecimiento puede identificar clientes')

  const code = text(req.body?.code)
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
  res.json({ id: customer.id, firstName: customer.firstName, lastName: customer.lastName, email: customer.email })
})

app.post('/api/demo/reset', async (_req, res) => {
  if (!config.allowDemoReset) throw new HttpError(403, 'El reinicio de datos de demo está deshabilitado')
  await resetDemo()
  res.json({ ok: true })
})

app.use('/api/integration/v1', integrationRouter)

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

app.listen(config.port, () => {
  console.log(`Paseo Points API en http://localhost:${config.port}`)
})
