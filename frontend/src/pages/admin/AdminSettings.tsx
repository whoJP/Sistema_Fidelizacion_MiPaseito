import { useState, type FormEvent } from 'react'
import { ApiError, api } from '../../data/api'
import { useDb } from '../../data/store'
import { SETTING_DEFAULTS, type SettingKey } from '../../domain/loyalty'
import { formatInt, formatMoney } from '../../lib/format'
import { signOut } from '../../session'
import { Card, Field, PageHeader, notify, run } from '../../components/ui'
import { SETTINGS } from './settingsInfo'

const GROUPS: { title: string; keys: SettingKey[] }[] = [
  { title: 'Cuánto se gana por comprar', keys: ['POINTS_BASE_RATE', 'STATUS_BASE_RATE'] },
  { title: 'Premios por visitar el Paseo', keys: ['DISCOVERY_STATUS_BONUS', 'STREAK_STATUS_BONUS'] },
  { title: 'Canjes y seguridad', keys: ['REDEMPTION_EXPIRATION_HOURS', 'ABNORMAL_AMOUNT_THRESHOLD'] },
]

export function AdminSettings() {
  const db = useDb()
  const keys = Object.keys(SETTING_DEFAULTS) as SettingKey[]
  const current = (key: SettingKey) => db.systemSettings.find((s) => s.key === key)?.value ?? SETTING_DEFAULTS[key]
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(keys.map((k) => [k, current(k)])))
  const changed = keys.filter((k) => values[k] !== current(k))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    for (const key of changed) {
      const value = values[key]?.trim()
      if (!value || Number.isNaN(Number(value)) || Number(value) < 0) {
        return notify('error', `"${SETTINGS[key].label}" debe ser un número mayor o igual a 0`)
      }
    }
    for (const key of changed) {
      if (!(await run('saveSetting', { key, value: values[key].trim() }))) return
    }
    notify('success', 'Cambios guardados')
  }

  const resetDemo = async () => {
    if (!confirm('¿Restablecer todos los datos de demostración? Se borran los cambios hechos en la base de datos.')) return
    try {
      await api.resetDemo()
      notify('success', 'Datos de demostración restablecidos, vuelve a ingresar')
      signOut()
    } catch (err) {
      notify('error', err instanceof ApiError ? err.message : 'Error inesperado')
    }
  }

  const n = (key: SettingKey) => Number(values[key]) || 0

  return (
    <div className="page">
      <PageHeader title="Configuración" subtitle="Reglas generales del programa. Los cambios valen para las compras nuevas." />

      <form className="stack" onSubmit={save}>
        {GROUPS.map((group) => (
          <Card key={group.title}>
            <h2>{group.title}</h2>
            <div className="grid-2">
              {group.keys.map((key) => (
                <Field key={key} label={SETTINGS[key].label} hint={SETTINGS[key].hint}>
                  <div className="input-unit">
                    <input
                      type="number"
                      min={0}
                      step={SETTINGS[key].step}
                      value={values[key] ?? ''}
                      onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                    />
                    <span className="muted small">{SETTINGS[key].unit}</span>
                  </div>
                </Field>
              ))}
            </div>
          </Card>
        ))}

        <Card>
          <p className="small">
            <b>Ejemplo:</b> una compra de {formatMoney(100)} da {formatInt(Math.floor(100 * n('POINTS_BASE_RATE')))} puntos y{' '}
            {formatInt(Math.floor(100 * n('STATUS_BASE_RATE')))} puntos de nivel (más el extra del nivel del cliente y las promociones activas).
          </p>
          <div className="row end gap">
            {changed.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => setValues(Object.fromEntries(keys.map((k) => [k, current(k)])))}>
                Descartar
              </button>
            )}
            <button className="btn btn-primary" type="submit" disabled={changed.length === 0}>
              Guardar cambios
            </button>
          </div>
        </Card>
      </form>

      <Card>
        <h2>Datos de demostración</h2>
        <p className="muted small">Vuelve a cargar los datos de ejemplo de la demo. Se pierden los cambios hechos.</p>
        <button className="btn btn-ghost btn-sm danger" onClick={resetDemo}>
          Restablecer datos de demo
        </button>
      </Card>
    </div>
  )
}
