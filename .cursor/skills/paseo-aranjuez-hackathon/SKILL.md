---
name: paseo-aranjuez-hackathon
description: Business context of the Hackathon by Paseo Aranjuez, Reto 1 "Paseo Points" (sistema de fidelización). Lists mandatory and valued features, user roles, local conventions (Bs, niveles Bronce/Plata/Oro/Platinum), the official 10-step demo flow, deliverables and integration with Jarvis Paseo and PaseoYa. Use when deciding scope or priorities, writing UI copy or demo data, preparing the demo or presentation, or when the user mentions the hackathon, el reto, la demo, jurado, Paseo Aranjuez, Jarvis or PaseoYa.
---

# Hackathon by Paseo Aranjuez — Reto 1: Paseo Points

Source: *Hackathon by Paseo Aranjuez — Documento Oficial de Retos*. The team chose **Reto 1**:
a centralized, points-based loyalty program that connects every store, office, entrepreneur and service of the Paseo.

## What the jury evaluates

A functional **MVP** (not a finished product) that: solves the stated problem clearly, has a demonstrable UI,
working logic, coherent architecture, a realistic implementation path and good UX, shown in a **live demo**.
Problem framing and UX weigh as much as technical depth.

## Problem to solve

Visitors buy in different stores without a shared digital ecosystem to: recognize visit frequency, reward purchases,
incentivize new visits, personalize promotions, generate rewards, push customers to discover other businesses
and produce consumption-habit data.

## Local conventions (apply everywhere)

- Currency: **bolivianos, `Bs`** (e.g. `Bs 100`). Reference rule from the document: **Bs 1 = 1 Point**.
- Reference reward ladder: **300** cupón de descuento · **500** beneficio especial · **700** producto promocional ·
  **1.000** descuento en establecimientos · **1.500** promoción exclusiva.
- Customer levels: **Bronce, Plata, Oro, Platinum**.
- Language: Spanish; brand voice "Paseo Aranjuez / Paseo Points".

## Roles and required capabilities

| Rol | Debe poder |
|-----|-----------|
| Cliente | Crear cuenta, iniciar sesión, ver puntos, movimientos, beneficios, canjear, ver promociones, establecimientos, historial, perfil con insignias |
| Establecimiento | Registrar compras, asignar puntos, validar cliente, validar canjes, ver sus movimientos; el encargado crea y gestiona **sus propias recompensas** |
| Administrador | Registrar establecimientos, gestionar usuarios, promociones, misiones, eventos e insignias, equivalencias de puntos, métricas, movimientos, operaciones irregulares, **clientes frecuentes**, **establecimientos con mayor actividad**; solo **ve** las recompensas |

## Minimum requirements → where they live

Registro · Login · Perfil · Sistema de puntos · Registro de transacciones · Historial · Catálogo de beneficios ·
Canje · Panel de establecimiento · Panel admin · Identificación del cliente (QR personal) · Base de datos (MySQL).
Before the demo every item must work against the real database, not mocks.

## Valued extras (already covered or candidates)

Niveles · retos mensuales/misiones · bonus por visitar negocios distintos (Pasaporte) · puntos dobles en fechas
especiales (promociones multiplicador) · ranking de clientes · gamificación · cupones digitales (token de canje) ·
promociones personalizadas · estadísticas/métricas · detección de fraude · insignias (logros, eventos del Paseo y
fechas especiales). Candidates: puntos por cumpleaños, notificaciones, recomendaciones con IA, geolocalización.
Referidos: descartado por ahora (decisión del equipo).
Prefer polishing the core flow over adding half-working extras.

## Official demo flow (rehearse exactly this)

1. El cliente crea su cuenta.
2. Recibe un código QR personal.
3. Realiza una compra en un establecimiento.
4. El establecimiento escanea su QR con la cámara (o escribe el código de 6 dígitos que se ve debajo del QR).
5. Se registra la compra.
6. Los puntos aparecen automáticamente en la cuenta (sin recargar).
7. El cliente revisa los premios disponibles.
8. Selecciona una recompensa (genera token de canje).
9. El comercio valida el canje.
10. El sistema registra toda la operación (movimientos, auditoría, dashboard admin).

