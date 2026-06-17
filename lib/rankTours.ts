// lib/rankTours.ts

const CATALOG_AVG_RATING = 4.6; // promedio del catálogo (después lo ajustás con tu dato real)
const MIN_REVIEWS = 100;        // umbral de confianza del Bayesiano

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

// 0 = helicópteros (arriba de todo), 1 = resto Grand Canyon, 2 = el resto
function priorityTier(tour: any): number {
  if (isHelicopter(tour)) return 0;
  if (tour.categorySlug === 'grand-canyon-tours') return 1;
  return 2;
}

export function rankTours(tours: any[]): any[] {
  return [...tours].sort((a, b) => {
    const tA = priorityTier(a), tB = priorityTier(b);
    if (tA !== tB) return tA - tB;
    return qualityScore(b) - qualityScore(a);
  });
}