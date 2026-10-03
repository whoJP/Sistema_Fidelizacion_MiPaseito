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
  REDEMPTION_EXPIRATION_MINUTES: { label: 'Tiempo para usar un código de canje', unit: 'minutos', hint: 'Si el cliente no lo usa en este tiempo, el canje vence y los puntos vuelven a su saldo.', step: 1 },
  ABNORMAL_AMOUNT_THRESHOLD: { label: 'Revisar compras desde', unit: 'Bs', hint: 'Compras de este monto o más esperan tu aprobación en "Fraude" antes de dar puntos.', step: 1 },
  WELCOME_STATUS_BONUS: { label: 'Puntos de nivel de bienvenida', unit: 'puntos de nivel', hint: 'Al registrarse, para que el cliente arranque con la barra avanzada.', step: 1 },
  VISIT_CARD_SIZE: { label: 'Casilleros de la tarjeta de visitas', unit: 'sellos', hint: 'Cada día con compra o visita a un espacio suma un sello.', step: 1 },
  VISIT_CARD_GIFT_STAMPS: { label: 'Sellos de cortesía', unit: 'sellos', hint: 'Cada tarjeta nueva empieza con estos sellos ya marcados.', step: 1 },
  VISIT_CARD_MULTIPLIER: { label: 'Cupón al completar la tarjeta', unit: '× puntos', hint: 'Multiplica los puntos de una compra. Además da un giro gratis.', step: 0.5 },
  VISIT_CARD_VALID_DAYS: { label: 'Validez del cupón de la tarjeta', unit: 'días', hint: 'Tiempo para usar el cupón una vez completada la tarjeta.', step: 1 },
  SPIN_COST: { label: 'Costo del giro del día', unit: 'puntos', hint: 'Un giro por día. Ningún premio de puntos puede valer menos que esto.', step: 1 },
  SPIN_EXTRA_MIN_PURCHASE: { label: 'Compra para un giro extra', unit: 'Bs', hint: 'Cada compra desde este monto desbloquea un giro extra gratis.', step: 1 },
  SPIN_EXTRA_DAILY_MAX: { label: 'Giros extra por día', unit: 'giros', hint: 'Tope diario de giros extra por compras.', step: 1 },
  SPIN_MILESTONE_STATUS: { label: 'Giro gratis cada', unit: 'puntos de nivel', hint: 'Al acumular este total de nivel el cliente gana un giro. 0 = desactivado.', step: 50 },
  BIRTHDAY_BONUS_POINTS: { label: 'Puntos de regalo de cumpleaños', unit: 'puntos', hint: 'Se acreditan solos el día del cumpleaños verificado.', step: 1 },
  BIRTHDAY_REWARD_MAX_POINTS: { label: 'Recompensa de cumpleaños hasta', unit: 'puntos', hint: 'El cliente elige gratis una recompensa que cueste hasta esto.', step: 50 },
  POINTS_EXPIRATION_MONTHS: { label: 'Vencimiento de puntos', unit: 'meses', hint: 'Desde la última compra o visita. Cada compra o visita renueva el plazo.', step: 1 },
  POINTS_EXPIRATION_NOTICE_DAYS: { label: 'Avisar del vencimiento con', unit: 'días', hint: 'Solo entonces se avisa al cliente; antes la fecha se ve en su actividad.', step: 1 },
  REACTIVATION_DAYS: { label: 'Cliente dormido después de', unit: 'días sin comprar', hint: 'Recibe una promoción personal según lo que suele consumir.', step: 1 },
  AUTO_PROMO_MULTIPLIER: { label: 'Promociones automáticas', unit: '× puntos', hint: 'Multiplicador de las promos de regreso y aniversario.', step: 0.5 },
  AUTO_PROMO_DAYS: { label: 'Duración de promociones automáticas', unit: 'días', hint: 'Vigencia de las promos de regreso y aniversario.', step: 1 },
}
