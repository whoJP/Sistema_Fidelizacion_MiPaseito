import { useState } from 'react'
import { useDb } from '../../data/store'
import { rewardTitle } from '../../domain/loyalty'
import { FRAUD_TYPE_LABELS, formatDateTime, formatMoney, fullName } from '../../lib/format'
import type { FraudAlert, FraudAlertStatus, FraudAlertType } from '../../types/domain'
import { Badge, Card, Empty, PageHeader, run, vanish } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'

const STATUS_LABEL: Record<FraudAlertStatus, string> = { OPEN: 'Por revisar', RESOLVED: 'Confirmadas', DISMISSED: 'Descartadas' }

/** Why each rule fires and what happens meanwhile, in plain words. */
const WHY: Record<FraudAlertType, string> = {
  DUPLICATE_TRANSACTION: 'Mismo cliente, tienda y monto en 10 min · puntos retenidos',
  ABNORMAL_AMOUNT: 'Monto sobre el límite · puntos retenidos',
  HIGH_FREQUENCY: 'Más de 5 compras en una hora · solo aviso',
  REUSED_REDEMPTION: 'Código de canje ya usado',
  CHECK_IN_ONLY: 'Visita espacios pero nunca compró · solo aviso',
}

const riskTone = (score: number) => (score >= 80 ? 'danger' : score >= 60 ? 'warning' : 'neutral')
const riskText = (score: number) => (score >= 80 ? 'Alto' : score >= 60 ? 'Medio' : 'Bajo')

export function AdminFraud() {
  const db = useDb()
  const [filter, setFilter] = useState<FraudAlertStatus>('OPEN')
  const alerts = db.fraudAlerts.filter((a) => a.status === filter).sort((a, b) => b.riskScore - a.riskScore || b.id - a.id)

  // User and business are reached through Transaction/Redemption, not stored on the alert.
  const context = (a: FraudAlert) => {
    const tx = a.transactionId ? db.transactions.find((t) => t.id === a.transactionId) : undefined
    const red = a.redemptionId ? db.redemptions.find((r) => r.id === a.redemptionId) : undefined
    const userId = tx?.customerId ?? red?.userId
    const businessId = tx?.businessId ?? red?.businessId
    return {
      tx,
      red,
      user: db.users.find((u) => u.id === userId),
      business: db.businesses.find((b) => b.id === businessId),
      reward: red ? db.rewards.find((r) => r.id === red.rewardId) : undefined,
    }
  }

  const review = async (a: FraudAlert, decision: 'RESOLVED' | 'DISMISSED', held: boolean, row: HTMLElement) => {
    const confirmFraud = decision === 'RESOLVED'
    const ok = await confirmDialog({
      title: confirmFraud ? '¿Confirmar fraude?' : '¿Descartar la alerta?',
      message: confirmFraud
        ? held
          ? 'La compra se anula y el cliente no recibe puntos.'
          : 'Queda confirmada; los puntos no cambian.'
        : held
          ? 'La compra se aprueba y el cliente recibe sus puntos.'
          : 'Se archiva sin cambios.',
      confirmLabel: confirmFraud ? 'Confirmar fraude' : 'Descartar alerta',
      tone: confirmFraud ? 'danger' : 'primary',
    })
    if (ok) void vanish(row, () => run('reviewFraudAlert', { alertId: a.id, decision }, confirmFraud ? 'Alerta confirmada' : 'Alerta descartada'))
  }

  return (
    <div className="page">
      <PageHeader
        title="Alertas de fraude"
        subtitle="Confirmar anula · descartar aprueba"
      />
      <Card>
        <div className="legend small">
          <span>
            <b>Nivel de riesgo</b> (0 a 100, según la regla que se activó):
          </span>
          <span>
            <Badge tone="danger">Alto · 80+</Badge> revisa primero
          </span>
          <span>
            <Badge tone="warning">Medio · 60-79</Badge> revisa hoy
          </span>
          <span>
            <Badge>Bajo · menos de 60</Badge> aviso informativo
          </span>
        </div>
      </Card>
      <div className="tabs">
        {(Object.keys(STATUS_LABEL) as FraudAlertStatus[]).map((s) => (
          <button key={s} className={filter === s ? 'tab tab-active' : 'tab'} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]} ({db.fraudAlerts.filter((a) => a.status === s).length})
          </button>
        ))}
      </div>
      <Card>
        {alerts.length === 0 ? (
          <Empty>No hay alertas en esta vista.</Empty>
        ) : (
          <ul className="list">
            {alerts.map((a) => {
              const { tx, red, user, business, reward } = context(a)
              const held = tx?.status === 'FLAGGED'
              return (
                <li key={a.id} className="list-row align-start">
                  <div className="stack-sm">
                    <div className="row gap">
                      <strong>{FRAUD_TYPE_LABELS[a.type]}</strong>
                      <Badge tone={riskTone(a.riskScore)}>
                        Riesgo {riskText(a.riskScore)} · {a.riskScore}
                      </Badge>
                    </div>
                    <span className="small muted">{WHY[a.type]}</span>
                    <span className="small muted">
                      {formatDateTime(a.createdAt)} · {user ? fullName(user) : 'Cliente desconocido'}
                      {business && ` · ${business.name}`}
                    </span>
                    {tx && (
                      <span className="small">
                        Compra de {formatMoney(tx.amount)}: {held ? 'puntos retenidos' : tx.status === 'COMPLETED' ? 'puntos acreditados' : 'anulada'}
                      </span>
                    )}
                    {red && (
                      <span className="small">
                        Canje {red.verificationToken} ({reward ? rewardTitle(db, reward) : 'recompensa'})
                      </span>
                    )}
                  </div>
                  {a.status === 'OPEN' && (
                    <div className="row gap">
                      <button className="btn btn-sm danger-solid" onClick={(e) => review(a, 'RESOLVED', held, e.currentTarget)}>
                        Confirmar fraude
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => review(a, 'DISMISSED', held, e.currentTarget)}>
                        Descartar
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
