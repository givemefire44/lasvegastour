# Anatomía de un producto Viator

**Qué ofrece, cómo lo enmarca, y qué estamos tomando.**

Mapa para dejar de trabajar a los tumbos: entender la estructura del origen antes de decidir qué ingerir y cómo. Anclado en la doc oficial de la Affiliate API + los payloads reales que ya vimos (5516P7 multi-día, 26719P4 ACTIVITY, etc.). Los porcentajes reales de tu catálogo los da `profile-viator.mjs`.

Leyenda de "Qué tomamos": ✅ ya lo usamos · ⚠️ parcial · ❌ en la mesa (oportunidad).

---

## 0. Cómo se obtiene (los endpoints)

Somos **VBA (Viator Branded Affiliate)**: acceso total al contenido, la venta se cierra en viator.com vía link con cookie de comisión. Nada de booking endpoints.

| Endpoint | Da | Lo usamos |
|---|---|---|
| `/products/{code}` | El contenido completo de UN producto (todo lo de abajo) | ✅ (viator-client) |
| `/locations/bulk` | Resuelve los refs `LOC-...` a nombres reales (máx. 500/llamada, cachear mensual) | ✅ |
| `/products/modified-since` | Ingesta masiva incremental del catálogo | ❌ (hoy iteramos por slug de Sanity) |
| `/products/reviews` | Texto de reviews + fotos de viajeros | ❌ (y ojo: política no-index sobre texto) |
| `/products/photos` | Fotos | ⚠️ (las imágenes vienen en el detail) |
| availability/pricing | Precio vivo, pricing por unidad/grupo | ✅ (cron-prices) |

**Estrategia recomendada por Viator:** cachear (TTL < 24h) o ingerir cada 24h. Rate limit **150 req / 10s** (no multihilo; si 429, esperar 2s). → nuestro corpus SQLite es exactamente el patrón de "data centralization" que la doc recomienda para quien además vende otras fuentes (GYG).

---

## 1. Cómo Viator CLASIFICA un producto (la grilla)

Tres ejes de categorización + tags. **Esto no lo estamos aprovechando** y es oro para el clasificador y para "Is It Worth It".

- **Destino** (`destId`): COUNTRY / REGION / CITY. Un producto puede operar en varios destinos.
- **Categoría / subcategoría** (`catId`/`subCatId`): p. ej. "Air, Helicopter & Balloon Tours → Helicopter Tours".
- **Atracción** (`seoId`): vínculo a un POI conocido (Bellagio Fountains, Black Canyon, Hoover Dam...). Permite cross-sell y páginas por atracción.
- **Tags jerárquicos** (`parentTagId`): taxonomía en árbol. Incluye **tags de CALIDAD** que Viator usa para rankear:
  - `367652` Top Product · `21972` Excellent Quality · `22143` Best Conversion · `22083` Likely To Sell · `367653`/`367654` Low Cancellation.
- **`translationLevel`**: `0` nativo del supplier · `80` traducido por máquina · `90/100` traducido por humano. (Filtro de confianza sobre el copy.)

**Qué tomamos:** ❌ Nada de esto. Tenemos nuestro `classifyCategory` propio (8 categorías) que ignora la taxonomía de Viator.
**Oportunidad:** usar los quality tags como señal objetiva en el verdict "Is It Worth It" y para priorizar qué tours profundizar; usar `seoId`/atracción para los hubs; respetar `translationLevel` para no amplificar copy auto-traducido.

---

## 2. Identidad y copy

`title`, `description` (prosa larga, traducible), `supplier`/operator, `productCode`.

- La `description` es marketing del supplier ("unforgettable / majestic / Nestled") → por eso el guard de advisor *sintetiza* y borra adjetivos, no copia.
- **Qué tomamos:** ✅ title, description, provider.

---

## 3. El ITINERARIO — los 5 tipos (lo que nos venía sorprendiendo)

Viator migró a itinerario estructurado, **pero solo si el supplier actualizó el producto**. De ahí la variedad. `itinerary.itineraryType`:

| Tipo | Dónde vive el recorrido | Estado nuestro |
|---|---|---|
| **STANDARD** | `itineraryItems[]` — cada parada: `ref` (LOC-), `duration`, `admissionIncluded`, `passByWithoutStopping`, `description` | ✅ mapeado a paradas |
| **MULTI_DAY_TOUR** | `days[].items[]` — un overnight (ej. el ranch 5516P7) | ✅ mapeado |
| **ACTIVITY** | `pointsOfInterest[].ref` (solo refs) + `activityInfo.description` (la prosa con las paradas en orden) | ✅ texto (recién) |
| **UNSTRUCTURED** | `unstructuredItinerary` / `unstructuredDescription` (legacy, supplier no migró) | ✅ texto (recién) |
| **HOP_ON_HOP_OFF** | `routes[].stops` | ❌ pendiente (raro en este catálogo; raw preservado) |

