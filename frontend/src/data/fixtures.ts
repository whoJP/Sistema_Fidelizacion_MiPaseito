// Demo data for Paseo Aranjuez (Av. América #488, Cochabamba), loaded into MySQL by `npm run db:seed` and the demo reset.
// Brands, floors and opening hours follow the real mall; customers, prices and purchases are fictional.
// Amounts in bolivianos (Bs); reference rule from the hackathon brief: Bs 1 = 1 punto.
import type { Badge, Business, CatalogItem, Category, Database, DayOfWeek, Reward, User } from '../types/domain'
import { checkInEvent, createRedemption, registerPurchase, validateRedemption } from './actions'

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

function daysAgo(days: number, hour = 15): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 0, 0, 0)
  return d
}

const iso = (d: Date) => d.toISOString()

/** Tercera Feria del Descuento Especial de Urkupiña, held at the Paseo on Saturday 15 Aug 2026, 10:00–22:00. */
const URKUPINA_FAIR = { start: '2026-08-15T14:00:00.000Z', end: '2026-08-16T02:00:00.000Z' }

function emptyDatabase(): Database {
  return {
    users: [],
    businesses: [],
    businessSchedules: [],
    businessMembers: [],
    categories: [],
    businessCategories: [],
    catalogItems: [],
    tiers: [],
    transactions: [],
    pointMovements: [],
    statusMovements: [],
    rewards: [],
    redemptions: [],
    missions: [],
    missionBusinesses: [],
    missionCategories: [],
    missionProgress: [],
    businessDiscoveries: [],
    promotions: [],
    promotionBusinesses: [],
    promotionCategories: [],
    events: [],
    eventAttendances: [],
    badges: [],
    fraudAlerts: [],
    auditLogs: [],
    systemSettings: [],
  }
}

