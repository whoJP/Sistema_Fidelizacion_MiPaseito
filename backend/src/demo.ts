import { DEMO_PASSWORD } from '../../frontend/src/data/demoAccounts.ts'
import { buildDemoDatabase } from '../../frontend/src/data/fixtures.ts'
import { hashPassword } from './auth.ts'
import { replaceAll } from './engine.ts'

export { DEMO_PASSWORD }

/** Wipes every table and loads the demo dataset (dates relative to now). */
export async function resetDemo() {
  const db = buildDemoDatabase()
  await replaceAll(db, { newUserPasswordHash: await hashPassword(DEMO_PASSWORD) })
  return db
}
