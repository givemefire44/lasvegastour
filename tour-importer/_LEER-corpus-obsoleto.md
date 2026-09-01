# ⚠️ El sistema de corpus de esta carpeta está OBSOLETO

**No usar** `init-corpus-db.mjs`, `enrich-corpus.mjs`, `cluster-and-hypothesize.mjs`,
`clean-corpus-noise.mjs`, `produce-article.mjs` ni `design-hub-architecture.mjs`
desde acá.

Son una copia **anterior a la parametrización por destino** (30 jul 2026): no
conocen `corpus-config.mjs`, no aceptan `--dest`, y no tienen la bandera
`--stage` ni ninguna de las correcciones posteriores. La `colosseum-corpus.db`
que está en esta carpeta es una copia vieja del corpus de Roma, no de Las Vegas.

## Dónde vive el pipeline vigente

```
C:\Users\Noxi-PC\colosseumroman-blog\tour-importer\
```

Ahí están los cuatro destinos parametrizados — `colosseum`, `vatican`,
`trastevere` y `lasvegas` — y todo se corre con `--dest lasvegas`.

El corpus de Las Vegas es `lasvegas-corpus.db`, en esa carpeta.

## Lo que sí se sigue usando de acá

Todo lo que NO es corpus: el importador de tours, los crons de precios, los
scripts de Sanity de este sitio. Solo el subsistema de corpus está duplicado.

(Nota puesta el 16 ago 2026, al arrancar el research de Las Vegas.)
