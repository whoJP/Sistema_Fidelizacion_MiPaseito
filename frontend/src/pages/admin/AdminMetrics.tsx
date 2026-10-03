import { useMemo, useState, type CSSProperties } from 'react'
import { Download } from 'lucide-react'
import { useDb } from '../../data/store'
import { computeMetrics, summaryCsv, transactionsCsv, type Breakdown, type Period } from '../../domain/metrics'
import { rewardTitle } from '../../domain/loyalty'
import { addDaysKey, todayKey } from '../../domain/time'
import { DAY_LABELS, DAYS_IN_ORDER, formatDateKey, formatInt, formatMoney } from '../../lib/format'
import { Card, Empty, Field, PageHeader, Progress, Stat } from '../../components/ui'

const pct = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')} %`
const dec = (n: number) => n.toFixed(1).replace('.', ',')

const PRESETS = [
  { id: '7', label: 'Últimos 7 días', days: 7 },
  { id: '30', label: 'Últimos 30 días', days: 30 },
  { id: '90', label: 'Últimos 90 días', days: 90 },
]

function presetPeriod(days: number): Period {
  const to = todayKey()
  return { from: addDaysKey(to, -(days - 1)), to }
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Change against the previous period of the same length. */
function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) return now > 0 ? <span className="small muted">sin datos del período anterior</span> : null
  const change = now / before - 1
  const tone = Math.abs(change) < 0.005 ? 'muted' : change > 0 ? 'positive' : 'negative'
  return (
    <span className={`small ${tone}`}>
      {change > 0 ? '▲' : change < 0 ? '▼' : '='} {pct(Math.abs(change))} vs período anterior
    </span>
  )
}

function BreakdownList({ rows, empty }: { rows: Breakdown[]; empty: string }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>
  const max = rows[0].sales || 1
  return (
    <ul className="list">
      {rows.map((r) => (
        <li key={r.key} className="mission-mini">
          <div className="row between">
            <strong>{r.label}</strong>
            <span className="small muted">
              {formatMoney(r.sales)} · {formatInt(r.purchases)} compras · {formatInt(r.customers)} clientes
            </span>
          </div>
          <Progress value={r.sales} max={max} />
        </li>
      ))}
    </ul>
  )
}

