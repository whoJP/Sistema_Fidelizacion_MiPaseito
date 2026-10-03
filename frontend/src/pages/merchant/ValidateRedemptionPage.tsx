import { useState } from 'react'
import { CheckCircle2, Gift, Ticket, UserRound } from 'lucide-react'
import { ApiError, api, type IdentifiedCustomer } from '../../data/api'
import { useDb } from '../../data/store'
import { redemptionExpiresAt } from '../../data/actions'
import { rewardConditions, rewardTitle } from '../../domain/loyalty'
import { formatCountdown, formatDateTime, formatInt, fullName, plural } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import type { Redemption } from '../../types/domain'
import { Badge, Card, Empty, PageHeader, notify, run } from '../../components/ui'
import { ScanOrCode } from '../../components/ScanOrCode'
import { useWorkplace } from './useWorkplace'

const ORIGIN_LABEL: Record<Exclude<Redemption['origin'], 'POINTS'>, string> = {
  PRIZE: 'Premio de la ruleta',
  BIRTHDAY: 'Regalo de cumpleaños',
}

const STATUS_LABEL: Record<Exclude<Redemption['status'], 'PENDING'>, [string, 'success' | 'neutral' | 'danger']> = {
  REDEEMED: ['Canjeado', 'success'],
  EXPIRED: ['Expirado', 'neutral'],
  CANCELLED: ['Cancelado', 'danger'],
}

const LONG_VALIDITY_MS = 60 * 60_000

const isCustomerQr = (value: string) => value.toUpperCase().startsWith('PP1.') || /^\d{3}\s?\d{3}$/.test(value)

