// src/viator-client.js
// Cliente de la Viator Partner API (Basic Access) para lasvegastour.com.
// Archivo NUEVO, al lado del scraper de GYG (que queda como respaldo).
// NO scrapea: consume la API y devuelve el MISMO shape de `tourData` que
// ya consumen contentGenerator.js y sanityUploader.js. Drop-in para el pipeline.
//
// Endpoints usados (todos disponibles en Basic Access):
//   GET  /products/{product-code}            -> detalle completo (contenido)
//   GET  /availability/schedules/{code}      -> fromPrice (el detalle no trae monto)
//   POST /locations/bulk                     -> nombres de las paradas del itinerario
//
// vegas-viator-client

import * as configModule from '../config.js';

const config = configModule.config || configModule.default;

const VIATOR_BASE = 'https://api.viator.com/partner';

// Credenciales: van en config.js / .env, NUNCA hardcodeadas.
const API_KEY  = config.viator?.apiKey   || process.env.VIATOR_API_KEY  || '';
const CAMPAIGN = config.viator?.campaign || 'lasvegastour'; // tracking por sitio

const HEADERS = {
  'exp-api-key': API_KEY,
  'Accept': 'application/json;version=2.0',
  'Accept-Language': 'en-US',
  'Content-Type': 'application/json'
};

