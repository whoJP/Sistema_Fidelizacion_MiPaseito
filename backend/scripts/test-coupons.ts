// Creates PENDING canjes (one per business) for a demo customer so merchants can test them at the counter, and
// prints the customer's card QR: scanning it in "Registrar compra" lists the canjes of that business.
// Usage: npm run demo:coupons [-- email] [-- count]
// They expire after REDEMPTION_EXPIRATION_DAYS (7 by default) and the points go back to the customer.
import { PrismaClient } from '@prisma/client'
import { createRedemptionToken } from '../../frontend/src/domain/tokens.ts'
import { createCustomerToken } from '../src/auth.ts'

const email = process.argv[2] ?? 'ana@demo.paseo'
const count = Number(process.argv[3] ?? 3)
const prisma = new PrismaClient()

type RewardRow = { id: number; businessId: number; pointsCost: number; business: string; type: string; description: string | null }

const user = await prisma.$queryRaw<{ id: number; firstName: string; lastName: string }[]>`
  SELECT id, firstName, lastName FROM User WHERE email = ${email} AND role = 'CUSTOMER' AND deletedAt IS NULL`
if (!user[0]) throw new Error(`No existe un cliente con email ${email}`)
const customer = user[0]

const [{ balance }] = await prisma.$queryRaw<{ balance: bigint | number | null }[]>`
  SELECT COALESCE(SUM(amount), 0) AS balance FROM PointMovement WHERE userId = ${customer.id}`
let points = Number(balance)

const rewards = await prisma.$queryRaw<RewardRow[]>`
  SELECT rw.id, rw.businessId, rw.pointsCost, b.name AS business, rw.type, rw.description
  FROM Reward rw JOIN Business b ON b.id = rw.businessId
  WHERE rw.status = 'ACTIVE' AND rw.deletedAt IS NULL AND b.deletedAt IS NULL
    AND rw.minimumTierId IS NULL AND (rw.stock IS NULL OR rw.stock > 0)
    AND (rw.startsAt IS NULL OR rw.startsAt <= NOW()) AND (rw.endsAt IS NULL OR rw.endsAt >= NOW())
  ORDER BY rw.pointsCost`

const seen = new Set<number>()
const picked = rewards.filter((r) => !seen.has(r.businessId) && seen.add(r.businessId)).slice(0, count)
const created: RewardRow[] = []

for (const reward of picked) {
  if (points < reward.pointsCost) break
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO Redemption (userId, rewardId, pointsSpent, verificationToken, status, createdAt)
      VALUES (${customer.id}, ${reward.id}, ${reward.pointsCost}, ${createRedemptionToken()}, 'PENDING', NOW(3))`
    const [{ id }] = await tx.$queryRaw<{ id: bigint }[]>`SELECT LAST_INSERT_ID() AS id`
    await tx.$executeRaw`
      INSERT INTO PointMovement (userId, redemptionId, type, amount, createdAt)
      VALUES (${customer.id}, ${Number(id)}, 'REDEMPTION', ${-reward.pointsCost}, NOW(3))`
  })
  points -= reward.pointsCost
  created.push(reward)
}

console.log(`Cliente: ${customer.firstName} ${customer.lastName} (${email}) · saldo restante ${points} pts\n`)
for (const reward of created) console.log(`${reward.business} · ${reward.type} · ${reward.pointsCost} pts`)
if (created.length === 0) console.log('No se creó ningún canje (sin recompensas disponibles o sin puntos).')

const member = createCustomerToken(customer.id)
console.log('\nQR de la tarjeta (en "Registrar compra" muestra sus canjes del local; vale ~5-10 min):')
console.log(`  Código: ${member.code.replace(/^(\d{3})/, '$1 ')}`)
console.log(`  QR:     https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(member.token)}`)

await prisma.$disconnect()
