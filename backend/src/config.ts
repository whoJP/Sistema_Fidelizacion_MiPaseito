function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name} (see backend/.env.example)`)
  return value
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 4000),
  allowDemoReset: process.env.ALLOW_DEMO_RESET === 'true',
  integrationApiKey: process.env.INTEGRATION_API_KEY ?? '',
}