export function AdminMetrics() {
  const db = useDb()
  const [preset, setPreset] = useState<string | null>('30')
  const [period, setPeriod] = useState<Period>(() => presetPeriod(30))
  const m = useMemo(() => computeMetrics(db, period), [db, period])
  const c = m.current
  const p = m.previous

  const businessName = (id: number) => db.businesses.find((b) => b.id === id)?.name ?? '?'
  const maxDaily = Math.max(1, ...m.daily.map((d) => d.sales))
  const maxPeak = Math.max(1, ...m.peak.flat())
  const activeHours = m.peak[0].map((_, h) => h).filter((h) => m.peak.some((row) => row[h] > 0))
  const hours = activeHours.length
    ? Array.from({ length: Math.max(...activeHours) - Math.min(...activeHours) + 1 }, (_, i) => Math.min(...activeHours) + i)
    : []
  const busiest = m.peak
    .flatMap((row, d) => row.map((count, h) => ({ d, h, count })))
    .sort((a, b) => b.count - a.count)[0]

  const setRange = (next: Partial<Period>) => {
    setPreset(null)
    setPeriod({ ...period, ...next })
  }

  return (
    <div className="page">
      <PageHeader
        title="Métricas"
        subtitle={`Del ${formatDateKey(period.from)} al ${formatDateKey(period.to)}. Solo cuentan las compras completadas.`}
        actions={
          <div className="row gap wrap">
            <button className="btn btn-ghost" onClick={() => download(`metricas_${period.from}_${period.to}.csv`, summaryCsv(m))}>
              <Download size={16} /> Resumen (CSV)
            </button>
            <button className="btn btn-ghost" onClick={() => download(`compras_${period.from}_${period.to}.csv`, transactionsCsv(db, period))}>
              <Download size={16} /> Compras (CSV)
            </button>
          </div>
        }
      />

      <Card>
        <div className="filters-row">
          <div className="chips">
            {PRESETS.map((x) => (
              <button
                key={x.id}
                className={`chip ${preset === x.id ? 'chip-active' : ''}`}
                onClick={() => {
                  setPreset(x.id)
                  setPeriod(presetPeriod(x.days))
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
          <Field label="Desde">
            <input type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && setRange({ from: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <input type="date" value={period.to} min={period.from} onChange={(e) => e.target.value && setRange({ to: e.target.value })} />
          </Field>
        </div>
      </Card>

      <h2 className="section-title">Ventas y clientes</h2>
      <div className="grid-4">
        <Stat label="Ventas registradas" value={formatMoney(c.sales)} hint={<Delta now={c.sales} before={p.sales} />} />
        <Stat label="Compras" value={formatInt(c.purchases)} hint={<Delta now={c.purchases} before={p.purchases} />} />
        <Stat label="Ticket promedio" value={formatMoney(c.averageTicket)} hint={<Delta now={c.averageTicket} before={p.averageTicket} />} />
        <Stat label="Clientes activos" value={formatInt(c.activeCustomers)} hint={`${formatInt(c.newCustomers)} nuevos en el período`} />
        <Stat label="Frecuencia" value={`${dec(c.frequency)} compras`} hint="promedio por cliente activo" />
        <Stat label="Recurrencia" value={pct(c.recurrence)} hint="clientes con 2 o más compras" />
        <Stat label="Retención" value={pct(c.retention)} hint="clientes del período anterior que volvieron" />
        <Stat label="Clientes en 2+ tiendas" value={pct(m.cross.multiStoreShare)} hint={`${dec(m.cross.averageBusinessesPerCustomer)} tiendas por cliente`} />
      </div>

      <Card>
        <h2>Ventas por día</h2>
        {c.purchases === 0 ? (
          <Empty>Sin compras en el período.</Empty>
        ) : (
          <div className="bars" role="img" aria-label="Ventas por día">
            {m.daily.map((d) => (
              <div key={d.date} className="bar" title={`${formatDateKey(d.date)}: ${formatMoney(d.sales)} · ${d.purchases} compras`}>
                <span className="bar-fill" style={{ height: `${(d.sales / maxDaily) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid-2">
        <Card>
          <h2>Tráfico por piso</h2>
          <BreakdownList rows={m.byFloor} empty="Sin compras en el período." />
        </Card>
        <Card>
          <h2>Tráfico por categoría</h2>
          <BreakdownList rows={m.byCategory} empty="Sin compras en el período." />
        </Card>
      </div>

      <Card>
        <h2>Establecimientos</h2>
        {m.byBusiness.length === 0 ? (
          <Empty>Sin compras en el período.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Establecimiento</th>
                  <th className="num">Compras</th>
                  <th className="num">Ventas</th>
                  <th className="num">Ticket promedio</th>
                  <th className="num">Clientes</th>
                </tr>
              </thead>
              <tbody>
                {m.byBusiness.map((b) => (
                  <tr key={b.key}>
                    <td>{b.label}</td>
                    <td className="num">{formatInt(b.purchases)}</td>
                    <td className="num">{formatMoney(b.sales)}</td>
                    <td className="num">{formatMoney(b.averageTicket)}</td>
                    <td className="num">{formatInt(b.customers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className="section-title">Puntos y canjes</h2>
      <div className="grid-4">
        <Stat label="Puntos entregados" value={formatInt(m.redemptions.pointsIssued)} hint="por compras, misiones, promociones y eventos" />
        <Stat label="Puntos canjeados" value={formatInt(m.redemptions.pointsRedeemed)} hint="en recompensas ya entregadas" />
        <Stat label="Tasa de canje" value={pct(m.redemptions.rate)} hint="canjeados ÷ entregados" />
        <Stat
          label="Canjes solicitados"
          value={formatInt(m.redemptions.created)}
          hint={`${m.redemptions.redeemed} entregados · ${m.redemptions.pending} pendientes · ${m.redemptions.expired} vencidos · ${m.redemptions.cancelled} cancelados`}
        />
      </div>

      <div className="grid-2">
        <Card>
          <h2>Recompensas más canjeadas</h2>
          {m.redemptions.topRewards.length === 0 ? (
            <p className="muted">Sin canjes entregados en el período.</p>
          ) : (
            <ul className="list">
              {m.redemptions.topRewards.map((r) => {
                const reward = db.rewards.find((x) => x.id === r.rewardId)
                return (
                  <li key={r.rewardId} className="list-row">
                    <div>
                      <strong>{reward ? rewardTitle(db, reward) : 'Recompensa'}</strong>
                      <div className="muted small">{businessName(r.businessId)}</div>
                    </div>
                    <span className="small">
                      {formatInt(r.count)} canjes · {formatInt(r.points)} puntos
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card>
          <h2>Compras compartidas entre tiendas</h2>
          <p className="muted small">Pares de establecimientos donde compraron los mismos clientes.</p>
          {m.cross.topPairs.length === 0 ? (
            <p className="muted">Ningún cliente compró en más de un establecimiento.</p>
          ) : (
            <ul className="list">
              {m.cross.topPairs.map((pair) => (
                <li key={`${pair.a}-${pair.b}`} className="list-row">
                  <span>
                    {businessName(pair.a)} + {businessName(pair.b)}
                  </span>
                  <strong>{formatInt(pair.customers)} clientes</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2>Efectividad de promociones</h2>
        {m.promotions.length === 0 ? (
          <Empty>Ninguna promoción se aplicó en el período.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Promoción</th>
                  <th className="num">Compras</th>
                  <th className="num">Ventas</th>
                  <th className="num">Clientes</th>
                  <th className="num">Puntos extra</th>
                  <th className="num">Ticket promedio</th>
                </tr>
              </thead>
              <tbody>
                {m.promotions.map((r) => (
                  <tr key={r.promotion.id}>
                    <td>{r.promotion.name}</td>
                    <td className="num">{formatInt(r.purchases)}</td>
                    <td className="num">{formatMoney(r.sales)}</td>
                    <td className="num">{formatInt(r.customers)}</td>
                    <td className="num">{formatInt(r.bonusPoints)}</td>
                    <td className="num">
                      {formatMoney(r.averageTicket)}
                      {r.ticketLift !== null && (
                        <div className={`small ${r.ticketLift >= 0 ? 'positive' : 'negative'}`}>
                          {r.ticketLift >= 0 ? '+' : '−'}
                          {pct(Math.abs(r.ticketLift))} vs compras sin promoción
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2>Horas pico</h2>
        {hours.length === 0 ? (
          <Empty>Sin compras en el período.</Empty>
        ) : (
          <>
            {busiest && (
              <p className="muted small">
                Momento con más compras: {DAY_LABELS[DAYS_IN_ORDER[busiest.d]]} de {busiest.h}:00 a {busiest.h + 1}:00 ({busiest.count} compras).
              </p>
            )}
            <div className="heatmap" style={{ '--cols': hours.length } as CSSProperties}>
              <span />
              {hours.map((h) => (
                <span key={h} className="heat-label">
                  {h}h
                </span>
              ))}
              {m.peak.map((row, d) => (
                <div key={d} style={{ display: 'contents' }}>
                  <span className="heat-label">{DAY_LABELS[DAYS_IN_ORDER[d]].slice(0, 3)}</span>
                  {hours.map((h) => (
                    <span
                      key={h}
                      className="heat-cell"
                      title={`${DAY_LABELS[DAYS_IN_ORDER[d]]} ${h}:00 · ${row[h]} compras`}
                      style={{ opacity: row[h] === 0 ? 0.06 : 0.2 + (row[h] / maxPeak) * 0.8 }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2>Eventos</h2>
        {m.events.length === 0 ? (
          <Empty>No hubo ingresos a eventos en el período.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th className="num">Asistentes</th>
                  <th className="num">Sin compras previas</th>
                  <th className="num">Puntos entregados</th>
                </tr>
              </thead>
              <tbody>
                {m.events.map((e) => (
                  <tr key={e.eventId}>
                    <td>{e.name}</td>
                    <td className="num">{formatInt(e.attendees)}</td>
                    <td className="num">{formatInt(e.newToProgram)}</td>
                    <td className="num">{formatInt(e.pointsGiven)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
