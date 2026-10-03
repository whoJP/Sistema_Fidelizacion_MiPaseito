import { useState } from 'react'
import { useDb } from '../../data/store'
import { rewardTitle, type SettingKey } from '../../domain/loyalty'
import { FRAUD_TYPE_LABELS, formatDateTime, formatInt, formatMoney, fullName, signed } from '../../lib/format'
import type { AuditLog, Database } from '../../types/domain'
import { Card, Empty, Field, PageHeader } from '../../components/ui'
import { SETTINGS } from './settingsInfo'

type Area = 'purchases' | 'users' | 'program' | 'events' | 'settings'

const AREAS: Record<Area, string> = {
  purchases: 'Compras y fraude',
  users: 'Usuarios y personal',
  program: 'Programa (tiendas, niveles, misiones…)',
  events: 'Eventos e insignias',
  settings: 'Configuración',
}

const ENTITY_LABELS: Record<string, string> = {
  Transaction: 'compra',
  FraudAlert: 'alerta de fraude',
  User: 'usuario',
  Business: 'establecimiento',
  Category: 'categoría',
  Tier: 'nivel',
  Reward: 'recompensa',
  Mission: 'misión',
  Promotion: 'promoción',
  CatalogItem: 'producto',
  Event: 'evento',
  Badge: 'insignia',
  SystemSetting: 'configuración',
}

function areaOf(log: AuditLog): Area {
  if (['Transaction', 'FraudAlert'].includes(log.entityType)) return 'purchases'
  if (log.entityType === 'User' || log.action.startsWith('MEMBER_')) return 'users'
  if (['Event', 'Badge'].includes(log.entityType)) return 'events'
  if (log.entityType === 'SystemSetting') return 'settings'
  return 'program'
}

function describe(log: AuditLog): string {
  const entity = ENTITY_LABELS[log.entityType] ?? log.entityType
  if (log.action.endsWith('_CREATED')) return `Creó ${entity}`
  if (log.action.endsWith('_UPDATED')) return `Editó ${entity}`
  if (log.action.startsWith('SETTING_UPDATED')) return 'Cambió la configuración'
  switch (log.action) {
    case 'TRANSACTION_CANCELLED':
      return 'Anuló una compra'
    case 'FRAUD_ALERT_RESOLVED':
      return 'Confirmó una alerta de fraude'
    case 'FRAUD_ALERT_DISMISSED':
      return 'Descartó una alerta de fraude'
    case 'POINTS_ADJUSTMENT':
      return 'Ajustó puntos'
    case 'STATUS_ADJUSTMENT':
      return 'Ajustó puntos de nivel'
    case 'EVENT_CHECK_IN':
      return 'Registró un ingreso al evento'
    case 'SOFT_DELETED':
      return `Eliminó ${entity}`
    case 'USER_SUSPENDED':
      return 'Suspendió al usuario'
    case 'USER_REACTIVATED':
      return 'Reactivó al usuario'
    case 'MEMBER_SAVED':
      return 'Asignó personal a'
    case 'MEMBER_DEACTIVATED':
      return 'Quitó personal de'
    default:
      return log.action
  }
}

