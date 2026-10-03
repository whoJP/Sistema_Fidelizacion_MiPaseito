import { useState, type FormEvent } from 'react'
import { CheckCircle2, AlertTriangle, UserRound } from 'lucide-react'
import { ApiError, api, type IdentifiedCustomer } from '../../data/api'
import { useDb } from '../../data/store'
import type { PurchaseResult } from '../../data/actions'
import { currentTier, quotePurchase } from '../../domain/loyalty'
import { formatInt, formatMoney, fullName } from '../../lib/format'
import { Badge, Card, Field, PageHeader, notify, run } from '../../components/ui'
import { useWorkplace } from './useWorkplace'

export function RegisterPurchasePage() {
  const db = useDb()
  const { business } = useWorkplace()
  const [code, setCode] = useState('')
  const [customer, setCustomer] = useState<IdentifiedCustomer | null>(null)
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<PurchaseResult | null>(null)
  const [busy, setBusy] = useState(false)

  const identify = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      setCustomer(await api.identifyCustomer(code.trim()))
      setResult(null)
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  const numericAmount = Number(amount.replace(',', '.'))
  const quote = customer && numericAmount > 0 ? quotePurchase(db, customer.id, business.id, numericAmount) : null
  const tier = customer ? currentTier(db, customer.id) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!customer) return
    setBusy(true)
    const r = await run('registerPurchase', { customerId: customer.id, businessId: business.id, amount: numericAmount })
    setBusy(false)
    if (r) {
      setResult(r)
      notify(r.flagged ? 'error' : 'success', r.flagged ? 'Compra registrada, enviada a revisión' : 'Compra registrada')
      setAmount('')
    }
  }

  const reset = () => {
    setCustomer(null)
    setCode('')
    setAmount('')
    setResult(null)
  }

  return (
    <div className="page">
      <PageHeader title="Registrar compra" subtitle={business.name} />

      <div className="detail-grid">
        <div className="stack">
          <Card>
            <h2 className="card-title">
              <span className="step-num">1</span> Identificar cliente
            </h2>
            {customer ? (
              <div className="list-row">
                <div className="row gap">
                  <span className="avatar">
                    <UserRound size={18} />
                  </span>
                  <div>
                    <strong>{fullName(customer)}</strong>
                    <div className="muted small">{customer.email}</div>
                  </div>
                </div>
                <div className="row gap">
                  {tier && <span className={`tier-chip tier-${tier.name.toLowerCase()}`}>{tier.name}</span>}
                  <button className="btn btn-ghost btn-sm" onClick={reset}>
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              <form className="stack" onSubmit={identify}>
                <Field label="Código del cliente o correo" hint="Escanea o pega el código QR que muestra la app del cliente (PP1…), o escribe su correo.">
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PP1.… o cliente@correo.com" autoFocus />
                </Field>
                <button className="btn btn-primary" type="submit" disabled={!code.trim() || busy}>
                  Buscar cliente
                </button>
              </form>
            )}
          </Card>

          <Card className={customer ? '' : 'disabled'}>
            <h2 className="card-title">
              <span className="step-num">2</span> Monto de la compra
            </h2>
            <form className="stack" onSubmit={submit}>
              <Field label="Monto (Bs)">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={!customer}
                />
              </Field>
              <button className="btn btn-primary" type="submit" disabled={!customer || !(numericAmount > 0) || busy}>
                Registrar {numericAmount > 0 ? formatMoney(numericAmount) : ''}
              </button>
            </form>
          </Card>
        </div>

        <div className="stack">
          {quote && (
            <Card>
              <h2>Vista previa</h2>
              <ul className="list">
                <li className="list-row">
                  <span>Puntos base{quote.tierMultiplier !== 1 ? ` (×${quote.tierMultiplier} por nivel)` : ''}</span>
                  <strong>{formatInt(quote.basePoints)}</strong>
                </li>
                {quote.promotionBonuses.map((b) => (
                  <li key={b.promotion.id} className="list-row">
                    <span>{b.promotion.name}</span>
                    <strong className="accent">+{formatInt(b.points)}</strong>
                  </li>
                ))}
                <li className="list-row">
                  <span>Puntos de nivel</span>
                  <strong>+{formatInt(quote.statusPoints)}</strong>
                </li>
                <li className="list-row total">
                  <span>Total de puntos</span>
                  <strong>{formatInt(quote.totalPoints)}</strong>
                </li>
              </ul>
              <p className="muted small">Bonos de descubrimiento, racha y misiones se calculan al registrar.</p>
            </Card>
          )}

          {result && (
            <Card className={result.flagged ? 'card-warning' : 'card-success'}>
              {result.flagged ? (
                <>
                  <h2 className="row gap">
                    <AlertTriangle size={20} /> Enviada a revisión
                  </h2>
                  <p>La compra se registró pero quedó marcada por el sistema antifraude. Los puntos se acreditarán si la administración la aprueba.</p>
                </>
              ) : (
                <>
                  <h2 className="row gap">
                    <CheckCircle2 size={20} /> Compra registrada
                  </h2>
                  <p>
                    {customer?.firstName} ganó <b>{formatInt(result.pointsEarned)} puntos</b> y <b>{formatInt(result.statusEarned)} puntos de nivel</b>.
                  </p>
                  <div className="row gap wrap">
                    {result.discovered && <Badge tone="success">Nuevo sello en su Pasaporte</Badge>}
                    {result.completedMissions.map((m) => (
                      <Badge key={m.id} tone="accent">
                        Misión completada: {m.name}
                      </Badge>
                    ))}
                    {result.newBadges.map((name) => (
                      <Badge key={name} tone="success">
                        Nueva insignia: {name}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
