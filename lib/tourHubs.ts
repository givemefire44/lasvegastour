import hubData from '@/data/tourHubs.json';

export interface TourHub {
  slug: string;
  title: string;
  shortTitle: string;
  destination: string;
  matchKeywords: string[];
  matchPrice?: { max?: number; min?: number };
  matchFeatures: Record<string, boolean>;
  icon: string;
  type: string;
}

const hubs = hubData.hubs as TourHub[];

export function getAllHubSlugs(): string[] {
  return hubs.map(h => h.slug);
}

export function getHubBySlug(slug: string): TourHub | null {
  return hubs.find(h => h.slug === slug) || null;
}

export function isHubSlug(slug: string): boolean {
  return hubs.some(h => h.slug === slug);
}

export function getAllHubs(): TourHub[] {
  return hubs;
}

/**
 * Builds a GROQ filter for matching tours to a hub.
 * Supports keyword matching, feature flags, and price filtering.
 */
export function buildHubGroqFilter(hub: TourHub): { filter: string; params: Record<string, any> } {
  const conditions: string[] = [];
  const params: Record<string, any> = {};

  // Keyword matching on title (case-insensitive via GROQ match)
  if (hub.matchKeywords.length > 0) {
    const keywordConditions = hub.matchKeywords.map((kw, i) => {
      const paramName = `kw${i}`;
      params[paramName] = `*${kw}*`;
      return `title match $${paramName}`;
    });
    conditions.push(`(${keywordConditions.join(' || ')})`);
  }

  // Feature matching (tourFeatures fields)
  if (Object.keys(hub.matchFeatures).length > 0) {
    const featureConditions = Object.entries(hub.matchFeatures).map(
      ([key, val]) => `tourFeatures.${key} == ${val}`
    );
    if (conditions.length > 0) {
      conditions[0] = `(${conditions[0]} || ${featureConditions.join(' || ')})`;
    } else {
      conditions.push(`(${featureConditions.join(' || ')})`);
    }
  }

  // Price filtering
  if (hub.matchPrice) {
    if (hub.matchPrice.max) {
      conditions.push(`tourInfo.price <= ${hub.matchPrice.max}`);
    }
    if (hub.matchPrice.min) {
      conditions.push(`tourInfo.price >= ${hub.matchPrice.min}`);
    }
  }

  const matchFilter = conditions.length > 0 ? `(${conditions.join(' && ')})` : 'true';
  // Excluir tours retirados de TODOS los hubs, en un solo lugar.
  const filter = `${matchFilter} && discontinued != true`;
  return { filter, params };
}

/**
 * Encuentra el hub al que pertenece un tour (mismo criterio que buildHubGroqFilter).
 * Se usa como destino del 301 cuando el tour se discontinúa.
 * Devuelve el hub con más keywords coincidentes, o null si ninguno aplica.
 */
export function findHubForTour(tour: {
  title?: string;
  tourFeatures?: Record<string, boolean>;
  tourInfo?: { price?: number };
}): TourHub | null {
  const title = (tour.title || '').toLowerCase();
  const price = tour.tourInfo?.price;

  const matching = hubs.filter(hub => {
    const hasCriteria = (hub.matchKeywords?.length || 0) > 0 || Object.keys(hub.matchFeatures || {}).length > 0;
    let groupMatch = true;
    if (hasCriteria) {
      const kwMatch = (hub.matchKeywords || []).some(kw => title.includes(kw.toLowerCase()));
      const featMatch = Object.entries(hub.matchFeatures || {}).some(([k, v]) => tour.tourFeatures?.[k] === v);
      groupMatch = kwMatch || featMatch;
    }
    let priceOk = true;
    if (hub.matchPrice) {
      if (hub.matchPrice.max != null && (price == null || price > hub.matchPrice.max)) priceOk = false;
      if (hub.matchPrice.min != null && (price == null || price < hub.matchPrice.min)) priceOk = false;
    }
    return groupMatch && priceOk;
  });

  if (matching.length === 0) return null;
  matching.sort((a, b) => {
    const count = (h: TourHub) => (h.matchKeywords || []).filter(kw => title.includes(kw.toLowerCase())).length;
    return count(b) - count(a);
  });
  return matching[0];
}