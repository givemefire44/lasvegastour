// La linea de distancia del tour, armada SOLO desde el documento geoDestination.
// Es la misma cifra que va al JSON-LD: no redondear ni reescribir aca, se redondea al medir.

export interface GeoDestination {
  name: string;
  point?: string;
  lat: number;
  lng: number;
  milesFromStrip: number;
  driveMinutesOneWay: number;
  direction?: string;
  altRoute?: { label?: string; miles?: number; minutes?: number; until?: string };
  measuredAt?: string;
}

export function formatMiles(mi: number): string {
  return mi < 100 ? String(Math.round(mi * 10) / 10) : String(Math.round(mi));
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  const hs = h ? `${h} hour${h > 1 ? 's' : ''}` : '';
  const ms = m ? `${m} minutes` : '';
  return [hs, ms].filter(Boolean).join(' ');
}

// El desvio se muestra mientras su fecha "until" no haya pasado. Pasada la fecha hay que volver a
// verificar el cierre (puede extenderse): no se asume que termino.
export function activeAltRoute(geo: GeoDestination, today = new Date()) {
  const a = geo.altRoute;
  if (!a?.miles || !a?.minutes || !a?.label) return null;
  if (a.until && new Date(`${a.until}T23:59:59`) < today) return null;
  return a;
}

// El destino como Place de schema.org. Mismas cifras y misma frase que la linea visible.
// Va en "itinerary" de un TouristTrip: Product no tiene ninguna propiedad valida para un lugar.
export function destinationPlaceSchema(geo: GeoDestination, today = new Date()) {
  return {
    '@type': 'Place',
    name: geo.name,
    ...(geo.point && geo.point !== geo.name && { alternateName: geo.point }),
    description: driveTimeSentences(geo, today).join(' '),
    geo: { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lng },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Driving distance from the Las Vegas Strip', value: geo.milesFromStrip, unitCode: 'SMI', unitText: 'miles' },
      { '@type': 'PropertyValue', name: 'Drive time each way from the Las Vegas Strip', value: geo.driveMinutesOneWay, unitCode: 'MIN', unitText: 'minutes' },
    ],
  };
}

export function driveTimeSentences(geo: GeoDestination, today = new Date()): string[] {
  const dir = geo.direction ? ` ${geo.direction}` : '';
  const out = [
    `${geo.name} sits ${formatMiles(geo.milesFromStrip)} miles${dir} of the Strip — about ${formatDuration(geo.driveMinutesOneWay)} each way by road.`,
  ];
  const alt = activeAltRoute(geo, today);
  if (alt) out.push(`${alt.label}, the drive is ${formatMiles(alt.miles!)} miles, about ${formatDuration(alt.minutes!)} each way.`);
  return out;
}
