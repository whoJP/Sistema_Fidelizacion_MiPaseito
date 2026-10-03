---
name: paseo-points-backend
description: Backend conventions for Paseo Points (Node + Express 5 + Prisma 6 + MySQL 8). Covers the command architecture, snapshot persistence, ledgers, soft delete, auth with JWT/bcrypt, Prisma migrations and seeding. Use when editing anything under `backend/`, the Prisma schema, SQL, migrations, seeds, API endpoints, authentication, or when the user mentions the database, MySQL, API or servidor.
---

# Paseo Points — Backend

Adapted from community skills `backend-dev-guidelines` (layered Express + Prisma) and
`api-database-prisma` / `prisma/skills`, narrowed to this codebase (Prisma **6**, not 7).

## Stack and commands

Node 24, Express 5, Prisma 6.19 (`prisma-client-js`), MySQL 8.4 (InnoDB, utf8mb4), `tsx` to run TypeScript,
`jsonwebtoken`, `bcryptjs`. Config in `backend/.env` (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `ALLOW_DEMO_RESET`).

```bash
cd backend
npm run dev          # API on http://localhost:4000 (watch mode)
npm run db:migrate   # prisma migrate deploy (no shadow DB needed)
npm run db:seed      # wipe + load demo data
npm run db:setup     # migrate + generate + seed
```

## Layout

```
backend/src/
  server.ts      Express app, routes, error handler
  config.ts      Reads and validates env (only place that touches process.env)
  prisma.ts      PrismaClient singleton
  auth.ts        bcrypt, JWT sign/verify, requireAuth middleware, QR token HMAC
  tables.ts      Table metadata: Prisma delegate, primary key, date/time/decimal columns, FK order
  snapshot.ts    loadSnapshot(): MySQL -> Database (same shape as frontend/src/types/domain.ts)
  persist.ts     persistDiff(tx, before, after, { newUserPasswordHash }): primary-key diff -> createMany/updateMany/deleteMany
  engine.ts      executeCommand()/transact(): mutex -> snapshot -> run command -> persist -> version++
  demo.ts        resetDemo(): wipe all tables + load buildDemoDatabase() from frontend/src/data/fixtures.ts
  integration.ts Read-only API for Jarvis Paseo (Reto 2) at /api/integration/v1, header X-API-Key = INTEGRATION_API_KEY
  openapi.ts     OpenAPI 3.1 contract of that API (served at /api/integration/v1/openapi.json); update it with the routes
prisma/schema.prisma, prisma/migrations/, prisma/seed.ts
```

## Command architecture (single source of business rules)

- Business rules live in `frontend/src/data/actions.ts` and `frontend/src/domain/loyalty.ts` (pure TS, no React).
  The backend imports them; never re-implement a rule in SQL or in a route.
- `frontend/src/data/commands.ts` maps a command name to `(db, actor, input)`. The **actor comes from the JWT**;
  never accept `actorId`, `staffId`, `performedById` or `userId` of the actor from the request body.
- `POST /api/commands/:name` → `engine.executeCommand` serializes writes with an in-process mutex, loads the
  snapshot, runs the command on a `structuredClone`, diffs and writes everything in **one** `prisma.$transaction`.
  `DomainError` → HTTP 422 `{ error }`; other errors → 500.
- Clients poll `GET /api/snapshot?since=<version>` (204 = unchanged). The engine caches the snapshot for 5 s and
  bumps `version` when a reload differs, so seeds or manual SQL edits reach open browsers without restarting.
- Commands that create users need `newUserPasswordHash` (persist throws otherwise); void commands return `true`.
- New command checklist: add function in `actions.ts` (throw `DomainError` with a Spanish message) → register in
  `commands.ts` with role checks → call from the UI with `run()`.

## Data rules (see `docs/DATABASE.md`)

- Balances are never stored: Points = `SUM(PointMovement.amount)`, Status = `SUM(StatusMovement.amount)`;
  tier = highest active `Tier.minimumStatus` ≤ Status.
- Earned badges are never stored either: `Badge` holds only the definition; who has it is derived from the history.
- History is immutable: `Transaction`, `PointMovement`, `StatusMovement`, `Redemption`, `EventAttendance`,
  `FraudAlert`, `AuditLog` are never deleted or edited except `status`/validation fields. Corrections = new
  `REVERSAL`/`ADJUSTMENT` rows.
- `Reward` belongs to one `Business` (required `businessId`), edited only by that business's MANAGER; typed condition
  columns per `RewardType`, no free-text name.
- Soft delete (`deletedAt`) only on `User`, `Business`, `Category`, `CatalogItem`, `Reward`, `Mission`, `Promotion`,
  `Event`, `Badge`.
  Every read filters `deletedAt IS NULL`.
- Money is `DECIMAL(10,2)` in **Bs**; Points/Status are integers.
- Persisting a new table: add it to `tables.ts` in FK-safe order (parents first) with its date/time columns.

## Prisma rules

- One `PrismaClient` (`src/prisma.ts`). Inside `$transaction(async (tx) => …)` use `tx`, never `prisma`.
- Schema change: edit `schema.prisma` → `npx prisma migrate dev --name <change>` (needs a shadow DB; the
  `paseo` user must have CREATE privilege) → commit the generated SQL. Apply elsewhere with `npm run db:migrate`.
  In a non-interactive shell `migrate dev` fails: generate the SQL with
  `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`,
  save it as a new `prisma/migrations/<timestamp>_<name>/migration.sql` (PascalCase table names, backfill data before
  adding required columns) and run `npx prisma migrate deploy`. Stop the dev server before `prisma generate` on Windows.
- Never hand-edit an applied migration; create a new one.
- `@db.Time` columns travel as `"HH:MM"` strings in the snapshot; `DateTime` as ISO strings; `Decimal` as number.

## Security

- Passwords: `bcryptjs` hash (cost 10). Never return `passwordHash` (the snapshot strips it).
- JWT (`Authorization: Bearer`) signed with `JWT_SECRET`, 12h expiry. Customer QR tokens are HMAC-SHA256 signed
  server-side and expire in 5 minutes.
- Non-admin snapshots hide other users' email/phone/birthDate.
- `POST /api/demo/reset` only works when `ALLOW_DEMO_RESET=true`.

## Verify before finishing

```bash
cd backend
npx prisma validate
npm run typecheck
npm run db:seed && npm run dev   # then GET http://localhost:4000/api/health
```

Full demo (MySQL + migrate + build + API on :4000): `.\start-demo.ps1 [-Reset]` from the repo root.
MySQL 8.4 lives in `%USERPROFILE%\mysql8` and is not a Windows service; the script starts it if :3306 is closed.
