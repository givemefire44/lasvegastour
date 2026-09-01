# REGLA DE ORO — no asumir sin comprobar

**Antes de afirmar algo, correr el comando que lo demuestra. En esta sesión.**

Aplica a: cualquier número, el estado de cualquier cosa, si un archivo o campo
existe, si algo sigue funcionando, y todo lo recordado de una sesión anterior.
Si no se pudo verificar, **decirlo con esas palabras**: "no lo verifiqué",
"esto lo estoy infiriendo". Nunca una afirmación redonda sin respaldo.

**Un resultado negativo es el que más engaña.** Un grep que no encuentra nada
puede significar que no está, o que el patrón estaba mal.

**Acá hay un caso propio que lo prueba:** se intentó deducir del corpus si un
show seguía abierto y falló 4 de 4. Ver más abajo. En este sitio, "sigue
operando" NUNCA es una inferencia: es un dato externo con fecha.

Si Mario pregunta "¿estás seguro?", ir a medirlo otra vez.

---

# lasvegastour

Next.js + Sanity. Sitio de tours de Las Vegas del portfolio Intercoper, de
Mario Dalo. Es el proyecto **origen** del que se portaron varias piezas al
resto del portfolio (el sistema Viator, entre otras).

## Lo que hay que saber antes de tocar nada acá

**1. El corpus NO vive en este repo, y lo que hay acá es una trampa.**
`tour-importer/` tiene una copia **VIEJA** de los scripts de corpus, anterior a
que el pipeline se parametrizara con `--dest`, más un `colosseum-corpus.db` que
es una copia rancia de Roma. Hay un `_LEER-corpus-obsoleto.md` avisando.
**No correr los scripts de corpus desde acá.**

El pipeline real y los 4 corpus están en `colosseumroman-blog/tour-importer`:

```
node estado-corpus.mjs          # desde colosseumroman-blog/tour-importer
```

y `PLAYBOOK-CORPUS.md` tiene el método completo.

**2. Falta la mitad del Research Program.** `isPillar` sí existe en el schema
de Sanity, pero **`SchemaOrgHead.tsx` no emite nada del grafo** (`Dataset`,
`isBasedOn`, `isPartOf`, `hasPart`) y **no hay página `/…-research`** ni
biblioteca de guías. Sin eso los artículos salen como artículos comunes y
pierden la capa que los hace citables por motores de IA. Hay que construirlo
**antes** de publicar el primer artículo de research — la skill
`research-program-system` está para eso.

**3. Es el único destino MULTI-VERTICAL del portfolio.** No es un monumento: son
helicópteros, shows, parques, la Esfera y más. El corpus está etiquetado por
vertical (`tag-verticals.mjs`) y el análisis se corre **una vez por vertical**
(`cluster-and-hypothesize --vertical=…`), porque los pain points de un vuelo
(recargo por peso, cancelación por viento) no se parecen a los de un show
(asiento vs precio, reventa, edad mínima). Decisión de Mario: **un solo
Research Program con hubs por vertical**, no N programas.

**4. En Vegas los shows CIERRAN.** Es el riesgo específico de este sitio.
Verificado el 31 ago 2026, antes de correr Apify: de 14 objetivos, 3 estaban
muertos o cerrando (David Copperfield cerró el 30 abr 2026, Mad Apple cierra el
5 sep, Awakening el 10 oct). Y cambian de sede: Shin Lim se mudó del Mirage al
Venetian, así que las reseñas viejas nombran un hotel que ya no existe.

**No se puede deducir del corpus si algo sigue abierto.** Se probó y falló 4 de
4: Zumanity, Le Rêve, el Mirage y el Tropicana puntuaron como "vivos". Peor,
la señal se invierte, porque un show que cierra genera un pico de conversación.
El estado es un dato externo, con fecha, y va declarado en
`data/canonical-facts.json` — que todavía **no existe acá**; el modelo está en
`colosseumroman-blog/data/canonical-facts.json`.

---

## Antes de afirmar, medir

Un número dicho de memoria, leído de una UI o deducido de un patrón **no es un
dato verificado**. Cuando algo no se pudo comprobar, decirlo con esas palabras.
Mario prefiere un "no lo verifiqué" antes que una afirmación redonda que
después se cae. **Abrir la imagen antes de escribir su alt**: el nombre del
archivo no predice el contenido.

## Aprobación

**Nada se publica ni se commitea sin visto bueno explícito de Mario.** Los
scripts de modificación van con dry-run por defecto y `--execute` para aplicar.

## Los tres carriles de los datos

- **Tours** (`_type == "post"`) — **no se tocan nunca.** El precio lo pone el
  operador y viene de su feed.
- **Corpus** — mediciones fechadas, congeladas. Se citan siempre con su ventana
  temporal ("en reseñas de 2023 a 2026"), nunca como dato de hoy.
- **Dato vigente** (precio, horario, si un show existe, en qué sala) — **el
  corpus no es fuente.** Lista declarada con fecha de verificación.

## Reglas de contenido que no se negocian

- **Ningún enlace saliente.** Excepción: fuentes oficiales no transaccionales.
- **Sin conteos exactos del catálogo** en copy estático.
- **No inventar reseñas ni citas.**
- **No hacer artículos por cupo.** Sin evidencia propia, se para.
- Textos firmados por Mario Dalo: skill `mario-dalo-voice`.

## Entorno

Windows + PowerShell. `node -e` con comillas y paréntesis rompe: escribir un
`.mjs` en el scratchpad. Commits multilínea con `git commit -F <archivo>`.