- **Duración:** `fixedDurationInMinutes` (todas las rutas igual) o `variableDurationFromMinutes`/`ToMinutes` (rutas distintas).
- **Refs `LOC-...`** → siempre resolver vía `/locations/bulk` para tener nombres.
- **Aquí estaba el caso "4 horas":** el dato real ("3 horas") no estaba en la prosa sino en `additionalInfo`; lo inventaba el modelo porque no le llegaba. → la lección que motivó el corpus.

---

## 4. Logística (`logistics`)

- `start` — **meeting point** real (con `ref` a una location).
- `end` — punto final.
- `travelerPickup` — `allowCustomTravelerPickup` (texto libre) + lista de pickup locations (hotel pickup).
- `redemption` — cómo se canjea (voucher, etc.).

**Qué tomamos:** ⚠️ poco. **Oportunidad GEO:** meeting point y pickup son hechos citables y útiles para Practical Info ("hotel pickup included from the Strip").

---

## 5. Qué incluye / qué no (`inclusions` / `exclusions`)

Listas estructuradas. Las exclusions suelen contener los **add-ons de pago** (en el ranch: horseback, wagon, buffalo safari, shooting range = "extra fee").
**Qué tomamos:** ✅ ambas, a las secciones de datos.

---

## 6. `additionalInfo` — los HECHOS operativos (la mina factual)

Array de `{ type, text }`. Cada item es un hecho operativo verificable: confirmación, accesibilidad (silla de ruedas), qué llevar, restricciones, edades, "no recomendado para...", duración real de tramos, etc.

- **Acá vivía el "Approximately 3 hours"** que el body no tenía.
- Los `type` exactos que aparecen en TU catálogo los lista el profiler (`▸ additionalInfo — TIPOS DE HECHO`).

**Qué tomamos:** ✅ (recién, vía `buildFactSheet`). Es la fuente más rica para que los injectors digan hechos y no inventos.

---

## 7. Cancelación (`cancellationPolicy`)

Política con texto que **Viator exige mostrar EXACTO** (no parafrasear). Trae `type` (ej. standard 24h, all-sales-final) + descripción literal.
**Qué tomamos:** ✅ `cancellationText`. Regla: en la prosa no lo reescribimos, se cita o se resume sin alterar el plazo.

---

## 8. Reviews y fotos (`reviews`)

- `combinedAverageRating`, `totalReviews`.
- `reviewCountTotals[]` — **distribución por estrellas** (cuántos 5★, 4★...). Dato citable de oro.
- `sources[]` — de dónde vienen (Viator, Tripadvisor).
- Texto de reviews + fotos vía `/products/reviews` y `/products/photos`.

**Qué tomamos:** ✅ rating, count, distribución. **Texto de reviews: ❌ a propósito** — política de autenticidad/no-index de Viator y nuestra propia regla (no indexar texto ajeno). Las fotos sí son usables.

---

## 9. Variantes / opciones (`productOptions`)

Cada opción = una variante del tour: horarios de salida, mix de pasajeros, inclusiones/add-ons, y **precio por opción**.
**Qué tomamos:** ❌. **Oportunidad:** de acá salen los "extra fee" y las diferencias de horario/privado-vs-compartido que hoy adivinamos. Útil para "What's the difference" y para precios por variante.

---

## 10. Precio y disponibilidad

`pricingInfo`/`fromPrice` en el detail (precio "desde") + endpoint de availability para precio vivo y pricing por unidad/grupo.
**Qué tomamos:** ✅ price (de availability), refrescado por `cron-prices`. Es el valor volátil principal de la prosa.

---

## 11. Flags y metadata operativa

`bookingQuestions` (qué pregunta Viator al reservar), `ageBands` (edades permitidas), `ticketInfo`, `skipTheLine`, `privateTour`, `maxTravelersInSharedTour`, `flags`, zona horaria, status.
**Qué tomamos:** ⚠️ algún booleano suelto (ej. wheelchair). Varios son citables (skip-the-line, private, tamaño máx. de grupo).

---

## Resumen: qué tomamos hoy vs qué está en la mesa

**Ya lo usamos (✅):** title, description, provider, inclusions, exclusions, additionalInfo, cancellationText, itinerario (4 de 5 tipos), rating + count + distribución de estrellas, imágenes, precio vivo.

**En la mesa (❌/⚠️), por valor GEO:**
1. **Tags de calidad de Viator** (Top Product, Excellent Quality...) → señal objetiva para el verdict y para priorizar.
2. **`productOptions`** → add-ons/precios por variante (el "extra fee" real, privado vs compartido).
3. **Logística** (meeting point, hotel pickup) → Practical Info citable.
4. **Atracción (`seoId`)** → hubs por POI y cross-linking.
5. **`reviewCountTotals`** ya lo tomamos, pero podemos *citarlo* más ("X% dejó 5★").
6. **`/products/modified-since`** → ingesta incremental más limpia que iterar Sanity.
7. **HOP_ON_HOP_OFF** → 5º tipo de itinerario, si aparece.
8. **`translationLevel`** → no amplificar copy auto-traducido.

---

*Para los números reales de tu catálogo (distribución de tipos de itinerario, % de cobertura de cada campo, los `type` de additionalInfo y las claves que ni leemos): correr `node profile-viator.mjs` o `--from=corpus` una vez ingestado.*
