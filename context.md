# Paseo Points · Contexto de línea gráfica

Línea gráfica **"Noir Dorado", edición iOS 7**: negro absoluto, grafito y un amarillo de sistema, con el lenguaje plano de iOS 7 (2013). Superficies planas sin brillos ni sombras, separadores finos, barras translúcidas con desenfoque, controles con contorno y un solo color de acento. Profesional, sobria y lujosa, pensada para el programa de fidelización de Paseo Aranjuez (vista de cliente en el teléfono, panel de comercio y panel de administración).

Todo el sistema vive en `frontend/src/index.css` como variables CSS (`:root`). No hay Tailwind ni kit de UI: cualquier pantalla nueva debe usar estos tokens y las primitivas de `frontend/src/components/ui.tsx`.

---

## 1. Paleta

### Colores base (definidos por la marca)

| Token | Hex | Rol |
| --- | --- | --- |
| `--void` | `#000000` | Negro absoluto. Portada del login y base de la barra lateral translúcida. |
| `--night` | `#010102` | Fondo general de la aplicación y de `.card-gold`. |
| `--graphite` | `#222223` | Base de las celdas (`--cell` es este color al 62%) y opciones de `select`. |
| `--ash` | `#595957` | Gris ceniza decorativo: bordes punteados de sellos e insignias sin conseguir. **No usar para texto.** |
| `--gold-deep` | `#3F3814` | **Oro profundo.** Reemplaza al café original `#312b1b`, llevado hacia el amarillo. Fondo de avatares, logos, monograma y el degradado de la tarjeta de puntos. |

### Acento: amarillo sistema

| Token | Hex | Rol |
| --- | --- | --- |
| `--gold` | `#F5C84C` | **Único acento** (el "tint color" de iOS 7). Botones, enlaces, iconos activos, control segmentado, anillos y barras de progreso. Es de la familia del amarillo de iOS 7 (`#FFCC00`), suavizado para no quemar sobre negro. |
| `--gold-light` | `#FFE08A` | Hover del botón primario y textos destacados. |
| `--gold-dim` | `#B8963A` | Iconos secundarios en reposo. |
| `--line-gold` | `rgb(245 200 76 / .45)` | Contornos de botones secundarios, chips y `.card-gold`. |

Sobre relleno amarillo el texto va en `#111` (contraste de unos 12:1).

### Tinta y superficies

| Token | Valor | Rol |
| --- | --- | --- |
| `--text` | `#F2F2F4` | Texto principal. |
| `--muted` | `#8E8E93` | Gris de sistema de iOS 7: texto secundario y etiquetas de filas. |
| `--subtle` | `#7C7C80` | Texto terciario, placeholders y encabezados de tabla. |
| `--cell` | `rgb(34 34 35 / .62)` | Fondo de las tarjetas, al estilo de las celdas agrupadas. |
| `--surface` | `#0E0E0F` | Campos de formulario, cifras y tokens. |
| `--surface-2` | `#171718` | Campo con foco. |
| `--line` | `rgb(142 142 147 / .16)` | Separadores finos estilo iOS. |
| `--line-strong` | `rgb(142 142 147 / .30)` | Bordes de campos y encabezados de tabla. |

### Colores de sistema (solo para estados)

| Token | Hex | Uso |
| --- | --- | --- |
| `--success` | `#4CD964` | Verde iOS 7: acreditado, canjeado, interruptor encendido. |
| `--warning` | `#FF9500` | Naranja iOS 7: en revisión, requiere nivel. |
| `--danger` | `#FF3B30` | Rojo iOS 7: anulado, error, acciones destructivas. |
| `--info` | `#34AADC` | Reservado para avisos informativos. |

Cada estado tiene su variante `-soft` al 12% para los fondos de las insignias.

### Niveles del programa

Los niveles se muestran como placas planas (`.tier-chip`, en Prata, radio de 6px), con fondo del color al 12-16% y borde fino:

- **Bronce:** cobre `#E0AD86`.
- **Plata:** plata fría `#D6D9DE`.
- **Oro:** `--gold`.
- **Platinum:** platino `#F2F3F6`.

### Reglas de color

