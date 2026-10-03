// Customer QR tokens are signed by the backend (`backend/src/auth.ts`); only redemption codes are generated here.

export function createRedemptionToken(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  return `${code.slice(0, 5)}-${code.slice(5)}`
}
