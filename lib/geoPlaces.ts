// Que fichas geoDestination describe cada page y cada hub, y como se traen de Sanity.
// Los mapeos guardan solo ids; las coordenadas y las cifras se leen siempre de la ficha.

import pageDestinations from '@/data/page-destinations.json';
import hubDestinations from '@/data/hub-destinations.json';
import type { GeoDestination } from '@/lib/driveTimeLine';
export { placesAbout } from '@/lib/driveTimeLine';

export const GEO_DESTINATION_FIELDS =
  '"id": destinationId.current, name, point, lat, lng, milesFromStrip, driveMinutesOneWay, direction, altRoute, measuredAt';

export const GEO_DESTINATIONS_QUERY =
  `*[_type == "geoDestination" && destinationId.current in $ids]{ ${GEO_DESTINATION_FIELDS} }`;

const PAGES = (pageDestinations as { pages: Record<string, string[]> }).pages;
const HUBS = (hubDestinations as { hubs: Record<string, string[]> }).hubs;
const CATEGORIES = (hubDestinations as { categories: Record<string, string[]> }).categories;

export const destinationIdsForPage = (slug: string) => PAGES[slug] || [];
export const destinationIdsForHub = (slug: string) => HUBS[slug] || [];
export const destinationIdsForCategory = (slug: string) => CATEGORIES[slug] || [];

// Respeta el orden del mapeo (en un comparativo, el primero es el que nombra primero el titulo).
// Un id sin ficha en Sanity se descarta: nunca se inventa un Place.
export function orderedGeo(ids: string[], docs: GeoDestination[] | null | undefined): GeoDestination[] {
  const byId = new Map((docs || []).map((d) => [d.id, d]));
  return ids.map((id) => byId.get(id)).filter((d): d is GeoDestination => Boolean(d));
}