- **Un solo acento: el amarillo.** El verde, naranja y rojo de sistema solo comunican estado.
- **Tema único oscuro** con `color-scheme: dark`.
- **Sin degradados en componentes.** Las únicas excepciones son los halos ambientales del fondo y la tarjeta de puntos (oro profundo a negro).
- **Sin sombras.** La profundidad se logra con translucidez y desenfoque, no con sombras.
- El QR se dibuja en `#010102` sobre marfil `#F3EEE0` para que se pueda escanear.

---

## 1b. Temas por rol

Cada rol tiene su propia línea de color para que se reconozca de un vistazo quién está usando la app. `AppShell` pone la clase `shell-customer`, `shell-merchant` o `shell-admin` en el contenedor, y cada tema redefine los tokens dentro de ese ámbito.

- **El acento se cambia con dos tokens:** `--gold` (color sólido) y `--accent-rgb` (los mismos valores en formato `R G B`, para los tintes translúcidos `rgb(var(--accent-rgb) / .1)`). Cada tema debe redefinir también `--line-gold`.
- **El oro de marca no cambia:** `--brand-gold` (`#F5C84C`) se usa siempre en el monograma, en la palabra destacada de la marca, en el escudo de la barra del personal y en el indicador del ítem activo del personal. Es la firma que une los tres temas.

| | Cliente | Comercio ("Mostrador Champán") | Administración ("Consola Platino") |
| --- | --- | --- | --- |
| Para quién | Clientes del Paseo | Personal y encargados de cada tienda | Equipo de Paseo Aranjuez |
| Acento (`--gold`) | Amarillo sistema `#F5C84C` | Oro clásico `#E2B65C` | Platino `#E4E6EB` |
| Fondo (`--night`) | `#010102` con halos de oro profundo | Negro cálido `#0C0B09`, sin halos | Grafito frío `#0B0C0F`, sin halos |
| Celdas (`--cell`) | Grafito translúcido | `#15130F` sólido | `#13151A` sólido |
| Texto | `#F2F2F4` / gris `#8E8E93` | `#FBF8F2` / `#BFB8A8` | Blanco puro `#FFFFFF` / `#B6BBC5` |
| Bordes | `--line` al 16% | Al 8% y al 16% (más visibles) | Al 8% y al 16% (más visibles) |
| Barra lateral | Translúcida con desenfoque | Sólida | Sólida |
| Radios | 14 / 10 / 6 px | 10 / 7 / 5 px | 10 / 7 / 5 px |
| Marca | "Paseo **Points**", monograma "P" circular | "Paseo **Points**" con el nombre del local | "Paseo **Aranjuez**", monograma "PA" cuadrado, "Consola interna" |

**Rasgos comunes del personal** (administración y comercio):

- Barra superior fija (`.staff-bar`) con el escudo dorado, "PASEO ARANJUEZ", el ámbito ("Administración del programa" o "Socio comercial · local") y una placa con el cargo ("Administrador", "Encargado", "Personal").
- Superficies sólidas sin translucidez y bordes más marcados para más contraste.
- Títulos de tarjeta en Jost 600 y h1 en Prata más contenido (hasta 2.25rem).
- Tablas con cabecera sobre fondo propio, filas alternas y resaltado al pasar el cursor.
- Ítem activo de la navegación con texto blanco y una barra vertical de 2px en oro de marca.
- Modales y avisos sólidos, sin desenfoque.

En administración, los estados usan versiones un poco más luminosas de los colores de sistema (`#32D74B`, `#FFB340` y `#FF5C52`) para mantener el contraste sobre el grafito frío.

---

## 2. Tipografía

| Rol | Fuente | Token |
| --- | --- | --- |
| h1, marca, títulos de sección grandes, placas de nivel, nombres de sellos e insignias | **Prata** 400 (serif didona) | `--font-display` |
| h2, h3, cuerpo, botones, formularios, tablas | **Jost Variable**, cuerpo en peso 350 y títulos de tarjeta en 500 | `--font-body` |
| Cifras (puntos, estadísticas, costos, porcentajes) | **Jost** ultraligera (200 a 300) con `tabular-nums` | `--font-figures` |
| Códigos y tokens | Monoespaciada del sistema | `--font-mono` |