Three account types (`User.role`): CUSTOMER, MERCHANT (store staff, one business each, Encargado or Personal) and
ADMIN. Demo accounts: `ana@demo.paseo` (cliente, nivel Plata), `camila@demo.paseo` (cliente), `marco@demo.paseo`
(cliente, compra duplicada → alerta de fraude), `luis@demo.paseo` (encargado Mocca Café), `sofia@demo.paseo`
(encargada Gap), `carla@demo.paseo` (personal Farmacorp), `admin@demo.paseo` (admin); every other store has its own
manager account (`<nombre>@demo.paseo`, see `fixtures.ts`). Password `demo1234`. Reset with "Restablecer datos de demo".

## The real Paseo Aranjuez (public sources, Oct 2026)

- **Where:** Av. América #488 esq. Pantaleón Dalence, zona Queru Queru, **Cochabamba** (not Santa Cruz).
  Opened 6 Nov 2020 by the Ortiz Oporto family (actress Carla Ortiz is co-owner); ~USD 20M, eco-friendly smart building,
  35.110 m², ~200 local units, target of 40.000 visits/day. Contact: info@paseoaranjuez.com, linktr.ee/paseoaranjuez.
- **Hours:** Mon–Sat 10:00–22:00, Sun 11:00–21:00; restaurants until 23:00.
- **Layout:** PB, 1 and 2 = retail · **3 = Paseo de Comidas** (express food court) · **4 = "El 4to"**, gourmet terrace
  with 8 restaurants, bar at night and a view of the Tunari · two **Torres Empresariales** (Paseo Aranjuez Office) above ·
  Galería de Arte for Bolivian artists · entertainment level · **Experience Store** (PB, events) · the first
  anamorphic 3D screen in Bolivia on the façade (Dec 2024).
- **Known tenants:** PB: Cinnabon, Farmacorp, Legend. Piso 1: Impulse, Ohanna Accesorios. Piso 2: Gool Store.
  Others: Gap, Lili Pink, Totto, Aldo, Dockers, Levi's, Fossil, Steve Madden, Vía Roma, OshKosh, Lady Posh, Huantaro,
  Óptica Pauker, Joyería Carrasco, Blush Beauty Station, Marroquinería Amore, Bolivia Fitness.
  Paseo de Comidas: Subway, Mocca Café y Gelato, Mandarina Burger, Almacén Pizza, Mangos, Sushi Town, Gunter's Burger,
  Tunari Express. El 4to: Tunari Gourmet, María Bonita, Cayenna, Monalisa, Rissi's, Brocheta King, Pata Negra,
  Churros Calientes.
- **Recurring events:** Feria del Descuento (3ra Feria Especial de Urkupiña, Sat 15 Aug 2026: racks outside the stores,
  up to 70% off, live music and dances), Festival Potterhead (31 Jul–2 Aug 2026, Experience Store), season-change sales.

**How the demo uses it:** `frontend/src/data/fixtures.ts` uses 14 real brands with the real hours. The floors for
Cinnabon, Farmacorp, Impulse, the Paseo de Comidas and El 4to are confirmed. Other floors, local numbers, prices and all
customers or purchases are illustrative. There is a past "Feria del Descuento de Urkupiña" promotion (×1,5 in Moda),
plus rewards such as a Classic Roll at Cinnabon and a dinner at El 4to.

**Pitch angles from the real mall:**
- Points make the ferias and events measurable: which customers came, and what they bought.
- Ruta gastronómica and Pasaporte push visitors from PB up to the Paseo de Comidas and El 4to, so the upper floors get traffic.
- Office workers in the Torres Empresariales are a daily-visit segment for weekly missions (Constancia).
- The anamorphic screen and the Experience Store can show the live ranking and promotions.

## Deliverables

1. Prototipo funcional. 2. Código fuente. 3. Presentación breve: problema, solución, usuarios, propuesta de valor,
funcionamiento, arquitectura, tecnologías, posible implementación. 4. Demo en vivo. 5. Arquitectura: frontend,
backend, base de datos, APIs, IA (si aplica), servicios externos.

## Integration story (mention in the pitch)

Jarvis Paseo (asistente IA) recomienda → PaseoYa (marketplace con retiro presencial obligatorio) vende →
Paseo Points premia la compra y el retiro trae al cliente al Paseo. Our `Business` (piso, sector, local, horarios),
`CatalogItem` and `Promotion` tables are the shared knowledge base those platforms would consume.
