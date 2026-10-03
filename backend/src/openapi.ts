const idPath = (description: string) => ({
  name: 'id',
  in: 'path',
  required: true,
  description,
  schema: { type: 'integer' },
})

const query = (name: string, description: string, type: 'string' | 'integer' | 'number' | 'boolean' = 'string') => ({
  name,
  in: 'query',
  required: false,
  description,
  schema: { type },
})

const ok = (description: string) => ({
  200: {
    description,
    content: { 'application/json': { schema: { type: 'object', properties: { data: {} } } } },
  },
  401: { description: 'API key inválida' },
})

/** OpenAPI 3.1 contract of the integration API, usable as tool definitions by Jarvis Paseo. */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Paseo Points · API de integración',
    version: '1.0.0',
    description:
      'API de solo lectura del programa de fidelización de Paseo Aranjuez para Jarvis Paseo. ' +
      'Montos en bolivianos (Bs). Puntos = saldo canjeable; Status = acumulado que define el nivel (Bronce, Plata, Oro, Platinum). ' +
      'Horarios en hora de Bolivia (UTC-4).',
  },
  servers: [{ url: '/api/integration/v1' }],
  components: {
    securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
  },
  security: [{ apiKey: [] }],
  paths: {
    '/health': {
      get: { operationId: 'health', summary: 'Comprueba la conexión y la API key', responses: ok('Servicio disponible') },
    },
    '/categories': {
      get: { operationId: 'listCategories', summary: 'Árbol de categorías de establecimientos', responses: ok('Categorías') },
    },
    '/businesses': {
      get: {
        operationId: 'searchBusinesses',
        summary: 'Busca establecimientos del Paseo con piso, horario, si está abierto ahora y promociones activas',
        parameters: [
          query('q', 'Texto libre: nombre, descripción o sector'),
          query('floor', 'Piso: PB, 1, 2, 3, 4'),
          query('categoryId', 'Categoría (incluye subcategorías)', 'integer'),
          query('openNow', 'true para devolver solo los abiertos en este momento', 'boolean'),
        ],
        responses: ok('Establecimientos'),
      },
    },
    '/businesses/{id}': {
      get: {
        operationId: 'getBusiness',
        summary: 'Detalle de un establecimiento con su catálogo y recompensas',
        parameters: [idPath('Id del establecimiento')],
        responses: { ...ok('Establecimiento'), 404: { description: 'No existe' } },
      },
    },
    '/catalog': {
      get: {
        operationId: 'searchCatalog',
        summary: 'Busca productos del catálogo de los establecimientos',
        parameters: [
          query('q', 'Texto libre: nombre o descripción del producto'),
          query('businessId', 'Solo productos de este establecimiento', 'integer'),
          query('categoryId', 'Solo establecimientos de esta categoría', 'integer'),
          query('maxPrice', 'Precio máximo en Bs', 'number'),
          query('available', 'false para incluir productos no disponibles', 'boolean'),
          query('limit', 'Máximo de resultados (1-200, por defecto 50)', 'integer'),
        ],
        responses: ok('Productos'),
      },
    },
    '/promotions': {
      get: {
        operationId: 'listPromotions',
        summary: 'Promociones vigentes (puntos dobles, puntos fijos) y dónde aplican',
        parameters: [query('businessId', 'Solo las que aplican en este establecimiento', 'integer')],
        responses: ok('Promociones'),
      },
    },
    '/rewards': {
      get: {
        operationId: 'listRewards',
        summary: 'Recompensas canjeables con puntos, ordenadas por costo',
        parameters: [
          query('businessId', 'Solo recompensas de este establecimiento', 'integer'),
          query('maxPoints', 'Costo máximo en puntos', 'integer'),
        ],
        responses: ok('Recompensas'),
      },
    },
    '/events': {
      get: {
        operationId: 'listEvents',
        summary: 'Eventos del Paseo en curso o próximos y los puntos que otorga asistir',
        parameters: [query('days', 'Ventana en días desde hoy (por defecto 45)', 'integer')],
        responses: ok('Eventos'),
      },
    },
    '/tiers': {
      get: { operationId: 'listTiers', summary: 'Niveles del programa y su multiplicador de puntos', responses: ok('Niveles') },
    },
    '/customers/lookup': {
      get: {
        operationId: 'lookupCustomer',
        summary:
          'Resumen de un cliente por correo: puntos, nivel, recompensas que ya puede canjear, las que le faltan pocos puntos, misiones, insignias y últimas compras',
        parameters: [{ ...query('email', 'Correo del cliente'), required: true }],
        responses: { ...ok('Resumen del cliente'), 404: { description: 'Cliente no encontrado' } },
      },
    },
    '/customers/{id}': {
      get: {
        operationId: 'getCustomer',
        summary: 'Resumen de un cliente por id (mismo formato que lookupCustomer)',
        parameters: [idPath('Id del cliente')],
        responses: { ...ok('Resumen del cliente'), 404: { description: 'Cliente no encontrado' } },
      },
    },
    '/customers/{id}/movements': {
      get: {
        operationId: 'listCustomerMovements',
        summary: 'Últimos movimientos de puntos del cliente',
        parameters: [idPath('Id del cliente'), query('limit', 'Máximo de resultados (1-100, por defecto 20)', 'integer')],
        responses: { ...ok('Movimientos'), 404: { description: 'Cliente no encontrado' } },
      },
    },
  },
}
