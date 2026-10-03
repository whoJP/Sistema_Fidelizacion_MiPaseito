// Smoke test of the business rules on the demo dataset (no database needed): `npx tsx scripts/check-domain.ts`.
import assert from 'node:assert/strict'
import * as A from '../../frontend/src/data/actions.ts'
import { buildDemoDatabase } from '../../frontend/src/data/fixtures.ts'
import {
  badgeProgress,
  earnedBadges,
  evaluateMission,
  liveMissions,
  pointsBalance,
  rewardTitle,
  statusTotal,
  visibleRewards,
} from '../../frontend/src/domain/loyalty.ts'
import { todayKey } from '../../frontend/src/domain/time.ts'

const db = buildDemoDatabase()
const ana = 2
console.log('Ana: puntos', pointsBalance(db, ana), '· puntos de nivel', statusTotal(db, ana))
console.log('Recompensas visibles:', visibleRewards(db).map((r) => `${rewardTitle(db, r)} (${r.pointsCost})`).join(' | '))
console.log('Insignias de Ana:', earnedBadges(db, ana).map((b) => b.name).join(', '))
for (const m of liveMissions(db)) {
  const row = db.missionProgress.find((p) => p.missionId === m.id && p.userId === ana)
  console.log(`Misión "${m.name}": ${evaluateMission(db, m, ana)}/${m.goal}`, row?.completedAt ? '✔ completada' : '')
}

// Every live mission whose goal is met must have been rewarded.
for (const m of liveMissions(db)) {
  for (const u of db.users.filter((x) => x.role === 'CUSTOMER')) {
    const met = evaluateMission(db, m, u.id) >= m.goal
    const row = db.missionProgress.find((p) => p.missionId === m.id && p.userId === u.id)
    assert.equal(!!row?.completedAt, met, `Misión ${m.name} / usuario ${u.id}`)
  }
}

// Validity windows: no start in the past, end after start, started records keep their start.
const window = (startsAt: number, endsAt: number) => ({
  name: 'Test',
  description: null,
  type: 'TRANSACTION_COUNT' as const,
  goal: 1,
  rewardPoints: 77,
  rewardStatus: 0,
  rewardSpins: 0,
  startsAt: new Date(startsAt).toISOString(),
  endsAt: new Date(endsAt).toISOString(),
  status: 'ACTIVE' as const,
})
const noScope = { businessIds: [], categoryIds: [] }
assert.throws(() => A.saveMission(db, null, window(Date.now() - 864e5, Date.now() + 864e5), noScope, 1), /anterior a la fecha/)
assert.throws(() => A.saveMission(db, null, window(Date.now() + 2 * 864e5, Date.now() + 864e5), noScope, 1), /posterior al inicio/)
assert.throws(() => A.saveMission(db, 1, { ...db.missions[0], startsAt: new Date().toISOString() }, noScope, 1), /no se puede cambiar/)

// A mission completed by a purchase is taken back when that purchase is cancelled.
const mission = A.saveMission(db, null, window(Date.now() - 60_000, Date.now() + 864e5), noScope, 1)
const before = pointsBalance(db, ana)
const capuchino = db.catalogItems.find((i) => i.businessId === 1 && i.name === 'Capuchino')!
const purchase = A.registerPurchase(db, { customerId: ana, businessId: 1, performedById: 3, items: [{ catalogItemId: capuchino.id, quantity: 3 }] })
assert.equal(purchase.transaction.amount, capuchino.price * 3, 'el monto sale del catálogo')
assert.ok(purchase.completedMissions.some((m) => m.id === mission.id), 'misión completada con la compra')
A.cancelTransaction(db, purchase.transaction.id, 1)
const row = db.missionProgress.find((p) => p.missionId === mission.id && p.userId === ana)
assert.equal(row?.completedAt, null, 'misión revertida al anular compras')
assert.ok(db.pointMovements.some((m) => m.missionId === mission.id && m.amount === -77), 'reverso de puntos de misión')
assert.equal(pointsBalance(db, ana), before, 'anular devuelve el saldo al estado previo')

