// cargar-geo-destinos.mjs
// Sube data/geo-destinations.json a Sanity como documentos geoDestination (uno por destino).
//
// Uso:
//   node cargar-geo-destinos.mjs            (dry-run: muestra que crearia o cambiaria, NO escribe)
//   node cargar-geo-destinos.mjs --execute  (aplica)
//
// Idempotente: _id deterministico "geoDestination-<id>" (sin punto: un id con punto no es publico), createOrReplace.
// Solo escribe _type == "geoDestination". Nunca toca posts (tours) ni pages.

import fs from 'fs';
import { createClient } from '@sanity/client';

const EXECUTE = process.argv.includes('--execute');
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const client = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  token: env.SANITY_API_TOKEN,
  useCdn: false,
});

const { destinations } = JSON.parse(fs.readFileSync('data/geo-destinations.json', 'utf8'));

const docs = destinations.map((d) => ({
  _id: `geoDestination-${d.id}`,
  _type: 'geoDestination',
  name: d.name,
  destinationId: { _type: 'slug', current: d.id },
  point: d.point,
  lat: d.lat,
  lng: d.lng,
  milesFromStrip: d.milesFromStrip,
  driveMinutesOneWay: d.driveMinutesOneWay,
  direction: d.direction,
  ...(d.altRoute && { altRoute: { _type: 'object', ...d.altRoute } }),
  measuredAt: d.measuredAt,
  source: [d.source, d.note].filter(Boolean).join('\n'),
}));

const CAMPOS = ['name', 'point', 'lat', 'lng', 'milesFromStrip', 'driveMinutesOneWay', 'direction', 'altRoute', 'measuredAt'];
const actuales = await client.fetch(`*[_type == "geoDestination"]`);
const porId = Object.fromEntries(actuales.map((d) => [d._id, d]));

let crear = 0, cambiar = 0, igual = 0;
for (const doc of docs) {
  const prev = porId[doc._id];
  if (!prev) { crear++; console.log(`+ ${doc._id}  ${doc.milesFromStrip} mi · ${doc.driveMinutesOneWay} min${doc.altRoute ? ` · alt ${doc.altRoute.miles} mi / ${doc.altRoute.minutes} min` : ''}`); continue; }
  const dif = CAMPOS.filter((k) => JSON.stringify(stripKeys(prev[k])) !== JSON.stringify(stripKeys(doc[k])));
  if (dif.length) { cambiar++; console.log(`~ ${doc._id}  ${dif.map((k) => `${k}: ${JSON.stringify(stripKeys(prev[k]))} -> ${JSON.stringify(stripKeys(doc[k]))}`).join(' · ')}`); }
  else igual++;
}
const sobran = actuales.filter((d) => !docs.some((x) => x._id === d._id));
for (const d of sobran) console.log(`? ${d._id} esta en Sanity y no en el JSON (no se borra)`);

console.log(`\n${crear} a crear · ${cambiar} a cambiar · ${igual} sin cambios`);
if (!EXECUTE) { console.log('DRY-RUN: no se escribio nada. --execute para aplicar.'); process.exit(0); }

const tx = client.transaction();
for (const doc of docs) tx.createOrReplace(doc);
await tx.commit();
console.log(`✅ ${docs.length} geoDestination escritos.`);

function stripKeys(v) {
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_')));
}
