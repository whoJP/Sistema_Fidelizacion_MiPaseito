---
name: paseo-points-frontend
description: Frontend conventions for Paseo Points (React 19 + Vite + TypeScript + React Router 7). Covers the snapshot store, server commands via `run()`, pure domain functions, UI primitives, Spanish copy, money in Bs, typing and accessibility rules. Use when creating or editing anything under `frontend/`, adding pages, forms, admin/merchant/customer views, or when the user mentions the UI, React, components or pantallas.
---

# Paseo Points — Frontend

Adapted from community skills `react-dev` (softaworks/agent-toolkit), `react-best-practices` and
`web-design-guidelines` (vercel-labs/agent-skills), narrowed to this codebase.

## Stack

React 19, Vite 8, TypeScript 6 (strict, `verbatimModuleSyntax`), React Router 7 (declarative `<Routes>`),
`lucide-react` icons, `qrcode.react`. Plain CSS in `src/index.css` (no Tailwind, no UI kit).

## Layout

```
src/
  types/domain.ts       Mirror of backend/prisma/schema.prisma (dates = ISO strings, Decimal = number)
  domain/loyalty.ts     Pure derivations: balances, tiers, scopes, missions, streaks, passport
  data/actions.ts       Pure domain mutations on a Database draft (also executed by the backend)
  data/commands.ts      Command registry: name -> (db, actor, input). Shared with the backend
  data/api.ts           fetch wrapper (JWT, errors)
  data/store.ts         Snapshot store: useDb(), refresh/polling, applySnapshot()
  session.ts            Auth session (token + user id) and useSession()/useUser()
  components/ui.tsx     run(), notify(), Card, Badge, Field, Modal, Stat, Progress, MultiSelect
  pages/{customer,merchant,admin}/
```

## Data flow (non-negotiable)

1. **Read** with `const db = useDb()` and derive with functions from `domain/loyalty.ts`.
   Never store derived values (balances, tier, stock, streak) in state.
2. **Write** only through `await run('<command>', input, successMessage)`. It POSTs to
   `/api/commands/:name`; the server executes it against MySQL and returns `{ result, db }`;
   the store swaps in the new snapshot. Never mutate `db` locally and never call `data/actions.ts` from pages.
3. Do not pass the acting user's id: the backend injects it from the JWT.
4. `run()` returns `undefined` on a domain error (an error toast was already shown). Check before using it:

```tsx
const submit = async (e: FormEvent) => {
  e.preventDefault()
  const r = await run('registerPurchase', { customerId, businessId, amount }, 'Compra registrada')
  if (r) setResult(r)
}
```

5. Adding a command = add it to `data/commands.ts` (typed input), then call it with `run`. Types for
   `run` input/result are inferred from the registry; never use `any`.

## Components and typing

- Function components with typed props objects; no `React.FC`, no `forwardRef` (React 19 passes `ref` as prop).
- Events: `FormEvent`, `ChangeEvent<HTMLInputElement>`; handlers that call `run` are `async`.
- Reuse primitives from `components/ui.tsx` before writing new markup. Pages start with `<PageHeader>` and use `<Card>`.
- Derive during render; `useEffect` only for subscriptions/timers (e.g. QR refresh). No effect chains to sync state.
- Lists need stable `key` (entity `id`). Disable submit buttons while invalid or pending.

## Copy, locale and money

- All UI text in Spanish (Bolivia). Use `formatMoney` (Bs), `formatInt`, `formatDate*` from `lib/format.ts`;
  never format numbers or dates by hand.
- No English in visible text. Code keeps English names; the UI shows: `Points` → **puntos** (spendable),
  `Status` → **puntos de nivel** (tier progress, never spent), `Tier` → **nivel** (Bronce / Plata / Oro / Platinum),
  `MANAGER` / `STAFF` → **Encargado** / **Personal** (`MEMBER_ROLE_LABELS`), email → **correo**, ADMIN →
  **Administrador**. Never show enum values, setting keys or table names; map them with the label maps in
  `lib/format.ts`. Other terms: Pasaporte, Misiones, Insignias, Eventos, Canje, Establecimiento. "Paseo Points" is the brand.
- Admin copy is for non-technical staff: short, plain, with units (Bs, horas, puntos) and one-line hints.
- Rewards are created by the business manager (`MerchantRewardsPage`); the admin only views them. Show a reward with
  `rewardTitle` / `rewardConditions`, never a free-text name.
- Badges are derived (`earnedBadges`, `badgeProgress`); local calendar days use `domain/time.ts` (Bolivia, UTC−4).

## Accessibility and UX

- Every input inside `<Field label=…>`; icon-only buttons need `aria-label`.
- Feedback for every action: success/error toast via `run`/`notify`; empty states with `<Empty>`.
- Destructive actions ask `confirm()`; show irreversible effects in the message.
- Keep tap targets ≥ 40px and layouts usable at 375px width (the customer view is used on phones).

## Verify before finishing

```bash
cd frontend
npm run build   # tsc -b + vite build, must pass with zero errors
npm run lint    # oxlint
```

With the backend running (`cd backend && npm run dev`), exercise the changed screen with a demo account
(`ana@demo.paseo`, `luis@demo.paseo`, `sofia@demo.paseo`, `admin@demo.paseo`, password `demo1234`).
