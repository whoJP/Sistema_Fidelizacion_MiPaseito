// What a purchase at the counter gets from the customer's canjes and birthday benefits. Pure: the cashier screen
// uses it for the live preview and `registerPurchase` uses it to compute the amount actually charged.
import type { BirthdayPerk, CatalogItem, Database, Redemption, Reward } from '../types/domain'
import { formatMoney, normalizeText } from '../lib/format'
import { redemptionExpiresAt, rewardTitle } from './loyalty'

export interface CheckoutLine {
  item: CatalogItem
  quantity: number
}

export interface Benefit {
  title: string
  applies: boolean
  /** What the cashier does (hand over a gift, discount) or why it does not apply yet. */
  note: string
  /** Bs taken off the total. */
  discount: number
}

export interface RedemptionBenefit extends Benefit {
  redemption: Redemption
  reward: Reward | undefined
}

export interface BirthdayBenefit extends Benefit {
  perk: BirthdayPerk
}

export interface CheckoutQuote {
  subtotal: number
  redemptions: RedemptionBenefit[]
  birthday: BirthdayBenefit[]
  discount: number
  total: number
}

const cents = (n: number) => Math.round(n * 100) / 100

export const sameCategory = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && normalizeText(a.trim()) === normalizeText(b.trim())

/** Groups used in a business catalog, for the catalog form and the birthday discount scope. */
export function catalogCategories(db: Database, businessId: number): string[] {
  const seen = new Map<string, string>()
  for (const item of db.catalogItems) {
    if (item.businessId !== businessId || item.deletedAt !== null || !item.category?.trim()) continue
    const key = normalizeText(item.category.trim())
    if (!seen.has(key)) seen.set(key, item.category.trim())
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

const itemName = (db: Database, id: number | null) => db.catalogItems.find((i) => i.id === id)?.name

/** How the customer and the cashier read a birthday benefit. */
export function birthdayPerkTitle(db: Database, perk: BirthdayPerk): string {
  const base = rewardTitle(db, perk)
  if (perk.type === 'FREE_PRODUCT') return base
  switch (perk.discountScope) {
    case 'PRODUCT':
      return `${base} en ${itemName(db, perk.targetItemId) ?? 'un producto'} (1 unidad)`
    case 'CATEGORY':
      return `${base} en 1 producto de ${perk.targetCategory ?? 'una categoría'}`
    default:
      return `${base} en toda la compra`
  }
}

/** Condition to get a birthday gift; discounts have none. */
export function birthdayPerkCondition(db: Database, perk: BirthdayPerk): string | null {
  if (perk.type !== 'FREE_PRODUCT') return null
  if (perk.giftCondition === 'PRODUCT') return `Al comprar ${itemName(db, perk.requiredItemId) ?? 'el producto indicado'}`
  return perk.minimumPurchase ? `Con compras desde ${formatMoney(perk.minimumPurchase)}` : 'Con una compra mínima'
}

/** Active birthday benefits of a business. */
export function birthdayPerksOf(db: Database, businessId: number): BirthdayPerk[] {
  return db.birthdayPerks.filter((p) => p.businessId === businessId && p.isActive).sort((a, b) => a.id - b.id)
}

export function birthdayUsedAt(db: Database, userId: number, businessId: number, year: number): boolean {
  return db.birthdayClaims.some((c) => c.userId === userId && c.businessId === businessId && c.year === year)
}

/** Canjes of a customer that can be used today at a business. */
export function usableRedemptions(db: Database, userId: number, businessId: number, now = new Date()): Redemption[] {
  return db.redemptions
    .filter(
      (r) =>
        r.userId === userId &&
        r.status === 'PENDING' &&
        db.rewards.find((x) => x.id === r.rewardId)?.businessId === businessId &&
        redemptionExpiresAt(db, r.createdAt, r.expiresAt).getTime() > now.getTime(),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

function checkPerk(db: Database, perk: BirthdayPerk, lines: CheckoutLine[], subtotal: number): Benefit {
  const title = birthdayPerkTitle(db, perk)
  if (perk.type === 'FREE_PRODUCT') {
    const gift = db.catalogItems.find((i) => i.id === perk.catalogItemId && i.deletedAt === null)
    if (!gift) return { title, applies: false, note: 'El producto de regalo ya no está en el catálogo', discount: 0 }
    const handOver = `Entrega ${perk.quantity > 1 ? `${perk.quantity} × ` : ''}${gift.name} sin costo`
    if (perk.giftCondition === 'PRODUCT') {
      const bought = lines.some((l) => l.item.id === perk.requiredItemId)
      return bought
        ? { title, applies: true, note: handOver, discount: 0 }
        : { title, applies: false, note: `Aplica si compra ${itemName(db, perk.requiredItemId) ?? 'el producto indicado'}`, discount: 0 }
    }
    const minimum = perk.minimumPurchase ?? 0
    return subtotal >= minimum && subtotal > 0
      ? { title, applies: true, note: handOver, discount: 0 }
      : { title, applies: false, note: `Compra desde ${formatMoney(minimum)} · faltan ${formatMoney(cents(minimum - subtotal))}`, discount: 0 }
  }

  let base = 0
  let target = 'toda la compra'
  if (perk.discountScope === 'PRODUCT') {
    const line = lines.find((l) => l.item.id === perk.targetItemId)
    if (!line) return { title, applies: false, note: `Aplica si compra ${itemName(db, perk.targetItemId) ?? 'el producto indicado'}`, discount: 0 }
    base = line.item.price
    target = line.item.name
  } else if (perk.discountScope === 'CATEGORY') {
    const line = lines.filter((l) => sameCategory(l.item.category, perk.targetCategory)).sort((a, b) => b.item.price - a.item.price)[0]
    if (!line) return { title, applies: false, note: `Aplica si compra algo de ${perk.targetCategory ?? 'la categoría'}`, discount: 0 }
    base = line.item.price
    target = line.item.name
  } else {
    if (subtotal <= 0) return { title, applies: false, note: 'Agrega productos a la compra', discount: 0 }
    base = subtotal
  }
  const discount = perk.type === 'PERCENT_DISCOUNT' ? cents((base * (perk.discountPercent ?? 0)) / 100) : Math.min(perk.discountAmount ?? 0, base)
  return { title, applies: true, note: `−${formatMoney(discount)} en ${target}`, discount }
}

function checkReward(db: Database, reward: Reward | undefined, lines: CheckoutLine[], subtotal: number): Omit<Benefit, 'discount'> {
  if (!reward) return { title: 'Recompensa', applies: false, note: 'La recompensa ya no existe' }
  const title = rewardTitle(db, reward)
  if (reward.type === 'FREE_PRODUCT') {
    const item = itemName(db, reward.catalogItemId) ?? 'el producto'
    return { title, applies: true, note: `Entrega ${reward.quantity > 1 ? `${reward.quantity} × ` : ''}${item} sin costo` }
  }
  if (lines.length === 0) return { title, applies: false, note: 'Agrega productos a la compra' }
  if (reward.minimumPurchase && subtotal < reward.minimumPurchase) {
    return { title, applies: false, note: `Compra desde ${formatMoney(reward.minimumPurchase)} · faltan ${formatMoney(cents(reward.minimumPurchase - subtotal))}` }
  }
  return { title, applies: true, note: 'Se descuenta del total' }
}

/**
 * Applies birthday benefits first (each on its own products) and then the chosen canjes on what is left.
 * Benefits that do not apply give no discount; the total never goes below zero.
 */
export function quoteCheckout(
  db: Database,
  input: { lines: CheckoutLine[]; redemptions: Redemption[]; birthdayPerks: BirthdayPerk[] },
): CheckoutQuote {
  const subtotal = cents(input.lines.reduce((s, l) => s + l.item.price * l.quantity, 0))
  let remaining = subtotal

  const birthday = input.birthdayPerks.map((perk): BirthdayBenefit => {
    const check = checkPerk(db, perk, input.lines, subtotal)
    const discount = check.applies ? cents(Math.min(check.discount, remaining)) : 0
    remaining = cents(remaining - discount)
    return { ...check, discount, perk }
  })

  const redemptions = input.redemptions.map((redemption): RedemptionBenefit => {
    const reward = db.rewards.find((x) => x.id === redemption.rewardId)
    const check = checkReward(db, reward, input.lines, subtotal)
    let discount = 0
    if (check.applies && reward?.type === 'PERCENT_DISCOUNT') discount = cents((remaining * (reward.discountPercent ?? 0)) / 100)
    if (check.applies && reward?.type === 'AMOUNT_DISCOUNT') discount = Math.min(reward.discountAmount ?? 0, remaining)
    remaining = cents(remaining - discount)
    return { ...check, discount, redemption, reward }
  })

  return { subtotal, redemptions, birthday, discount: cents(subtotal - remaining), total: remaining }
}