// Undo within the window, then cancellation only through an admin-approved request.
const luis = db.users.find((u) => u.email === 'luis@demo.paseo')!.id
const p2 = A.registerPurchase(db, { customerId: ana, businessId: 1, performedById: luis, items: [{ catalogItemId: capuchino.id, quantity: 1 }] })
assert.throws(() => A.undoPurchase(db, p2.transaction.id, luis, new Date(Date.now() + A.PURCHASE_UNDO_MS + 60_000)), /Pasó el tiempo/)
A.undoPurchase(db, p2.transaction.id, luis)
assert.equal(p2.transaction.status, 'CANCELLED')
const p3 = A.registerPurchase(db, { customerId: ana, businessId: 1, performedById: luis, items: [{ catalogItemId: capuchino.id, quantity: 2 }] })
assert.throws(() => A.requestCancellation(db, { transactionId: p3.transaction.id, reason: 'corto' }, luis), /10 caracteres/)
const request = A.requestCancellation(db, { transactionId: p3.transaction.id, reason: 'Se registró al cliente equivocado' }, luis)
assert.throws(() => A.reviewCancellation(db, { requestId: request.id, decision: 'APPROVED', note: 'ok' }, luis), /administrador/)
A.reviewCancellation(db, { requestId: request.id, decision: 'APPROVED', note: 'el cajero eligió otro cliente' }, 1)
assert.equal(p3.transaction.status, 'CANCELLED')
const notice = db.notifications.filter((n) => n.userId === ana).at(-1)!
assert.match(notice.message, /Se te descontaron \d+ puntos .* Motivo: El cajero eligió otro cliente\./)
assert.throws(() => A.requestCancellation(db, { transactionId: p3.transaction.id, reason: 'Otra vez por favor' }, luis), /anulada/)

// Event check-in: only while open, once, grants points and the badge.
const db2 = buildDemoDatabase()
const p0 = pointsBalance(db2, 5)
const res = A.checkInEvent(db2, { eventId: 2, customerId: 5 }, 1)
assert.equal(pointsBalance(db2, 5), p0 + 100)
assert.ok(res.newBadges.includes('Semana del Café'))
assert.throws(() => A.checkInEvent(db2, { eventId: 2, customerId: 5 }, 1), /ya registró/)
assert.throws(() => A.checkInEvent(db2, { eventId: 3, customerId: 5 }, 1), /en curso/)

// Special date badge uses Bolivian calendar day.
const urku = db2.badges.find((b) => b.type === 'SPECIAL_DATE' && b.date === '2026-08-15')!
assert.ok(badgeProgress(db2, urku, ana).earnedAt, 'Ana visitó el 15/08')

// Rewards belong to one business: only its manager edits; redemption only at that business.
assert.throws(() => A.saveReward(db2, 1, { ...db2.rewards[0], discountAmount: 30 }, 1), /encargado/)
A.saveReward(db2, 1, { ...db2.rewards[0], discountAmount: 30 }, 3)
assert.match(rewardTitle(db2, db2.rewards[0]), /30.*de descuento/)
const pending = db2.redemptions.find((r) => r.status === 'PENDING')!
const staffOf = (businessId: number) => db2.businessMembers.find((m) => m.businessId === businessId && m.status === 'ACTIVE')!.userId
const lineOf = (businessId: number, name: string, quantity = 1) => ({
  catalogItemId: db2.catalogItems.find((i) => i.businessId === businessId && i.name === name)!.id,
  quantity,
})
assert.throws(
  () => A.registerPurchase(db2, { customerId: ana, businessId: 7, performedById: staffOf(7), items: [lineOf(7, 'MiniBon')], redemptionIds: [pending.id] }),
  /solo se usa allí/,
)
assert.throws(() => A.rejectRedemption(db2, { redemptionId: pending.id, reason: 'No tenemos stock hoy' }, staffOf(7)), /Solo el personal/)

// Canjes are applied with the purchase at the counter and come back when the purchase is undone.
const pendingReward = db2.rewards.find((r) => r.id === pending.rewardId)!
assert.equal(pendingReward.businessId, 1)
const withCanje = A.registerPurchase(db2, {
  customerId: ana,
  businessId: 1,
  performedById: staffOf(1),
  items: [lineOf(1, 'Capuchino', 2)],
  redemptionIds: [pending.id],
})
assert.equal(withCanje.transaction.discount, pendingReward.discountAmount, 'el canje descuenta del total')
assert.equal(withCanje.transaction.amount, 44 - pendingReward.discountAmount!)
assert.equal(pending.status, 'REDEEMED')
assert.equal(pending.transactionId, withCanje.transaction.id)
A.undoPurchase(db2, withCanje.transaction.id, staffOf(1))
assert.equal(pending.status, 'PENDING', 'deshacer la compra devuelve el canje')

// The business may refuse a canje: points back, customer notified without the internal reason.
const balance = pointsBalance(db2, ana)
assert.throws(() => A.rejectRedemption(db2, { redemptionId: pending.id, reason: 'corto' }, staffOf(1)), /al menos/)
A.rejectRedemption(db2, { redemptionId: pending.id, reason: 'Se acabó el producto de la promoción' }, staffOf(1))
assert.equal(pending.status, 'CANCELLED')
assert.equal(pending.cancelReason, 'Se acabó el producto de la promoción.')
assert.equal(pointsBalance(db2, ana), balance + pending.pointsSpent, 'puntos devueltos')
const refusal = db2.notifications.filter((n) => n.userId === ana).at(-1)!
assert.match(refusal.title, /Canje cancelado/)
assert.doesNotMatch(refusal.message, /producto de la promoción/)