// ----------------------------------------------------------------------------
// HTTP helpers
// ----------------------------------------------------------------------------
async function viatorGet(path) {
  const res = await fetch(`${VIATOR_BASE}${path}`, { method: 'GET', headers: HEADERS });
  if (!res.ok) throw new Error(`Viator GET ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function viatorPost(path, body) {
  const res = await fetch(`${VIATOR_BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Viator POST ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

// ----------------------------------------------------------------------------
// Text + format helpers
// ----------------------------------------------------------------------------

// Normaliza texto del proveedor: espacios, caracteres de control, paréntesis
// full-width que algunos operadores meten, y comillas/guiones raros.
function clean(text) {
  if (!text) return '';
  return String(text)
    .replace(/\uFF08/g, '(').replace(/\uFF09/g, ')')   // （ ） full-width -> ( )
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Convierte el objeto duration de Viator a un string legible tipo GYG.
//  { fixedDurationInMinutes } | { variableDurationFromMinutes, variableDurationToMinutes }
function formatDuration(dur) {
  if (!dur) return 'N/A';
  const toUnit = (min) => {
    if (min % 60 === 0) return { v: min / 60, u: 'hour' };
    if (min >= 60)      return { v: +(min / 60).toFixed(1), u: 'hour' };
    return { v: min, u: 'minute' };
  };
  if (dur.fixedDurationInMinutes) {
    const { v, u } = toUnit(dur.fixedDurationInMinutes);
    return `${v} ${u}${v === 1 ? '' : 's'}`;
  }
  if (dur.variableDurationFromMinutes && dur.variableDurationToMinutes) {
    const a = toUnit(dur.variableDurationFromMinutes);
    const b = toUnit(dur.variableDurationToMinutes);
    // mismo unit -> "10-11 hours"; distinto -> usa el mayor
    if (a.u === b.u) return `${a.v}-${b.v} ${b.u}${b.v === 1 ? '' : 's'}`;
    return `${b.v} ${b.u}${b.v === 1 ? '' : 's'}`;
  }
  return 'N/A';
}

// Texto de cada inclusion/exclusion: usa description, cae a otherDescription.
function lineText(item) {
  return clean(item.description || item.otherDescription || item.typeDescription || '');
}

// Landmarks de la región (Vegas/Southwest) para rescatar el nombre de una parada
// cuando /locations/bulk la devuelve sin nombre (puntos propios del operador).
// Más específicos primero, para que matchee el más preciso. Ajustar por destino
// si se clona el cliente a otra ciudad.
const LANDMARKS = [
  'Grand Canyon West Rim', 'Grand Canyon South Rim', 'Grand Canyon Skywalk', 'Grand Canyon',
  'Hoover Dam', 'Lake Mead', 'Colorado River', 'Antelope Canyon', 'Horseshoe Bend',
  'Zion National Park', 'Zion', 'Bryce Canyon', 'Death Valley', 'Red Rock Canyon', 'Red Rock',
  'Valley of Fire', 'Mojave Desert', 'Eagle Point', 'Guano Point', 'Seven Magic Mountains',
  'Joshua Tree Forest', 'Fremont Street', 'Bellagio', 'Las Vegas Strip'
];

function findLandmark(text) {
  const t = text || '';
  for (const lm of LANDMARKS) {
    const re = new RegExp(`\\b${lm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(t)) return lm;
  }
  return '';
}

// Una parada es "logística" (no es un highlight) si pasa de largo o si su
// descripción habla de pick-up / drop-off en hotel.
function isLogisticsStop(step) {
  if (step.passBy) return true;
  return /\bpick[- ]?up\b|\bdrop[- ]?off\b|\bhotel pickup\b/i.test(step.description || '');
}

// ----------------------------------------------------------------------------
// Location resolution (los itineraryItems traen solo refs LOC-..., no nombres)
// ----------------------------------------------------------------------------
async function resolveLocationNames(refs) {
  const unique = [...new Set(refs.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const data = await viatorPost('/locations/bulk', { locations: unique });
    const map = {};
    for (const loc of (data.locations || [])) {
      map[loc.reference] = clean(loc.name || '');
    }
    return map;
  } catch (e) {
    console.log(`   WARN locations/bulk: ${e.message} (sigo con descripciones)`);
    return {};
  }
}

// ----------------------------------------------------------------------------
// MAPEO PURO  (Viator product detail -> tourData)  — testeable sin red
// ----------------------------------------------------------------------------
export function mapProductToTourData(detail, { price = null, locationNames = {} } = {}) {
  const it = detail.itinerary || {};
  // STANDARD usa itineraryItems; MULTI_DAY_TOUR usa days[].items (un overnight es multi-day).
  const items = (Array.isArray(it.itineraryItems) && it.itineraryItems.length) ? it.itineraryItems
    : (Array.isArray(it.days) ? it.days.flatMap((d) => d.items || []) : []);

  // --- itinerario estructurado (se preserva para la futura sección GEO del template) ---
  const itinerary = items.map((step) => {
    const ref = step.pointOfInterestLocation?.location?.ref || '';
    const name = locationNames[ref] || '';
    const dur = step.duration || {};
    const minutes = dur.fixedDurationInMinutes ||
      (dur.variableDurationToMinutes ? dur.variableDurationToMinutes : null);
    return {
      name,
      ref,
      passBy: !!step.passByWithoutStopping,
      admissionIncluded: step.admissionIncluded || 'NOT_APPLICABLE', // YES | NO | NOT_APPLICABLE
      durationMinutes: minutes,
      description: clean(step.description || '')
    };
  });

  // Itinerario no-estructurado. Cubrimos los tipos que no traen paradas mapeables:
  //  - UNSTRUCTURED: texto libre en unstructuredItinerary / unstructuredDescription
  //  - ACTIVITY: la prosa del recorrido vive en activityInfo.description (nombra las paradas en orden)
  // Si no hubo paradas estructuradas, lo capturamos para que el fact sheet no quede vacío.
  const itineraryText = itinerary.length
    ? ''
    : clean(it.unstructuredItinerary || it.unstructuredDescription || it.activityInfo?.description || '');

  // --- highlights: paradas-sight (no logística), con nombre limpio ---
  // 1) nombre resuelto por /locations/bulk; 2) si vino vacío (punto propio del
  // operador, ej. Hoover Dam), se rescata un landmark conocido de la descripción;
  // 3) si no hay ni nombre ni landmark, se omite. Sin oraciones largas truncadas.
  const highlights = itinerary
    .filter((s) => !isLogisticsStop(s))
    .map((s) => s.name || findLandmark(s.description))
    .filter(Boolean);

  // --- includes / excludes ---
  const includes = (detail.inclusions || []).map(lineText).filter(Boolean);
  const excludes = (detail.exclusions || []).map(lineText).filter(Boolean);

  // --- languages -> "English" (de languageGuides) ---
  const langCodes = [...new Set((detail.languageGuides || []).map((g) => (g.language || '').slice(0, 2)))];
  const LANG = { en: 'English', es: 'Spanish', fr: 'French', it: 'Italian', de: 'German', pt: 'Portuguese', ja: 'Japanese' };
  const languages = langCodes.map((c) => LANG[c] || c).join(', ') || 'English';

  // --- reviews ---
  const rv = detail.reviews || {};
  const rating = rv.combinedAverageRating ? Math.round(rv.combinedAverageRating * 10) / 10 : 0;
  const reviewCount = rv.totalReviews || 0;

  // --- features (mapea a lo que el uploader lee de tourData.features.*) ---
  // CONFIRMADOS contra el uploader: skipTheLine, smallGroup.
  // El resto se deriva de Viator con los nombres del doc tourFeatures; si tu
  // scraper usa otra clave para alguno, decímelo y lo ajusto (degrada a false).
  const maxShared = it.maxTravelersInSharedTour || null;
  const features = {
    skipTheLine: !!it.skipTheLine,
    smallGroup: it.privateTour === false && !!maxShared && maxShared <= 15,
    freeCancellation: (detail.cancellationPolicy?.type === 'STANDARD'),
    wheelchairAccessible: (detail.additionalInfo || []).some((a) => a.type === 'WHEELCHAIR_ACCESSIBLE'),
    audioGuide: false, // Viator no lo expone de forma fiable en Basic
    hostGuide: (detail.languageGuides || []).length > 0,
    groupSize: it.privateTour ? 'Private' : (maxShared ? `Up to ${maxShared}` : 'N/A')
  };

  // --- imágenes: la variante más grande de cada imagen (cover primero) ---
  const images = (detail.images || [])
    .slice()
    .sort((a, b) => (b.isCover === true) - (a.isCover === true))
    .map((img) => {
      const best = (img.variants || []).reduce((m, v) => (v.width > (m?.width || 0) ? v : m), null);
      return best?.url || null;
    })
    .filter(Boolean);

  // --- bookingUrl: el productUrl YA viene con tu pid/mcid; sumamos campaign por sitio ---
  let bookingUrl = detail.productUrl || '';
  if (bookingUrl && !/[?&]campaign=/.test(bookingUrl)) {
    bookingUrl += (bookingUrl.includes('?') ? '&' : '?') + `campaign=${encodeURIComponent(CAMPAIGN)}`;
  }

  return {
    // ---- campos que consume el pipeline actual (mismo shape que el scraper GYG) ----
    title: clean(detail.title),
    rating,
    reviewCount,
    price,                          // viene de /availability/schedules (ver fetchViatorTour)
    duration: formatDuration(it.duration),
    description: clean(detail.description),
    highlights,
    includes,
    excludes,
    languages,
    provider: clean(detail.supplier?.name || ''),
    reviewQuotes: [],               // Viator no da texto de reviews y prohíbe indexarlo
    features,
    images,
    url: bookingUrl,

    // ---- extras de Viator (el generador actual los ignora; quedan para el bloque GEO y el uploader) ----
    source: 'viator',
    productCode: detail.productCode,
    itinerary,                      // paradas con tiempos y admission -> futura sección "What to expect"
    itineraryText,                  // fallback texto libre cuando el itinerario es UNSTRUCTURED
    raw: detail,                    // detail crudo de Viator -> el corpus lo persiste verbatim (raw_json)
    reviewDistribution: rv.reviewCountTotals || [],   // [{rating, count}] para el dato citable
    reviewSources: rv.sources || [],
    cancellationType: detail.cancellationPolicy?.type || null,
    cancellationText: clean(detail.cancellationPolicy?.description || ''),
    productOptions: (detail.productOptions || []).map((o) => ({
      code: o.productOptionCode, title: clean(o.title), description: clean(o.description)
    })),
    additionalInfo: (detail.additionalInfo || []).map((a) => ({ type: a.type, text: clean(a.description) })),
    ageBands: detail.pricingInfo?.ageBands || [],
    viatorUrl: detail.productUrl || ''
  };
}

// ----------------------------------------------------------------------------
// FETCH  (trae todo de la API y arma el tourData)
// ----------------------------------------------------------------------------
export async function fetchViatorTour(productCode, opts = {}) {
  if (!API_KEY) throw new Error('Falta VIATOR_API_KEY (config.viator.apiKey o .env)');

  console.log(`\nViator: trayendo ${productCode}...`);

  // 1) detalle del producto
  const detail = await viatorGet(`/products/${productCode}`);

  // 2) precio: el detalle no trae monto; lo sacamos de schedules (o de opts.price si vino del extract)
  let price = opts.price ?? null;
  if (price == null) {
    try {
      const sched = await viatorGet(`/availability/schedules/${productCode}`);
      price = sched?.summary?.fromPrice ?? null;
    } catch (e) {
      console.log(`   WARN schedules: ${e.message} (price queda null)`);
    }
  }

  // 3) nombres de las paradas del itinerario (STANDARD o MULTI_DAY_TOUR)
  const _itin = detail.itinerary || {};
  const _steps = (_itin.itineraryItems && _itin.itineraryItems.length)
    ? _itin.itineraryItems
    : (Array.isArray(_itin.days) ? _itin.days.flatMap((d) => d.items || []) : []);
  const refs = _steps
    .map((s) => s.pointOfInterestLocation?.location?.ref)
    .filter(Boolean);
  const locationNames = await resolveLocationNames(refs);

  // 4) mapeo puro
  const tourData = mapProductToTourData(detail, { price, locationNames });

  console.log('Datos extraidos exitosamente (Viator)');
  console.log(`   Titulo: ${tourData.title}`);
  console.log(`   Rating: ${tourData.rating} (${tourData.reviewCount} reviews)`);
  console.log(`   Precio: $${tourData.price ?? 'N/A'}`);
  console.log(`   Duracion: ${tourData.duration}`);
  console.log(`   Provider: ${tourData.provider || 'NO ENCONTRADO'}`);
  console.log(`   Highlights: ${tourData.highlights.length} | Includes: ${tourData.includes.length} | Imagenes: ${tourData.images.length}`);

  return tourData;
}

export default { fetchViatorTour, mapProductToTourData };
// vegas-viator-client
