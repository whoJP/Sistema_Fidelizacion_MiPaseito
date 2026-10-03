import { DEMO_PASSWORD, resetDemo } from '../src/demo.ts'
import { prisma } from '../src/prisma.ts'

const db = await resetDemo()
console.log(
  `Seed OK: ${db.users.length} usuarios, ${db.businesses.length} establecimientos, ` +
    `${db.transactions.length} compras, ${db.rewards.length} recompensas. Contraseña demo: ${DEMO_PASSWORD}`,
)
await prisma.$disconnect()