// Birthday benefits: applied automatically at checkout, once a year per business.
const anaUser = db2.users.find((u) => u.id === ana)!
anaUser.birthDate = `1995${todayKey().slice(4)}`
const clothes = [lineOf(3, 'Polera básica'), lineOf(3, 'Jeans clásicos')]
const birthday = A.registerPurchase(db2, { customerId: ana, businessId: 3, performedById: staffOf(3), items: clothes, useBirthday: true })
assert.equal(birthday.transaction.discount, 94.5 + 100, '50% en la polera y Bs 100 en el jean')
assert.equal(birthday.transaction.amount, 189 + 399 - 194.5)
assert.ok(db2.birthdayClaims.some((c) => c.userId === ana && c.businessId === 3 && c.transactionId === birthday.transaction.id))
assert.throws(
  () => A.registerPurchase(db2, { customerId: ana, businessId: 3, performedById: staffOf(3), items: clothes, useBirthday: true }),
  /ya usó sus beneficios/,
)
const gift = A.registerPurchase(db2, { customerId: ana, businessId: 2, performedById: staffOf(2), items: [lineOf(2, 'Pizza personal')], useBirthday: true })
assert.ok(!db2.birthdayClaims.some((c) => c.transactionId === gift.transaction.id), 'sin la pizza familiar no hay regalo')
anaUser.birthDate = '1995-01-01'
assert.throws(
  () => A.registerPurchase(db2, { customerId: ana, businessId: 2, performedById: staffOf(2), items: [lineOf(2, 'Pizza personal')], useBirthday: true }),
  /no es el cumpleaños/,
)

// Birthday benefits configuration: manager only, with a condition that makes sense.
const giftData = {
  type: 'FREE_PRODUCT' as const,
  discountPercent: null,
  discountAmount: null,
  catalogItemId: lineOf(3, 'Polera básica').catalogItemId,
  quantity: 1,
  giftCondition: 'MIN_PURCHASE' as const,
  minimumPurchase: null,
  requiredItemId: null,
  discountScope: null,
  targetItemId: null,
  targetCategory: null,
  description: null,
  isActive: true,
}
const clothesManager = db2.businessMembers.find((m) => m.businessId === 3 && m.role === 'MANAGER' && m.status === 'ACTIVE')
if (clothesManager) {
  assert.throws(() => A.saveBirthdayPerk(db2, null, 3, giftData, clothesManager.userId), /compra mínima/)
  const saved = A.saveBirthdayPerk(db2, null, 3, { ...giftData, minimumPurchase: 500 }, clothesManager.userId)
  A.deleteBirthdayPerk(db2, saved.id, clothesManager.userId)
  assert.ok(!db2.birthdayPerks.some((p) => p.id === saved.id))
}
assert.throws(() => A.saveBirthdayPerk(db2, null, 3, { ...giftData, minimumPurchase: 500 }, 1), /encargado/)

// Three account types: store staff (MERCHANT) work at one business and are not customers.
for (const m of db2.businessMembers) assert.equal(db2.users.find((u) => u.id === m.userId)?.role, 'MERCHANT')
assert.equal(new Set(db2.businessMembers.map((m) => m.userId)).size, db2.businessMembers.length, 'una membresía por persona')
assert.throws(() => A.registerPurchase(db2, { customerId: 4, businessId: 1, performedById: 3, items: [{ catalogItemId: 1, quantity: 1 }] }), /Cliente no encontrado/)
assert.throws(() => A.createRedemption(db2, 3, 1), /Solo los clientes/)
assert.throws(() => A.saveMembership(db2, { email: 'ana@demo.paseo', businessId: 1, role: 'STAFF' }, 1), /no es de personal/)
assert.throws(() => A.saveMembership(db2, { email: 'luis@demo.paseo', businessId: 6, role: 'STAFF' }, 1), /Ya trabaja en Mocca/)
const created = A.createMerchant(db2, { email: 'nuevo@demo.paseo', firstName: 'Nuevo', lastName: 'Cajero', phone: null, businessId: 7, role: 'STAFF' }, 1)
assert.equal(created.role, 'MERCHANT')
assert.ok(A.activeMembership(db2, created.id, 7), 'cuenta de personal creada y asignada')
assert.throws(() => A.createMerchant(db2, { email: 'otro@demo.paseo', firstName: 'X', lastName: 'Y', phone: null, businessId: 7, role: 'STAFF' }, 3), /administrador/)

console.log('OK: reglas verificadas')