function target(db: Database, log: AuditLog): string {
  const id = log.entityId
  switch (log.entityType) {
    case 'Transaction': {
      const t = db.transactions.find((x) => x.id === id)
      if (!t) return `Compra #${id}`
      const customer = db.users.find((u) => u.id === t.customerId)
      return `${formatMoney(t.amount)} en ${db.businesses.find((b) => b.id === t.businessId)?.name ?? '?'}${customer ? ` · ${fullName(customer)}` : ''}`
    }
    case 'FraudAlert': {
      const a = db.fraudAlerts.find((x) => x.id === id)
      return a ? FRAUD_TYPE_LABELS[a.type] : `Alerta #${id}`
    }
    case 'User': {
      const u = db.users.find((x) => x.id === id)
      if (!u) return `Usuario #${id}`
      const movements = log.action === 'POINTS_ADJUSTMENT' ? db.pointMovements : log.action === 'STATUS_ADJUSTMENT' ? db.statusMovements : []
      const m = movements.find((x) => x.userId === id && x.type === 'ADJUSTMENT' && x.createdAt === log.createdAt)
      return m ? `${fullName(u)} (${signed(m.amount)})` : fullName(u)
    }
    case 'Business':
      return db.businesses.find((x) => x.id === id)?.name ?? `#${id}`
    case 'Category':
      return db.categories.find((x) => x.id === id)?.name ?? `#${id}`
    case 'Tier':
      return db.tiers.find((x) => x.id === id)?.name ?? `#${id}`
    case 'Reward': {
      const r = db.rewards.find((x) => x.id === id)
      return r ? `${rewardTitle(db, r)} · ${db.businesses.find((b) => b.id === r.businessId)?.name ?? ''}` : `#${id}`
    }
    case 'Mission':
      return db.missions.find((x) => x.id === id)?.name ?? `#${id}`
    case 'Promotion':
      return db.promotions.find((x) => x.id === id)?.name ?? `#${id}`
    case 'CatalogItem':
      return db.catalogItems.find((x) => x.id === id)?.name ?? `#${id}`
    case 'Event':
      return db.events.find((x) => x.id === id)?.name ?? `#${id}`
    case 'Badge':
      return db.badges.find((x) => x.id === id)?.name ?? `#${id}`
    case 'SystemSetting': {
      const key = log.action.split(':')[1] as SettingKey | undefined
      const value = key ? db.systemSettings.find((s) => s.key === key)?.value : undefined
      return key && SETTINGS[key] ? `${SETTINGS[key].label}${value ? ` (hoy: ${value})` : ''}` : 'Parámetro'
    }
    default:
      return `#${id}`
  }
}

const PAGE = 25

export function AdminAudit() {
  const db = useDb()
  const [userId, setUserId] = useState('')
  const [area, setArea] = useState('')
  const [text, setText] = useState('')
  const [page, setPage] = useState(0)

  const rows = [...db.auditLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map((log) => {
      const user = db.users.find((u) => u.id === log.userId)
      return { log, who: user ? fullName(user) : `Usuario #${log.userId}`, what: describe(log), on: target(db, log), area: areaOf(log) }
    })
  const query = text.trim().toLowerCase()
  const filtered = rows.filter(
    (r) =>
      (!userId || r.log.userId === Number(userId)) &&
      (!area || r.area === area) &&
      (!query || `${r.who} ${r.what} ${r.on}`.toLowerCase().includes(query)),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE)
  const actors = [...new Set(db.auditLogs.map((l) => l.userId))]
    .map((id) => db.users.find((u) => u.id === id))
    .filter((u) => u !== undefined)

  const filter = (fn: () => void) => {
    fn()
    setPage(0)
  }

  return (
    <div className="page">
      <PageHeader title="Auditoría" subtitle="Quién hizo cada cambio importante y cuándo. Este registro no se puede editar." />
      <Card>
        <div className="filters-row">
          <Field label="Buscar">
            <input value={text} onChange={(e) => filter(() => setText(e.target.value))} placeholder="Nombre, tienda, acción…" />
          </Field>
          <Field label="Persona">
            <select value={userId} onChange={(e) => filter(() => setUserId(e.target.value))}>
              <option value="">Todas</option>
              {actors.map((u) => (
                <option key={u.id} value={u.id}>
                  {fullName(u)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Área">
            <select value={area} onChange={(e) => filter(() => setArea(e.target.value))}>
              <option value="">Todas</option>
              {(Object.keys(AREAS) as Area[]).map((a) => (
                <option key={a} value={a}>
                  {AREAS[a]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <Empty>{rows.length === 0 ? 'Todavía no hay acciones registradas.' : 'Ninguna acción coincide con los filtros.'}</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Quién</th>
                    <th>Qué hizo</th>
                    <th>Sobre</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.log.id}>
                      <td className="small">{formatDateTime(r.log.createdAt)}</td>
                      <td>{r.who}</td>
                      <td>
                        {r.what}
                        <div className="muted small">{AREAS[r.area]}</div>
                      </td>
                      <td className="small">{r.on}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row between small muted">
              <span>
                {formatInt(filtered.length)} acciones · página {current + 1} de {pages}
              </span>
              <div className="row gap">
                <button className="btn btn-ghost btn-sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                  ← Anterior
                </button>
                <button className="btn btn-ghost btn-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                  Siguiente →
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
