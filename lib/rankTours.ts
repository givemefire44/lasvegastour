// lib/rankTours.ts

const CATALOG_AVG_RATING = 4.6; // promedio del catálogo (después lo ajustás con tu dato real)
const MIN_REVIEWS = 100;        // umbral de confianza del Bayesiano

// 🔧 PERILLA PARA TUNEAR LA MEZCLA
// Cada renglón define ORDEN + PROPORCIÓN. La grilla se arma por rondas:
// toma `chunk` tours de la 1ª categoría, `chunk` de la 2ª, ... y vuelve a
// empezar. `chunk` más alto = más proporción en la grilla.
//
// Acá los tours (foco del proyecto) van con chunk 3, y shows/nightlife
// (secundarios) con chunk 1: aparecen, pero en menor proporción y más abajo.
// Movés los renglones para reordenar y cambiás el número para más/menos peso.
const CATEGORY_PLAN: Array<{ slug: string; chunk: number }> = [
  { slug: 'helicopter-tours',   chunk: 3 },
  { slug: 'grand-canyon-tours', chunk: 3 },
  { slug: 'shows',              chunk: 1 }, // secundario, pero asoma 1 en el primer golpe de vista
  { slug: 'strip-tours',        chunk: 3 },
  { slug: 'hoover-dam-tours',   chunk: 3 },
  { slug: 'day-trips',          chunk: 3 },
  { slug: 'adventure-tours',    chunk: 3 },
  { slug: 'nightlife',          chunk: 1 }, // secundario
];

// Categorías no listadas arriba: orden al final y este chunk por defecto.
const DEFAULT_CHUNK = 2;

function qualityScore(tour: any): number {
  const R = tour.getYourGuideData?.rating ?? CATALOG_AVG_RATING;
  const v = tour.getYourGuideData?.reviewCount ?? 0;
  return (v * R + MIN_REVIEWS * CATALOG_AVG_RATING) / (v + MIN_REVIEWS);
}

function isHelicopter(tour: any): boolean {
  const t = (tour.title || '').toLowerCase();
  return t.includes('helicopter') || t.includes('heli ') ||
         t.includes('heli-') || t.includes('aerial') || t.includes('chopper');
}

// Clave de categoría usada para agrupar. Prioriza el categorySlug real;
// si no hay, cae al detector de helicópteros por título; si no, "other".
function categoryKey(tour: any): string {
  if (tour.categorySlug) return tour.categorySlug;
  if (isHelicopter(tour)) return 'helicopter-tours';
  return 'other';
}

export function rankTours(tours: any[]): any[] {
  // 1) Agrupar por categoría
  const groups = new Map<string, any[]>();
  for (const tour of tours) {
    const key = categoryKey(tour);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tour);
  }

  // 2) Ordenar cada grupo por calidad (mayor a menor)
  for (const list of groups.values()) {
    list.sort((a, b) => qualityScore(b) - qualityScore(a));
  }

  // 3) Definir orden + chunk por categoría: primero las del plan (las que
  //    existan), después el resto ordenado por la calidad de su mejor tour.
  const planned = CATEGORY_PLAN.filter(p => groups.has(p.slug));
  const plannedSlugs = new Set(planned.map(p => p.slug));
  const rest = [...groups.keys()]
    .filter(k => !plannedSlugs.has(k))
    .sort((a, b) => qualityScore(groups.get(b)![0]) - qualityScore(groups.get(a)![0]))
    .map(slug => ({ slug, chunk: DEFAULT_CHUNK }));
  const plan = [...planned, ...rest];

  // 4) Intercalar por tandas: `chunk` de cada categoría, en rondas, hasta vaciar
  const result: any[] = [];
  let remaining = tours.length;
  while (remaining > 0) {
    for (const { slug, chunk } of plan) {
      const list = groups.get(slug);
      if (!list || list.length === 0) continue;
      const take = list.splice(0, chunk);
      result.push(...take);
      remaining -= take.length;
    }
  }

  return result;
}
