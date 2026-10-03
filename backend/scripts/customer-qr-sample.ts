// Prints test tokens for POST /api/integrations/customer-qr/verify: a fresh one, a tampered one and an expired one.
// Usage: npm run qr:sample [-- userId]   (defaults to 2, Ana in the demo data)
import { createCustomerToken } from '../src/auth.ts'

const userId = Number(process.argv[2] ?? 2)
const fresh = createCustomerToken(userId).token
const [prefix, payload, signature] = fresh.split('.')
const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number }
const forged = Buffer.from(JSON.stringify({ u: userId + 1, exp })).toString('base64url')

console.log(
  JSON.stringify(
    {
      userId,
      validUntil: new Date(exp).toISOString(),
      valid: fresh,
      tampered: `${prefix}.${forged}.${signature}`,
      expired: createCustomerToken(userId, Date.now() - 60 * 60 * 1000).token,
    },
    null,
    2,
  ),
)
