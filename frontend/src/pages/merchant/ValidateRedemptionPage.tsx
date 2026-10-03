import { useState } from 'react'
import { CheckCircle2, Gift } from 'lucide-react'
import { useDb } from '../../data/store'
import { rewardConditions, rewardTitle } from '../../domain/loyalty'
import { formatDateTime, fullName } from '../../lib/format'
import type { Redemption } from '../../types/domain'
import { Card, Empty, PageHeader, notify, run } from '../../components/ui'
import { ScanOrCode } from '../../components/ScanOrCode'
import { useWorkplace } from './useWorkplace'

const WRONG_QR = 'Ese es el código de socio del cliente, no el del canje. Pídele que abra Recompensas › Mis canjes y te muestre ese QR.'

export function ValidateRedemptionPage() {
  const db = useDb()
  const { business } = useWorkplace()
  const [last, setLast] = useState<Redemption | null>(null)
  const [busy, setBusy] = useState(false)

  const validate = async (code: string) => {
    const value = code.trim().toUpperCase()
    if (!value || busy) return false
    if (value.startsWith('PP1.') || /^\d{3}\s?\d{3}$/.test(value)) {
      notify('error', WRONG_QR)
      return false
    }
    setBusy(true)
    const result = await run('validateRedemption', { token: value, businessId: business.id })
    setBusy(false)
    if (!result) return false
    if (result.reused) {
      notify('error', 'Este canje ya fue utilizado. Se generó una alerta de fraude.')
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
      <PageHeader title="Validar canje" subtitle={`${business.name} · El cliente te muestra el QR de su canje; al validarlo, entrégale la recompensa.`} />
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
          <Card>
            <h2 className="card-title">
              <Gift size={18} aria-hidden /> Canje del cliente
            </h2>
            <ScanOrCode kind="redemption" onSubmit={validate} busy={busy} scanLabel="Apunta la cámara al QR del canje que muestra el cliente" />
          </Card>
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
