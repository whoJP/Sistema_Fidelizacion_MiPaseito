import type { SettingKey } from '../../domain/loyalty'

export interface SettingInfo {
  label: string
  unit: string
  hint: string
  step: number
}

export const SETTINGS: Record<SettingKey, SettingInfo> = {
  POINTS_BASE_RATE: { label: 'Puntos por cada Bs 1 gastado', unit: 'puntos', hint: 'Son los que el cliente usa para canjear recompensas.', step: 0.1 },
  STATUS_BASE_RATE: { label: 'Puntos de nivel por cada Bs 1 gastado', unit: 'puntos de nivel', hint: 'Sirven solo para subir de nivel; no se gastan.', step: 0.1 },
  DISCOVERY_STATUS_BONUS: { label: 'Premio por comprar en una tienda nueva', unit: 'puntos de nivel', hint: 'Se da la primera vez que el cliente compra en cada tienda.', step: 1 },
  STREAK_STATUS_BONUS: { label: 'Premio por volver semana tras semana', unit: 'puntos de nivel por semana', hint: 'Desde la 2.ª semana seguida con compras (máximo 10 semanas).', step: 1 },
  REDEMPTION_EXPIRATION_MINUTES: { label: 'Tiempo para usar un código de canje', unit: 'minutos', hint: 'El QR del canje vence después de este tiempo y los puntos vuelven al cliente.', step: 1 },
  ABNORMAL_AMOUNT_THRESHOLD: { label: 'Revisar compras desde', unit: 'Bs', hint: 'Compras de este monto o más esperan tu aprobación en "Fraude" antes de dar puntos.', step: 1 },
}
