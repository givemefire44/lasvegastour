// mapear-tours-destino.mjs
// Asigna a cada tour (post) su destino de data/geo-destinations.json, para la linea de distancia del template.
// SOLO LEE los posts: el resultado va a data/tour-destinations.json, nunca a Sanity (los tours no se tocan).
//
// Uso:
//   node mapear-tours-destino.mjs            (dry-run: reporte, NO escribe)
//   node mapear-tours-destino.mjs --execute  (escribe data/tour-destinations.json)
//
// Reglas:
//   1. Se buscan los destinos en el TITULO. Si nombra varios, gana el mas lejano (el que define el viaje);
//      los otros quedan en "also".
//   2. "Grand Canyon" sin borde: se mira el body. Si nombra un solo borde, ese; si ninguno o los dos, queda sin linea.
//   3. Lo que no cae en un destino medido (North Rim, Lake Mead, Route 66, "Mojave desert"...) queda sin linea.
//   4. Circuitos de varios dias (N-Day, 48/72-Hour, Overnight): sin linea.

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
const millas = Object.fromEntries(destinations.map((d) => [d.id, d.milesFromStrip]));

// Patrones por destino, contra el titulo. "Valley Fire" sin "of" aparece en titulos recortados.
const TITULO = {
  'area15': /\barea ?15\b/i,
  'red-rock': /\bred rock\b/i,
  'seven-magic': /\b(seven|7) magic\b/i,
  'nellis-dunes': /\bnellis dunes\b/i,
  'mt-charleston': /\b(mt\.?|mount) charleston\b/i,
  'hoover-dam': /\bhoover\b|\bblack canyon\b/i,
  'willow-beach': /\bwillow beach\b|\bemerald cave\b/i,
  'valley-of-fire': /\bvalley (of )?fire\b/i,
  'death-valley': /\bdeath valley\b/i,
  'gc-west': /\b(grand canyon )?west rim\b|\bgrand canyon west\b|\bskywalk\b|\beagle point\b|\bhualapai\b/i,
  'zion': /\bzion\b/i,
  'bryce': /\bbryce\b/i,
  'horseshoe-bend': /\bhorseshoe bend\b/i,
  'gc-south': /\bsouth rim\b/i,
  'antelope': /\bantelope\b/i,
  'monument-valley': /\bmonument valley\b/i,
};
const GC_GENERICO = /\bgrand canyon\b/i;
// "Grand Canyon Caverns" es otro lugar (Route 66), y en "Lake Mead ... Grand Canyon Heli Option" el cañon es un extra.
const GC_NO_ES_EL_DESTINO = /\bcaverns\b|\blake mead\b/i;
// Circuitos de varios dias: la linea de "X millas, tanto de ida" describe una excursion de un dia, no un circuito.
const MULTIDIA = /\b\d+-day\b|\b(48|72)-hour\b|\bovernight\b/i;
const NORTH_RIM = /\bnorth rim\b/i;
const BODY_WEST = /\bwest rim\b|\bgrand canyon west\b|\bskywalk\b|\beagle point\b|\bguano point\b|\bhualapai\b/i;
const BODY_SOUTH = /\bsouth rim\b|\bmather point\b|\bgrand canyon village\b|\byavapai point\b/i;

const textoBody = (body) => (body || [])
  .map((b) => (b.children || []).map((c) => c.text || '').join(''))
  .join(' ');

const posts = await client.fetch(`*[_type == "post" && discontinued != true && !(_id in path("drafts.**"))]{
  title, "slug": slug.current, "cat": category->slug.current, body
}`);

const mapa = {};
const sinLinea = [], ambiguos = [], multidia = [];
for (const p of posts) {
  if (MULTIDIA.test(p.title)) { multidia.push(p); continue; }
  let hits = Object.keys(TITULO).filter((id) => TITULO[id].test(p.title));
  let regla = 'title';
  if (!hits.some((h) => h.startsWith('gc-')) && GC_GENERICO.test(p.title) && !NORTH_RIM.test(p.title) && !GC_NO_ES_EL_DESTINO.test(p.title)) {
    const t = textoBody(p.body);
    const w = BODY_WEST.test(t), s = BODY_SOUTH.test(t);
    if (w !== s) { hits.push(w ? 'gc-west' : 'gc-south'); regla = 'title+body'; }
    else { ambiguos.push(`${p.slug} · "${p.title}" · body: west=${w} south=${s}`); continue; }
  }
  if (!hits.length) { sinLinea.push(p); continue; }
  hits.sort((a, b) => millas[b] - millas[a]);
  mapa[p.slug] = { destination: hits[0], ...(hits.length > 1 && { also: hits.slice(1) }), rule: regla };
}

// ── reporte ──
const porDestino = {};
for (const v of Object.values(mapa)) porDestino[v.destination] = (porDestino[v.destination] || 0) + 1;
console.log(`posts leidos: ${posts.length} · con destino: ${Object.keys(mapa).length} · sin linea: ${sinLinea.length} · varios dias: ${multidia.length} · Grand Canyon ambiguos: ${ambiguos.length}\n`);
console.log('varios dias (sin linea):'); for (const p of multidia) console.log(`  ${p.title}`); console.log('');
for (const d of destinations) console.log(`  ${d.id.padEnd(16)} ${String(porDestino[d.id] || 0).padStart(4)}`);
const multi = Object.entries(mapa).filter(([, v]) => v.also);
console.log(`\nmulti-destino (gana el mas lejano): ${multi.length}`);
for (const [s, v] of multi) console.log(`  ${v.destination.padEnd(16)} ← tambien ${v.also.join(', ')} · ${posts.find((p) => p.slug === s).title}`);
console.log(`\nresueltos por body (Grand Canyon sin borde en el titulo):`);
for (const [s, v] of Object.entries(mapa).filter(([, v]) => v.rule === 'title+body')) console.log(`  ${v.destination.padEnd(8)} ${posts.find((p) => p.slug === s).title}`);
console.log(`\nGrand Canyon ambiguos (sin linea hasta que alguien decida):`);
for (const a of ambiguos) console.log('  ' + a);
const cats = {};
for (const p of sinLinea) cats[p.cat] = (cats[p.cat] || 0) + 1;
console.log(`\nsin linea por categoria:`, cats);
console.log(`sin linea, fuera de shows / nightlife / strip-tours:`);
for (const p of sinLinea.filter((p) => !['shows', 'nightlife', 'strip-tours'].includes(p.cat))) console.log(`  [${p.cat}] ${p.title}`);

if (!EXECUTE) { console.log('\nDRY-RUN: no se escribio nada. --execute para escribir data/tour-destinations.json.'); process.exit(0); }
const ordenado = Object.fromEntries(Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync('data/tour-destinations.json', JSON.stringify(ordenado, null, 2) + '\n');
console.log(`\n✅ data/tour-destinations.json: ${Object.keys(ordenado).length} tours.`);
