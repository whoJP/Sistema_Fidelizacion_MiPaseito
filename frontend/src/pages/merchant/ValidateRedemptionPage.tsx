import { useState, type FormEvent } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useDb } from '../../data/store'
import { rewardConditions, rewardTitle } from '../../domain/loyalty'
import { formatDateTime, formatInt, fullName } from '../../lib/format'
import type { Redemption } from '../../types/domain'
import { Card, Empty, Field, PageHeader, notify, run } from '../../components/ui'
import { useWorkplace } from './useWorkplace'

export function ValidateRedemptionPage() {
  const db = useDb()
  const { business } = useWorkplace()
  const [token, setToken] = useState('')
  const [last, setLast] = useState<Redemption | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const result = await run('validateRedemption', { token, businessId: business.id })
    setBusy(false)
    if (!result) return
    if (result.reused) {
      notify('error', 'Este canje ya fue utilizado. Se generó una alerta de fraude.')
      setLast(null)
      return
    }
    notify('success', 'Canje validado')
    setLast(result.redemption)
    setToken('')
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

  return (
    <div className="page">
      <PageHeader title="Validar canje" subtitle={business.name} />
      <div className="detail-grid">
        <div className="stack">
          <Card>
            <form className="stack" onSubmit={submit}>
              <Field label="Código de canje" hint="El cliente lo encuentra en Recompensas, sección Mis canjes.">
                <input
                  className="mono"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  placeholder="XXXXX-XXXXX"
                  autoFocus
                />
              </Field>
              <button className="btn btn-primary" type="submit" disabled={!token.trim() || busy}>
                Validar
              </button>
            </form>
          </Card>
          {last && (
            <Card className="card-success">
              <h2 className="row gap">
                <CheckCircle2 size={20} /> Entregar: {describe(last).title}
              </h2>
              {describe(last).reward &&
                [...rewardConditions(db, describe(last).reward!), describe(last).reward!.description].filter(Boolean).map((c) => (
                  <p key={c} className="small">
                    {c}
                  </p>
                ))}
              <p>
                Cliente: <b>{describe(last).customer && fullName(describe(last).customer!)}</b> · {formatInt(last.pointsSpent)} puntos
              </p>
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