La mezcla responde a iOS 7: títulos de tarjeta en una sans limpia (como Helvetica Neue en iOS) y cifras ultraligeras (como el reloj y la calculadora de iOS 7). Prata queda para los títulos de página y la marca, que dan el toque de lujo.

Las fuentes están autoalojadas con `@fontsource/prata` y `@fontsource-variable/jost`, importadas en `main.tsx`.

**Por qué las cifras van en Jost:** el "1" de Prata se confunde con una "l".

**Escala:**

- h1: `clamp(2rem, 3.2vw, 2.7rem)` en Prata.
- h2: 1.12rem y h3: 1.05rem, ambos en Jost 500.
- Cuerpo: 15px, peso 350, interlineado de 1.6.
- Etiquetas: 0.68 a 0.74rem en mayúsculas espaciadas.

**Reglas tipográficas:**

- Prata tiene un solo peso. Nunca aplicarle `bold` (hay `font-synthesis: none`).
- La palabra destacada en un titular va en `--gold` plano, sin degradado (por ejemplo, "suma." en el login).

---

## 3. Forma y espacio

| Elemento | Radio |
| --- | --- |
| Modales y tarjetas | 14px (`--radius`) |
| Contenedores grandes | 16px (`--radius-lg`) |
| Botones, campos, buscador, navegación | 10px (`--radius-sm`) |
| Control segmentado, placas de nivel | 6px (`--radius-xs`) |
| Insignias de estado y chips de filtro | Píldora (999px) |
| Logos de comercio | 11px, al estilo de los iconos de app |

**Espacio:** contenido con un ancho máximo de 1240px, padding lateral de `clamp(1.25rem, 4vw, 3.5rem)`, tarjetas con 1.5rem de padding (1.2rem en móvil) y áreas táctiles de 44px.

---

## 4. Superficies y materiales

- **Tarjeta (`.card`):** fondo plano `--cell` con borde `--line`. Sin sombra ni brillo.
- **Tarjeta destacada (`.card-gold`):** fondo `--night` con borde amarillo fino y sólido. Se reserva para el código QR y los datos del perfil.
- **Tarjeta de puntos (`.wallet`):** estilo Passbook. Degradado plano de oro profundo a negro, borde amarillo fino, etiqueta pequeña en amarillo y la cifra en Jost ultraligera blanca.
- **Cifras (`.stats-row`):** las estadísticas comparten un panel dividido por separadores de 1px, como una lista agrupada.
- **Barra lateral:** translúcida (`rgb(0 0 0 / .55)`) con `backdrop-filter: blur(24px) saturate(180%)`, como las barras de iOS 7. En móvil pasa a barra inferior tipo tab bar.
- **Halos ambientales:** degradados radiales de oro profundo detrás de la aplicación (`.shell::before`), que actúan como el "fondo de pantalla" que se ve a través de las barras translúcidas.

---

## 5. Componentes clave

| Componente | Estilo |
| --- | --- |
| Botón primario (`.btn-primary`) | Relleno `--gold` plano con texto `#111`. Hover a `--gold-light`. Sin sombra. |
| Botón secundario (`.btn`) | Contorno amarillo fino y texto amarillo, como el botón de la App Store de iOS 7. En hover se rellena de amarillo. |
| Botón ghost (`.btn-ghost`) | Solo texto amarillo, como los botones de texto de iOS 7. |
| Botón destructivo (`.danger`) | Texto rojo de sistema. En hover se rellena de rojo con texto blanco. |
| Navegación | El ítem activo usa texto e icono amarillos sobre un fondo amarillo al 10%, sin barras ni degradados. En móvil, solo texto e icono amarillos, como la tab bar de iOS 7. |
| Pestañas (`.tabs`) | **Control segmentado de iOS 7:** contorno amarillo de 1px, separadores verticales y el segmento activo relleno de amarillo con texto negro. |
| Chips de filtro | Píldora con contorno amarillo. El activo va relleno de amarillo con texto negro. |
| Insignias (`Badge`) | Píldora plana sin borde, con el color de sistema al 12% de fondo. |
| Interruptor (`input[type=checkbox]`) | Interruptor de iOS 7 de 46×28px, con el botón blanco y fondo verde al activarse. |
| Progreso (`Progress`) | Riel plano de 3px con relleno amarillo. |
| Anillo de progreso (`ProgressRing`) | Anillo SVG de 64px con trazo de 5px en amarillo y el porcentaje al centro. Se usa en las tarjetas de misión. |
| Campos y buscador | Campo con fondo `--surface` y foco amarillo. El buscador es un campo gris translúcido de radio 10px, como la barra de búsqueda de iOS 7. |
| Modal | Hoja translúcida (`rgb(28 28 30 / .86)`) con desenfoque de 30px, como las alertas de iOS 7. |
| Avisos (toasts) | Banner de notificación arriba al centro, translúcido y con desenfoque, que baja desde arriba. Un punto de color indica éxito (amarillo) o error (rojo). |
| Sellos del Pasaporte | Sin ganar: punteado ceniza. Ganado: fondo amarillo al 7% y sello amarillo girado -8°. |
| Insignias ganadas | Medallón relleno de amarillo con icono negro. |
| Enlaces "ver más" (`MoreLink`) | Texto amarillo con un icono `ArrowUpRight`. Nunca se usa el carácter "→". |

