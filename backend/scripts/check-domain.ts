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

// New mission created after the purchases is granted immediately.
const before = pointsBalance(db, ana)
const mission = A.saveMission(
  db,
  null,
  { name: 'Test', description: null, type: 'TRANSACTION_COUNT', goal: 2, rewardPoints: 77, rewardStatus: 0, startsAt: new Date(Date.now() - 30 * 864e5).toISOString(), endsAt: new Date(Date.now() + 864e5).toISOString(), status: 'ACTIVE' },
  { businessIds: [], categoryIds: [] },
  1,
)
assert.equal(pointsBalance(db, ana), before + 77, 'misión nueva acreditada al crearla')

// Cancelling purchases below the goal takes the mission reward back.
const anaTxs = db.transactions.filter((t) => t.customerId === ana && t.status === 'COMPLETED' && new Date(t.createdAt) >= new Date(mission.startsAt))
for (const t of anaTxs) A.cancelTransaction(db, t.id, 1)
const row = db.missionProgress.find((p) => p.missionId === mission.id && p.userId === ana)
assert.equal(row?.completedAt, null, 'misión revertida al anular compras')
assert.ok(db.pointMovements.some((m) => m.missionId === mission.id && m.amount === -77), 'reverso de puntos de misión')

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
assert.throws(() => A.validateRedemption(db2, { token: pending.verificationToken, businessId: 7, staffId: 4 }), /solo se canjea/)

console.log('OK: reglas verificadas')
