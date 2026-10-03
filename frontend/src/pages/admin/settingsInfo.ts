import type { SettingKey } from '../../domain/loyalty'

export interface SettingInfo {
  label: string
  unit: string
  hint: string
  step: number
}

export const SETTINGS: Record<SettingKey, SettingInfo> = {
  POINTS_BASE_RATE: { label: 'Puntos por cada Bs 1 gastado', unit: 'puntos', hint: 'Para canjear recompensas', step: 0.1 },
  STATUS_BASE_RATE: { label: 'Puntos de nivel por cada Bs 1 gastado', unit: 'puntos de nivel', hint: 'Solo suben de nivel; no se gastan', step: 0.1 },
  DISCOVERY_STATUS_BONUS: { label: 'Premio por comprar en una tienda nueva', unit: 'puntos de nivel', hint: 'Primera compra en cada tienda', step: 1 },
  STREAK_STATUS_BONUS: { label: 'Premio por volver semana tras semana', unit: 'puntos de nivel por semana', hint: 'Desde la 2.ª semana seguida (máx. 10)', step: 1 },
  REDEMPTION_EXPIRATION_MINUTES: { label: 'Tiempo para usar un código de canje', unit: 'minutos', hint: 'Si vence, los puntos vuelven', step: 1 },
  ABNORMAL_AMOUNT_THRESHOLD: { label: 'Revisar compras desde', unit: 'Bs', hint: 'Esperan tu aprobación en Fraude', step: 1 },
  WELCOME_STATUS_BONUS: { label: 'Puntos de nivel de bienvenida', unit: 'puntos de nivel', hint: 'Al registrarse', step: 1 },
  VISIT_CARD_SIZE: { label: 'Casilleros de la tarjeta de visitas', unit: 'sellos', hint: 'Un sello por día con compra o visita', step: 1 },
  VISIT_CARD_GIFT_STAMPS: { label: 'Sellos de cortesía', unit: 'sellos', hint: 'Ya marcados en cada tarjeta nueva', step: 1 },
  VISIT_CARD_MULTIPLIER: { label: 'Cupón al completar la tarjeta', unit: '× puntos', hint: 'Para una compra, más un giro gratis', step: 0.5 },
  VISIT_CARD_VALID_DAYS: { label: 'Validez del cupón de la tarjeta', unit: 'días', hint: 'Desde que se completa la tarjeta', step: 1 },
  SPIN_COST: { label: 'Costo del giro del día', unit: 'puntos', hint: 'Ningún premio de puntos vale menos', step: 1 },
  SPIN_EXTRA_MIN_PURCHASE: { label: 'Compra para un giro extra', unit: 'Bs', hint: 'Desde este monto, giro gratis', step: 1 },
  SPIN_EXTRA_DAILY_MAX: { label: 'Giros extra por día', unit: 'giros', hint: 'Tope diario por compras', step: 1 },
  SPIN_MILESTONE_STATUS: { label: 'Giro gratis cada', unit: 'puntos de nivel', hint: '0 = desactivado', step: 50 },
  BIRTHDAY_BONUS_POINTS: { label: 'Puntos de regalo de cumpleaños', unit: 'puntos', hint: 'Con cumpleaños verificado', step: 1 },
  BIRTHDAY_REWARD_MAX_POINTS: { label: 'Recompensa de cumpleaños hasta', unit: 'puntos', hint: 'El cliente la elige gratis', step: 50 },
  POINTS_EXPIRATION_MONTHS: { label: 'Vencimiento de puntos', unit: 'meses', hint: 'Cada compra o visita renueva el plazo', step: 1 },
  POINTS_EXPIRATION_NOTICE_DAYS: { label: 'Avisar del vencimiento con', unit: 'días', hint: 'Antes de vencer', step: 1 },
  REACTIVATION_DAYS: { label: 'Cliente dormido después de', unit: 'días sin comprar', hint: 'Recibe una promoción personal', step: 1 },
  AUTO_PROMO_MULTIPLIER: { label: 'Promociones automáticas', unit: '× puntos', hint: 'Multiplicador de las promos de regreso y aniversario.', step: 0.5 },
  AUTO_PROMO_DAYS: { label: 'Duración de promociones automáticas', unit: 'días', hint: 'Vigencia de las promos de regreso y aniversario.', step: 1 },
}
