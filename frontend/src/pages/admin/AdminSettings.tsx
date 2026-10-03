import { useState, type FormEvent } from 'react'
import { ApiError, api } from '../../data/api'
import { useDb } from '../../data/store'
import { SETTING_RANGES } from '../../data/actions'
import { SETTING_DEFAULTS, type SettingKey } from '../../domain/loyalty'
import { rangeError } from '../../domain/validation'
import { formatInt, formatMoney } from '../../lib/format'
import { signOut } from '../../session'
import { Card, Field, PageHeader, notify, run } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { SETTINGS } from './settingsInfo'

const GROUPS: { title: string; keys: SettingKey[] }[] = [
  { title: 'Cuánto se gana por comprar', keys: ['POINTS_BASE_RATE', 'STATUS_BASE_RATE'] },
  { title: 'Premios por visitar el Paseo', keys: ['DISCOVERY_STATUS_BONUS', 'STREAK_STATUS_BONUS', 'WELCOME_STATUS_BONUS'] },
  { title: 'Tarjeta de visitas', keys: ['VISIT_CARD_SIZE', 'VISIT_CARD_GIFT_STAMPS', 'VISIT_CARD_MULTIPLIER', 'VISIT_CARD_VALID_DAYS'] },
  { title: 'Ruleta', keys: ['SPIN_COST', 'SPIN_EXTRA_MIN_PURCHASE', 'SPIN_EXTRA_DAILY_MAX', 'SPIN_MILESTONE_STATUS'] },
  { title: 'Cumpleaños', keys: ['BIRTHDAY_BONUS_POINTS', 'BIRTHDAY_REWARD_MAX_POINTS'] },
  { title: 'Vencimiento de puntos', keys: ['POINTS_EXPIRATION_MONTHS', 'POINTS_EXPIRATION_NOTICE_DAYS'] },
  { title: 'Clientes dormidos y aniversarios', keys: ['REACTIVATION_DAYS', 'AUTO_PROMO_MULTIPLIER', 'AUTO_PROMO_DAYS'] },
  { title: 'Canjes y seguridad', keys: ['REDEMPTION_EXPIRATION_MINUTES', 'ABNORMAL_AMOUNT_THRESHOLD'] },
]

export function AdminSettings() {
  const db = useDb()
  const keys = Object.keys(SETTING_DEFAULTS) as SettingKey[]
  const current = (key: SettingKey) => db.systemSettings.find((s) => s.key === key)?.value ?? SETTING_DEFAULTS[key]
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(keys.map((k) => [k, current(k)])))
  const changed = keys.filter((k) => values[k] !== current(k))
  const problem = (key: SettingKey) => {
    if (values[key] === current(key)) return null
    const value = (values[key] ?? '').trim()
    return rangeError(value === '' ? NaN : Number(value), 'El valor', ...SETTING_RANGES[key])
  }
  const invalid = changed.find((k) => problem(k))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (invalid) return notify('error', `"${SETTINGS[invalid].label}": ${problem(invalid)}`)
    for (const key of changed) {
      if (!(await run('saveSetting', { key, value: values[key].trim() }))) return
    }
    notify('success', 'Cambios guardados')
  }

  const resetDemo = async () => {
    const ok = await confirmDialog({
      title: '¿Restablecer los datos de demostración?',
      message: 'Se borran todos los cambios hechos en la base de datos y se cierra la sesión.',
      confirmLabel: 'Restablecer',
      tone: 'danger',
    })
    if (!ok) return
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
                <Field key={key} label={SETTINGS[key].label} hint={SETTINGS[key].hint} error={problem(key)}>
                  <div className="input-unit">
                    <input
                      type="number"
                      required
                      min={SETTING_RANGES[key][0]}
                      max={SETTING_RANGES[key][1]}
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
            <button className="btn btn-primary" type="submit" disabled={changed.length === 0 || !!invalid}>
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