### Tarjeta de misión

Antes, la etiqueta del tipo, la fecha, el avance y el premio compartían filas horizontales y se superponían o partían en columnas angostas. Ahora la tarjeta se organiza así:

1. **Cabecera:** el `ProgressRing` a la izquierda y, a la derecha, la etiqueta del tipo (que puede pasar a otra línea), el nombre y "X de Y" (en Bs para las misiones de monto).
2. **Descripción** en gris.
3. **Filas agrupadas estilo Ajustes** (`dl.mission-facts`): "Premio" en amarillo, "Aplica en" si la misión no es global, y "Vence".

Las tarjetas usan `.missions-grid`, con columnas de 320px como mínimo.

### Tablas

Las celdas de acciones (`td.row`) se fuerzan a `display: table-cell` para que el flex no rompa la alineación de la tabla.

**Iconos:** se usa `lucide-react` con un trazo fino de 1.35 (`.lucide { stroke-width: 1.35 }`), en línea con los glifos de trazo fino de iOS 7.

---

## 6. Movimiento

- **Curva principal:** `--ease: cubic-bezier(0.16, 1, 0.3, 1)`.
- **Entrada de página:** los bloques suben 18px con un fundido, escalonados cada 60ms.
- **Microinteracciones:** entre 0.2 y 0.35s, animando solo `transform`, `opacity` y colores.
- **Avisos:** bajan 16px desde arriba. **Modales:** aparecen con un pequeño "pop".
- **Reducción de movimiento:** con `prefers-reduced-motion: reduce` se desactivan todas las animaciones.

---

## 7. Redacción visible

- Toda la interfaz está en español (Bolivia), con un tono sobrio y sin signos de exclamación.
- **Sin rayas largas (—) ni medias (–).** Los rangos usan guion simple ("10:00 - 22:00") y las celdas vacías muestran "-" o un texto como "Sin precio".
- Los avances se escriben "7 de 8" y no "7 / 8".
- El punto medio (·) se usa como máximo una vez por línea de metadatos.

---

## 8. Archivos

| Archivo | Contenido |
| --- | --- |
| `frontend/src/index.css` | Todos los tokens y estilos. |
| `frontend/src/components/ui.tsx` | Primitivas: `PageHeader`, `Card`, `CardHead`, `MoreLink`, `Badge`, `Stat`, `Progress`, `ProgressRing`, `Field`, `Modal`, `Empty`. |
| `frontend/src/pages/customer/MissionsPage.tsx` | Tarjetas de misión con anillo de progreso y filas agrupadas. |
| `frontend/src/layouts/AppShell.tsx` | Barra lateral, marca según el rol, clase de tema `shell-*`, barra del personal y enlace para saltar al contenido. |
| `frontend/src/pages/LoginPage.tsx` | Portada editorial. |
| `frontend/public/favicon.svg` | Monograma dorado sobre negro. |
| `frontend/index.html` | `theme-color #000000` y metadatos. |