export function buildDemoDatabase(): Database {
  const db = emptyDatabase()
  const created = iso(daysAgo(90))

  const user = (id: number, email: string, firstName: string, lastName: string, role: User['role'] = 'CUSTOMER'): User => ({
    id,
    email,
    firstName,
    lastName,
    phone: null,
    birthDate: null,
    role,
    status: 'ACTIVE',
    createdAt: created,
    updatedAt: created,
    deletedAt: null,
  })
  db.users.push(
    user(1, 'admin@demo.paseo', 'Administración', 'Paseo', 'ADMIN'),
    user(2, 'ana@demo.paseo', 'Ana', 'Rivas'),
    user(3, 'luis@demo.paseo', 'Luis', 'Pérez'),
    user(4, 'sofia@demo.paseo', 'Sofía', 'Méndez'),
    user(5, 'marco@demo.paseo', 'Marco', 'Díaz'),
  )

  const cat = (id: number, name: string, parentId: number | null = null): Category => ({
    id,
    name,
    parentId,
    status: 'ACTIVE',
    deletedAt: null,
  })
  db.categories.push(
    cat(1, 'Gastronomía'),
    cat(2, 'Cafetería y postres', 1),
    cat(3, 'Pizzería', 1),
    cat(4, 'Moda'),
    cat(5, 'Ropa', 4),
    cat(6, 'Calzado', 4),
    cat(7, 'Joyería y accesorios', 4),
    cat(8, 'Salud y bienestar'),
    cat(9, 'Comida rápida', 1),
    cat(10, 'Restaurante gourmet', 1),
    cat(11, 'Servicios'),
  )

  // Mall hours: Mon–Sat 10:00–22:00, Sun 11:00–21:00. Food floors (3 and El 4to) close at 23:00 Mon–Sat.
  const biz = (
    id: number,
    name: string,
    description: string,
    floor: string,
    sector: string,
    localNumber: string,
    categoryIds: number[],
  ): Business => {
    db.businessCategories.push(...categoryIds.map((categoryId) => ({ businessId: id, categoryId })))
    const foodFloor = floor === '3' || floor === '4'
    DAYS.forEach((day) =>
      db.businessSchedules.push({
        id: db.businessSchedules.length + 1,
        businessId: id,
        dayOfWeek: day,
        openTime: day === 'SUNDAY' ? '11:00' : '10:00',
        closeTime: day === 'SUNDAY' ? '21:00' : foodFloor ? '23:00' : '22:00',
        isClosed: false,
      }),
    )
    return {
      id,
      name,
      description,
      logoUrl: null,
      phone: null,
      floor,
      sector,
      localNumber,
      status: 'ACTIVE',
      createdAt: created,
      updatedAt: created,
      deletedAt: null,
    }
  }
  db.businesses.push(
    biz(1, 'Mocca Café y Gelato', 'Café de especialidad, gelato artesanal y repostería.', '3', 'Paseo de Comidas', '305', [2]),
    biz(2, 'Almacén Pizza', 'Pizzas artesanales al estilo argentino.', '3', 'Paseo de Comidas', '310', [3]),
    biz(3, 'Gap', 'Ropa casual para mujer, hombre y niños.', 'PB', 'Ingreso Av. América', '102', [5]),
    biz(4, 'Impulse', 'Zapatillas Nike, Adidas, Puma, Converse, New Balance y más.', '1', 'Ala norte', '118', [6]),
    biz(5, 'Joyería Carrasco', 'Joyas en oro y plata, relojes y regalos.', '1', 'Ala sur', '126', [7]),
    biz(6, 'Farmacorp', 'Farmacia, cuidado personal, higiene y comestibles.', 'PB', 'Ingreso Pantaleón Dalence', '108', [8]),
    biz(7, 'Cinnabon', 'Rollos de canela recién horneados y bebidas.', 'PB', 'Plaza central', '115', [2]),
    biz(8, 'Óptica Pauker', 'Lentes de receta, lentes de sol y examen visual.', '2', 'Ala norte', '204', [8, 11]),
    biz(9, 'Subway', 'Sándwiches y ensaladas armados a tu gusto.', '3', 'Paseo de Comidas', '302', [9]),
    biz(10, 'Sushi Town', 'Rolls, combos de sushi y comida japonesa.', '3', 'Paseo de Comidas', '312', [9]),
    biz(11, 'Tunari Gourmet', 'Cocina cochabambina de autor con vista al Tunari.', '4', 'Terraza El 4to', '401', [10]),
    biz(12, 'Lili Pink', 'Ropa interior, pijamas y cosméticos.', '1', 'Ala sur', '131', [5, 7]),
    biz(13, 'Totto', 'Mochilas, maletas y accesorios de viaje.', '2', 'Ala sur', '212', [7]),
    biz(14, 'Aldo', 'Calzado, carteras y accesorios de moda.', '1', 'Ala norte', '112', [6, 7]),
  )

  db.businessMembers.push(
    { id: 1, userId: 3, businessId: 1, role: 'MANAGER', status: 'ACTIVE' },
    { id: 2, userId: 3, businessId: 6, role: 'STAFF', status: 'ACTIVE' },
    ...[2, 3, 4, 5, 7, 8, 9, 11, 12].map((businessId, i) => ({
      id: 3 + i,
      userId: 4,
      businessId,
      role: (businessId === 3 ? 'MANAGER' : 'STAFF') as 'MANAGER' | 'STAFF',
      status: 'ACTIVE' as const,
    })),
  )

  const item = (businessId: number, name: string, price: number | null, description: string | null = null): CatalogItem => ({
    id: db.catalogItems.length + 1,
    businessId,
    name,
    description,
    price,
    isAvailable: true,
    deletedAt: null,
  })
  ;(
    [
      [1, 'Capuchino', 22, 'Doble shot de espresso con leche texturizada'],
      [1, 'Gelato 2 bolas', 25, null],
      [1, 'Torta de chocolate', 28, null],
      [2, 'Pizza personal', 45, null],
      [2, 'Pizza familiar napolitana', 110, 'Tomate, mozzarella, ajo y orégano'],
      [3, 'Polera básica', 189, null],
      [3, 'Jeans clásicos', 399, null],
      [4, 'Zapatillas Nike Air', 890, null],
      [4, 'Zapatillas Adidas Running', 790, null],
      [5, 'Anillo de plata 950', 450, null],
      [5, 'Reloj de acero', 1200, null],
      [6, 'Protector solar FPS 50', 120, null],
      [6, 'Vitamina C x 30', 65, null],
      [7, 'Classic Roll', 32, 'El clásico rollo de canela con frosting'],
      [7, 'MiniBon', 20, null],
      [8, 'Lentes de sol', 650, null],
      [8, 'Examen visual', null, 'Precio según evaluación'],
      [9, 'Sub de 30 cm', 58, null],
      [9, 'Sub de 15 cm', 38, null],
      [10, 'Combo 12 piezas', 75, null],
      [11, 'Pique macho', 95, 'Clásico cochabambino para compartir'],
      [11, 'Silpancho', 70, null],
      [12, 'Pijama de algodón', 180, null],
      [12, 'Body splash', 90, null],
      [13, 'Mochila urbana', 420, null],
      [14, 'Botines de cuero', 750, null],
    ] as const
  ).forEach(([businessId, name, price, description]) => db.catalogItems.push(item(businessId, name, price, description)))

  db.tiers.push(
    { id: 1, name: 'Bronce', minimumStatus: 0, pointsMultiplier: 1, sortOrder: 1, isActive: true },
    { id: 2, name: 'Plata', minimumStatus: 1500, pointsMultiplier: 1.25, sortOrder: 2, isActive: true },
    { id: 3, name: 'Oro', minimumStatus: 5000, pointsMultiplier: 1.5, sortOrder: 3, isActive: true },
    { id: 4, name: 'Platinum', minimumStatus: 12000, pointsMultiplier: 2, sortOrder: 4, isActive: true },
  )

  db.systemSettings.push(
    { key: 'POINTS_BASE_RATE', value: '1', updatedAt: created },
    { key: 'STATUS_BASE_RATE', value: '1', updatedAt: created },
    { key: 'ABNORMAL_AMOUNT_THRESHOLD', value: '5000', updatedAt: created },
  )

  // Each business creates its own rewards; `createdById` is its manager when the demo has one.
  const ownerOf = (businessId: number) =>
    db.businessMembers.find((m) => m.businessId === businessId && m.role === 'MANAGER')?.userId ?? 1
  const catalogId = (businessId: number, name: string) =>
    db.catalogItems.find((i) => i.businessId === businessId && i.name === name)!.id
  const reward = (id: number, businessId: number, pointsCost: number, fields: Partial<Reward> & Pick<Reward, 'type'>) => {
    db.rewards.push({
      id,
      businessId,
      discountPercent: null,
      discountAmount: null,
      catalogItemId: null,
      quantity: 1,
      minimumPurchase: null,
      description: null,
      pointsCost,
      minimumTierId: null,
      stock: null,
      startsAt: null,
      endsAt: null,
      status: 'ACTIVE',
      createdById: ownerOf(businessId),
      deletedAt: null,
      ...fields,
    })
  }
  reward(1, 1, 300, { type: 'AMOUNT_DISCOUNT', discountAmount: 20, description: 'Válido en cualquier consumo del local.' })
  reward(2, 7, 500, { type: 'FREE_PRODUCT', catalogItemId: catalogId(7, 'Classic Roll') })
  reward(3, 2, 700, { type: 'FREE_PRODUCT', catalogItemId: catalogId(2, 'Pizza personal') })
  reward(4, 3, 1000, { type: 'PERCENT_DISCOUNT', discountPercent: 15, minimumPurchase: 200, minimumTierId: 2, description: 'No acumulable con otras ofertas de la tienda.' })
  reward(5, 4, 1500, { type: 'AMOUNT_DISCOUNT', discountAmount: 100, minimumPurchase: 600 })
  reward(6, 11, 3000, { type: 'FREE_PRODUCT', catalogItemId: catalogId(11, 'Pique macho'), quantity: 2, minimumTierId: 3, stock: 20, description: 'Para consumir en la terraza de El 4to.' })
  reward(7, 8, 700, { type: 'FREE_PRODUCT', catalogItemId: catalogId(8, 'Examen visual'), status: 'DRAFT' })

  const mission = (
    id: number,
    name: string,
    description: string,
    type: Database['missions'][number]['type'],
    goal: number,
    rewardPoints: number,
    rewardStatus: number,
    scope: { businessIds?: number[]; categoryIds?: number[] } = {},
  ) => {
    db.missions.push({
      id,
      name,
      description,
      type,
      goal,
      rewardPoints,
      rewardStatus,
      startsAt: iso(daysAgo(40, 0)),
      endsAt: iso(daysAgo(-30, 23)),
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    })
    scope.businessIds?.forEach((businessId) => db.missionBusinesses.push({ missionId: id, businessId }))
    scope.categoryIds?.forEach((categoryId) => db.missionCategories.push({ missionId: id, categoryId }))
  }
  mission(1, 'Ruta gastronómica', 'Compra en 2 locales del Paseo de Comidas o de El 4to.', 'BUY_DISTINCT_BUSINESSES', 2, 300, 100, { categoryIds: [1] })
  mission(2, 'Explorador del Paseo', 'Compra por primera vez en 8 establecimientos.', 'DISCOVER_BUSINESS', 8, 500, 200)
  mission(3, 'Constancia', 'Compra en 4 semanas distintas.', 'WEEKLY_PURCHASE', 4, 400, 200)
  mission(4, 'Gran compra', 'Acumula Bs 3.000 en compras.', 'TOTAL_PURCHASE_AMOUNT', 3000, 600, 250)
  mission(5, 'Mix de estilos', 'Compra en 3 categorías distintas.', 'BUY_DISTINCT_CATEGORIES', 3, 350, 150)

  db.promotions.push(
    {
      id: 1,
      name: 'Doble puntos en cafeterías',
      type: 'POINTS_MULTIPLIER',
      value: 2,
      startsAt: iso(daysAgo(10, 0)),
      endsAt: iso(daysAgo(-20, 23)),
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    },
    {
      id: 2,
      name: '+100 puntos en Farmacorp',
      type: 'FIXED_POINTS',
      value: 100,
      startsAt: iso(daysAgo(10, 0)),
      endsAt: iso(daysAgo(-20, 23)),
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    },
    {
      id: 3,
      name: 'Feria del Descuento de Urkupiña: puntos ×1,5 en moda',
      type: 'POINTS_MULTIPLIER',
      value: 1.5,
      startsAt: URKUPINA_FAIR.start,
      endsAt: URKUPINA_FAIR.end,
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    },
  )
  db.promotionCategories.push({ promotionId: 1, categoryId: 2 }, { promotionId: 3, categoryId: 4 })
  db.promotionBusinesses.push({ promotionId: 2, businessId: 6 })

  // Events managed by the Paseo admin. Attending one grants its points and the event badge.
  db.events.push(
    {
      id: 1,
      name: 'Festival Potterhead',
      description: 'Tres días de magia, disfraces y concursos para fans de Harry Potter.',
      location: 'Experience Store, planta baja',
      startsAt: '2026-07-31T14:00:00.000Z',
      endsAt: '2026-08-03T02:00:00.000Z',
      pointsReward: 150,
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    },
    {
      id: 2,
      name: 'Semana del Café',
      description: 'Catas guiadas y baristas invitados en el Paseo de Comidas.',
      location: 'Paseo de Comidas, piso 3',
      startsAt: iso(daysAgo(1, 0)),
      endsAt: iso(daysAgo(-3, 23)),
      pointsReward: 100,
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    },
    {
      id: 3,
      name: 'Halloween en el Paseo',
      description: 'Desfile de disfraces, dulces en las tiendas y concurso familiar.',
      location: 'Experience Store y pasillos',
      startsAt: '2026-10-31T20:00:00.000Z',
      endsAt: '2026-11-01T02:00:00.000Z',
      pointsReward: 200,
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    },
    {
      id: 4,
      name: 'Encendido del árbol navideño',
      description: 'Coro, chocolate caliente y la llegada de Papá Noel.',
      location: 'Plaza central, planta baja',
      startsAt: '2026-12-05T23:00:00.000Z',
      endsAt: '2026-12-06T02:00:00.000Z',
      pointsReward: 200,
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
    },
  )

  const badge = (id: number, name: string, description: string, fields: Partial<Badge> & Pick<Badge, 'type'>) =>
    db.badges.push({
      id,
      name,
      description,
      goal: null,
      tierId: null,
      categoryId: null,
      date: null,
      status: 'ACTIVE',
      createdById: 1,
      deletedAt: null,
      ...fields,
    })
  badge(1, 'Primera compra', 'Sumaste puntos por primera vez en el Paseo.', { type: 'PURCHASE_COUNT', goal: 1 })
  badge(2, 'Cliente frecuente', 'Registraste 10 compras.', { type: 'PURCHASE_COUNT', goal: 10 })
  badge(3, 'Fiel al Paseo', 'Registraste 25 compras.', { type: 'PURCHASE_COUNT', goal: 25 })
  badge(4, 'Nivel Plata', 'Alcanzaste el nivel Plata.', { type: 'TIER_REACHED', tierId: 2 })
  badge(5, 'Nivel Oro', 'Alcanzaste el nivel Oro.', { type: 'TIER_REACHED', tierId: 3 })
  badge(6, 'Nivel Platinum', 'Alcanzaste el nivel más alto del programa.', { type: 'TIER_REACHED', tierId: 4 })
  badge(7, 'Buen diente', '5 compras en restaurantes, cafeterías y comida rápida.', { type: 'CATEGORY_PURCHASES', categoryId: 1, goal: 5 })
  badge(8, 'A la moda', '3 compras en tiendas de moda.', { type: 'CATEGORY_PURCHASES', categoryId: 4, goal: 3 })
  badge(9, 'Explorador', 'Compraste en 5 establecimientos distintos.', { type: 'DISTINCT_BUSINESSES', goal: 5 })
  badge(10, 'Conocedor del Paseo', 'Compraste en 10 establecimientos distintos.', { type: 'DISTINCT_BUSINESSES', goal: 10 })
  badge(11, 'Cazador de misiones', 'Completaste 3 misiones.', { type: 'MISSIONS_COMPLETED', goal: 3 })
  badge(12, 'Urkupiña 2026', 'Visitaste el Paseo el día de la Feria del Descuento de Urkupiña.', { type: 'SPECIAL_DATE', date: '2026-08-15' })
  badge(13, 'Halloween 2026', 'Visitaste el Paseo en Halloween.', { type: 'SPECIAL_DATE', date: '2026-10-31' })
  badge(14, '6.º aniversario del Paseo', 'Celebraste con nosotros el aniversario del Paseo Aranjuez.', { type: 'SPECIAL_DATE', date: '2026-11-06' })
  badge(15, 'Navidad 2026', 'Visitaste el Paseo en Navidad.', { type: 'SPECIAL_DATE', date: '2026-12-25' })

  const staffFor = (businessId: number) =>
    db.businessMembers.find((m) => m.businessId === businessId && m.status === 'ACTIVE')!.userId
  const buy = (customerId: number, businessId: number, amount: number, when: Date) =>
    registerPurchase(db, { customerId, businessId, performedById: staffFor(businessId), amount }, when)

  buy(2, 12, 260, new Date('2026-08-15T16:00:00-04:00'))
  buy(2, 1, 60, daysAgo(33))
  buy(2, 3, 430, daysAgo(31))
  buy(2, 2, 170, daysAgo(26))
  buy(2, 1, 45, daysAgo(19))
  buy(2, 4, 620, daysAgo(17))
  buy(2, 11, 210, daysAgo(14, 20))
  buy(2, 7, 64, daysAgo(12))
  buy(2, 1, 80, daysAgo(5))
  buy(2, 6, 245, daysAgo(4))
  buy(2, 2, 190, daysAgo(1))
  buy(3, 2, 120, daysAgo(9))
  buy(3, 9, 96, daysAgo(2))
  buy(5, 3, 280, daysAgo(8))
  buy(5, 3, 280, new Date(daysAgo(8).getTime() + 3 * 60 * 1000))

  const redeemed = createRedemption(db, 2, 2, daysAgo(10))
  validateRedemption(db, { token: redeemed.verificationToken, businessId: 7, staffId: 4 }, daysAgo(10, 17))
  createRedemption(db, 2, 1, new Date(Date.now() - 2 * 3600_000))

  checkInEvent(db, { eventId: 1, customerId: 2 }, 1, new Date('2026-08-01T17:30:00-04:00'))
  checkInEvent(db, { eventId: 1, customerId: 3 }, 1, new Date('2026-08-02T18:10:00-04:00'))

  return db
}
