import { useDb } from '../../data/store'
import { formatDateTime, formatMoney, fullName } from '../../lib/format'
import type { TransactionStatus } from '../../types/domain'
import { Badge, Card, Empty, PageHeader, Stat, run } from '../../components/ui'
import { useWorkplace } from './useWorkplace'

const STATUS: Record<TransactionStatus, [string, 'success' | 'warning' | 'danger']> = {
  COMPLETED: ['Completada', 'success'],
  FLAGGED: ['En revisión', 'warning'],
  CANCELLED: ['Anulada', 'danger'],
}

export function MerchantTransactionsPage() {
  const db = useDb()
  const { business, membership } = useWorkplace()
  const isManager = membership.role === 'MANAGER'

  const txs = db.transactions.filter((t) => t.businessId === business.id).sort((a, b) => b.id - a.id)
  const today = new Date().toDateString()
  const completed = txs.filter((t) => t.status === 'COMPLETED')
  const todayTxs = completed.filter((t) => new Date(t.createdAt).toDateString() === today)
  const customers = new Set(completed.map((t) => t.customerId))

  return (
    <div className="page">
      <PageHeader
        title="Movimientos"
        subtitle={`${business.name} · compras a las que se asignaron puntos. El encargado puede anular un registro hecho por error.`}
      />
      <div className="stats-row">
        <Stat label="Compras hoy" value={todayTxs.length} hint={formatMoney(todayTxs.reduce((s, t) => s + t.amount, 0))} />
        <Stat label="Ventas registradas" value={formatMoney(completed.reduce((s, t) => s + t.amount, 0))} hint={`${completed.length} compras`} />
        <Stat label="Clientes únicos" value={customers.size} />
      </div>
      <Card>
        {txs.length === 0 ? (
          <Empty>Aún no hay compras registradas.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Registró</th>
                  <th className="num">Monto</th>
                  <th>Estado</th>
                  {isManager && <th />}
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => {
                  const customer = db.users.find((u) => u.id === t.customerId)
                  const staff = db.users.find((u) => u.id === t.performedById)
                  const [label, tone] = STATUS[t.status]
                  return (
                    <tr key={t.id}>
                      <td className="muted">{t.id}</td>
                      <td>{formatDateTime(t.createdAt)}</td>
                      <td>{customer && fullName(customer)}</td>
                      <td>{staff?.firstName}</td>
                      <td className="num">{formatMoney(t.amount)}</td>
                      <td>
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      {isManager && (
                        <td>
                          {t.status === 'COMPLETED' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    '¿Anular este registro?\n\nÚsalo solo si se registró por error (monto o cliente equivocado). ' +
                                      'Se le quitarán al cliente los puntos, puntos de nivel y recompensas de misión que ganó con esta compra. ' +
                                      'No afecta la venta en tu caja.',
                                  )
                                ) {
                                  void run('cancelTransaction', { transactionId: t.id }, 'Compra anulada')
                                }
                              }}
                            >
                              Anular
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