export function ValidateRedemptionPage() {
  const db = useDb()
  const { business } = useWorkplace()
  const [last, setLast] = useState<Redemption | null>(null)
  const [customer, setCustomer] = useState<IdentifiedCustomer | null>(null)
  const [busy, setBusy] = useState(false)

  const identify = async (code: string) => {
    setBusy(true)
    try {
      const found = await api.identifyCustomer(code)
      setCustomer(found)
      setLast(null)
      return true
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
      return false
    } finally {
      setBusy(false)
    }
  }

  const validate = async (code: string) => {
    const value = code.trim()
    if (!value || busy) return false
    if (isCustomerQr(value)) return identify(value)
    setBusy(true)
    const result = await run('validateRedemption', { token: value.toUpperCase(), businessId: business.id })
    setBusy(false)
    if (!result) return false
    if (result.repeated) {
      notify('error', 'Ya validado. No lo entregues otra vez.')
      return false
    }
    if (result.reused) {
      notify('error', 'Este canje ya fue usado.')
      setLast(null)
      return false
    }
    notify('success', 'Canje validado')
    setLast(result.redemption)
    return true
  }

  const recent = db.redemptions
    .filter((r) => r.businessId === business.id && r.status === 'REDEEMED')
    .sort((a, b) => (b.redeemedAt ?? '').localeCompare(a.redeemedAt ?? ''))
    .slice(0, 15)

  const describe = (r: Redemption) => {
    const reward = db.rewards.find((x) => x.id === r.rewardId)
    const customer = db.users.find((u) => u.id === r.userId)
    return { reward, title: reward ? rewardTitle(db, reward) : 'Recompensa', customer }
  }
  const delivered = last && describe(last)

  return (
    <div className="page">
      <PageHeader
        title="Validar canje"
        subtitle={business.name}
      />
      <div className="detail-grid">
        <div className="stack">
          {last && delivered && (
            <Card className="card-success">
              <h2 className="row gap">
                <CheckCircle2 size={20} /> Entrega: {delivered.title}
              </h2>
              {delivered.reward &&
                [...rewardConditions(db, delivered.reward), delivered.reward.description].filter(Boolean).map((c) => (
                  <p key={c} className="small">
                    {c}
                  </p>
                ))}
              <p>
                Cliente: <b>{delivered.customer && fullName(delivered.customer)}</b>
              </p>
              <button type="button" className="btn btn-sm align-start" onClick={() => setLast(null)}>
                Validar otro canje
              </button>
            </Card>
          )}
          {customer ? (
            <CustomerCoupons customer={customer} busy={busy} onValidate={validate} onClose={() => setCustomer(null)} />
          ) : (
            <Card>
              <h2 className="card-title">
                <Gift size={18} aria-hidden /> Tarjeta del cliente
              </h2>
              <ScanOrCode kind="redemption" onSubmit={validate} busy={busy} scanLabel="Escanea el QR del cliente" />
            </Card>
          )}
        </div>

        <Card>
          <h2>Últimos canjes validados aquí</h2>
          {recent.length === 0 ? (
            <Empty>Sin canjes todavía.</Empty>
          ) : (
            <ul className="list">
              {recent.map((r) => {
                const { title, customer } = describe(r)
                return (
                  <li key={r.id} className="list-row">
                    <div>
                      <strong>{title}</strong>
                      <div className="muted small">
                        {customer && fullName(customer)} · {r.redeemedAt && formatDateTime(r.redeemedAt)}
                      </div>
                    </div>
                    <code className="small">{r.verificationToken}</code>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

/** Coupons of a customer identified by their member QR: the ones for this business can be validated right here. */
function CustomerCoupons({
  customer,
  busy,
  onValidate,
  onClose,
}: {
  customer: IdentifiedCustomer
  busy: boolean
  onValidate: (token: string) => Promise<boolean>
  onClose: () => void
}) {
  const db = useDb()
  const { business } = useWorkplace()
  const now = useNow(1000)
  const tokens = new Map(customer.coupons.map((c) => [c.redemptionId, c.token]))
  const here = customer.coupons.flatMap((c) => db.redemptions.find((r) => r.id === c.redemptionId) ?? [])
  const elsewhere = db.redemptions.filter((r) => {
    if (r.userId !== customer.id || r.status !== 'PENDING' || tokens.has(r.id)) return false
    const reward = db.rewards.find((x) => x.id === r.rewardId)
    return reward?.businessId !== business.id && redemptionExpiresAt(db, r.createdAt, r.expiresAt).getTime() > now
  })
  const elsewhereNames = [
    ...new Set(elsewhere.map((r) => db.businesses.find((b) => b.id === db.rewards.find((x) => x.id === r.rewardId)?.businessId)?.name).filter(Boolean)),
  ]

  return (
    <Card>
      <div className="identified">
        <span className="avatar">
          <UserRound size={18} aria-hidden />
        </span>
        <div className="identified-name">
          <strong>{fullName(customer)}</strong>
          <span className="muted small">{customer.email}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Cambiar
        </button>
      </div>

      <h2 className="card-title">
        <Ticket size={18} aria-hidden /> Cupones para {business.name}
      </h2>
      {here.length === 0 ? (
        <Empty>Sin cupones para este local.</Empty>
      ) : (
        <ul className="list">
          {here.map((r) => {
            const reward = db.rewards.find((x) => x.id === r.rewardId)
            const expires = redemptionExpiresAt(db, r.createdAt, r.expiresAt).getTime()
            const pending = r.status === 'PENDING' && expires > now
            const [label, tone] = r.status === 'PENDING' ? STATUS_LABEL.EXPIRED : STATUS_LABEL[r.status]
            return (
              <li key={r.id} className="list-row">
                <div>
                  <strong>{reward ? rewardTitle(db, reward) : 'Recompensa'}</strong>
                  <div className="muted small">
                    {r.origin === 'POINTS' ? `${formatInt(r.pointsSpent)} puntos` : ORIGIN_LABEL[r.origin]}
                    {pending &&
                      (expires - now > LONG_VALIDITY_MS
                        ? ` · válido hasta el ${formatDateTime(new Date(expires).toISOString())}`
                        : ` · vence en ${formatCountdown(expires - now)}`)}
                  </div>
                </div>
                {pending ? (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onValidate(tokens.get(r.id) ?? '')}>
                    Validar
                  </button>
                ) : (
                  <Badge tone={tone}>{label}</Badge>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {elsewhereNames.length > 0 && (
        <p className="muted small">
          También {plural(elsewhere.length, 'cupón', 'cupones')} de {elsewhereNames.join(', ')}, solo allí.
        </p>
      )}
    </Card>
  )
}
