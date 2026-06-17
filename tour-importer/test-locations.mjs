// test-locations.mjs — diagnóstico desechable de /locations/bulk
// Va en tour-importer\ (usa tu config.js para la API key). Borralo cuando termine.
import * as cfg from './config.js';

const K = (cfg.config || cfg.default).viator.apiKey;
const H = {
  'exp-api-key': K,
  'Accept': 'application/json;version=2.0',
  'Accept-Language': 'en-US',
  'Content-Type': 'application/json'
};
const base = 'https://api.viator.com/partner';

const d = await (await fetch(`${base}/products/132218P75`, { headers: H })).json();
const refs = d.itinerary.itineraryItems
  .map((s) => s.pointOfInterestLocation?.location?.ref)
  .filter(Boolean);

console.log('refs en el itinerario:', refs.length);

const r = await (await fetch(`${base}/locations/bulk`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ locations: refs })
})).json();

const got = new Map((r.locations || []).map((l) => [l.reference, l.name]));

refs.forEach((ref, i) => {
  let tag;
  if (!got.has(ref)) tag = 'NO DEVUELTO';
  else tag = `[${got.get(ref) || '(name vacio)'}]`;
  console.log(`${i + 1}. ${tag}  ${ref.slice(0, 32)}`);
});

console.log(`\nlocations devueltas: ${(r.locations || []).length} de ${refs.length}`);
// vegas-loc-test
