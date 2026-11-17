// corregir-distancias-pages.mjs — lasvegastour.com
// Alinea la distancia y el tiempo de manejo que dice la prosa de 3 pages con la ficha geoDestination
// (la misma que va al "about" de su JSON-LD). Sin esto, la page diria "50 miles" y su schema 54.
//
// Uso:
//   node corregir-distancias-pages.mjs              (DRY: muestra cada cambio, no escribe)
//   node corregir-distancias-pages.mjs --execute    (escribe)
//
// - Solo _type == "page". Reemplazos textuales exactos, frase por frase: si una frase no aparece,
//   se avisa y esa page NO se escribe (el texto cambio desde que se armo la lista).
//   Se aplican a todo string del documento: cuerpo, tablas rawHtml, quick answers, faqItems, seoDescription.
// - Cifras de las fichas (origen Bellagio, tipico sin trafico, medidas oct 2026):
//   Valley of Fire 54 mi / 70 min · Red Rock 18.5 mi / 40 min · Grand Canyon West 130 mi / 145 min ·
//   South Rim 281 mi / 290 min · Antelope 283 mi / 295 min · Horseshoe Bend 279 mi / 280 min.
// - No se tocan: tramos que no son Strip->destino (loop de 13 millas, Fire Wave 1.5 millas), los
//   totales del dia, y "90 minutes apart" entre Red Rock y Valley of Fire (no esta medido).
// - Patch con ifRevisionId, solo los campos que cambian. Idempotente: una segunda corrida no encuentra las frases viejas.

import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';

const EXECUTE = process.argv.includes('--execute');
const sanity = createClient({
  projectId: 'kabmqky1', dataset: 'production',
  apiVersion: '2023-05-03', token: process.env.SANITY_API_TOKEN, useCdn: false,
});

const CAMBIOS = {
  'valley-of-fire-from-las-vegas': [
    // Las frases van de la mas especifica a la mas general: se aplican en orden.
    ["about 50 miles northeast (an hour's drive)", "about 54 miles northeast (an hour and ten minutes' drive)"],
    ['Valley of Fire sits about 50 miles northeast of the Strip; Red Rock is 17 miles west.', 'Valley of Fire sits about 54 miles northeast of the Strip; Red Rock is about 18.5 miles west.'],
    ['about 50 miles northeast of ', 'about 54 miles northeast of '],
    [" and roughly an hour's drive, it's", " and roughly an hour and ten minutes' drive, it's"],
    ['<td>~50 mi NE (~1 hour)</td>', '<td>~54 mi NE (~1 h 10 min)</td>'],
    ['<td>~17 mi W (~30 min)</td>', '<td>~18.5 mi W (~40 min)</td>'],
    ['(an hour vs about 30 minutes)', '(an hour and ten minutes vs about 40 minutes)'],
    ['the drive is about an hour each way', 'the drive is about an hour and ten minutes each way'],
    ["don't want to drive an hour each way", "don't want to drive over an hour each way"],
    ['just 50 miles (about an hour) northeast', 'just 54 miles (about an hour and ten minutes) northeast'],
    ['Red Rock is closer (17 miles west)', 'Red Rock is closer (about 18.5 miles west)'],
    ['Valley of Fire is farther (50 miles northeast, ~1 hour)', 'Valley of Fire is farther (54 miles northeast, ~1 hour 10 minutes)'],
    ["It's about 50 miles (an hour) northeast of the Strip", "It's about 54 miles (an hour and ten minutes) northeast of the Strip"],
    // La meta ya tiene 165 caracteres: se cambia la cifra sin alargarla.
    ['red rock an hour away', 'red rock 54 miles away'],
  ],
  'red-rock-canyon-from-las-vegas': [
    ['just 17 miles west, built around', 'just 18.5 miles west, built around'],
    ['just 17 miles west of Las Vegas.', 'just 18.5 miles west of Las Vegas.'],
    ['less than 30 minutes after leaving your hotel', 'about 40 minutes after leaving your hotel'],
    ['just 17 miles west with big desert scenery', 'just 18.5 miles west with big desert scenery'],
  ],
  'grand-canyon-west-vs-south-rim-from-las-vegas': [
    ['Grand Canyon West is ~125 miles from Las Vegas (2–2.5 hours each way)', 'Grand Canyon West is ~130 miles from Las Vegas (about 2 hours 25 minutes each way)'],
    ['The South Rim is ~275 miles away (4.5–5 hours each way)', 'The South Rim is ~281 miles away (about 4 hours 50 minutes each way)'],
    ['Grand Canyon West sits about 125 miles from ', 'Grand Canyon West sits about 130 miles from '],
    [' — roughly a 2 to 2.5 hour drive each way. The South Rim is about 275 miles out, which is 4.5 to 5 hours each way before', ' — roughly a 2 hour 25 minute drive each way. The South Rim is about 281 miles out, which is about 4 hours 50 minutes each way before'],
    ['<td>~125–130 miles</td>', '<td>~130 miles</td>'],
    ['<td>~275–280 miles</td>', '<td>~281 miles</td>'],
    ['<td>2–2.5 hours</td>', '<td>~2 h 25 min</td>'],
    ['<td>4.5–5 hours</td>', '<td>~4 h 50 min</td>'],
    ['It’s roughly 125 to 130 miles depending on where you start on the Strip, and about two hours if you don’t stop.', 'It’s about 130 miles from the center of the Strip, and about 2 hours 25 minutes if you don’t stop.'],
    ['At roughly 275 miles each way it’s four and a half to five hours of driving', 'At roughly 281 miles each way it’s close to five hours of driving'],
    ['covers in under an hour what the road does in two', 'covers in under an hour what the road does in nearly two and a half'],
    ['✅ ~2 hrs, paved the whole way', '✅ ~2 h 25 min, paved the whole way'],
    ['⚠️ 4.5–5 hrs each way, you drive both', '⚠️ ~4 h 50 min each way, you drive both'],
    ['You, for 4 to 10 hours', 'You, for about 5 to 10 hours'],
    ['which is about 271 miles from Las Vegas — five and a half hours each way on its own', 'which is about 280 miles from Las Vegas — close to five hours each way on its own'],
    ['roughly 271 miles and five and a half hours from Las Vegas each way', 'roughly 280 miles and close to five hours from Las Vegas each way'],
    ['West is closer (~125 miles, 2–2.5 hours each way)', 'West is closer (~130 miles, about 2 hours 25 minutes each way)'],
    ['South Rim is farther (~275 miles, 4.5–5 hours each way)', 'South Rim is farther (~281 miles, about 4 hours 50 minutes each way)'],
    ['It’s about 125 to 130 miles and roughly a two-hour drive', 'It’s about 130 miles and roughly a two-and-a-half-hour drive'],
    ['The South Rim runs 4.5–5 hours of driving each way', 'The South Rim runs close to 5 hours of driving each way'],
    ['Grand Canyon West (2–2.5 hours each way)', 'Grand Canyon West (about 2 hours 25 minutes each way)'],
    ['about 125 to 130 miles and roughly two hours, paved', 'about 130 miles and roughly two and a half hours, paved'],
    ['at around 275 miles each way', 'at around 281 miles each way'],
  ],
};

// Aplica los reemplazos a todo string del valor, contando cuantas veces pego cada uno.
function aplicar(valor, pares, cuenta, cambios, ruta) {
  if (typeof valor === 'string') {
    let t = valor;
    pares.forEach(([viejo, nuevo], i) => {
      const n = t.split(viejo).length - 1;
      if (n) { cuenta[i] += n; t = t.split(viejo).join(nuevo); }
    });
    if (t !== valor) cambios.push({ ruta, antes: valor, despues: t });
    return t;
  }
  if (Array.isArray(valor)) return valor.map((v, i) => aplicar(v, pares, cuenta, cambios, `${ruta}[${v?._key ? v._key : i}]`));
  if (valor && typeof valor === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(valor)) o[k] = k.startsWith('_') ? v : aplicar(v, pares, cuenta, cambios, ruta ? `${ruta}.${k}` : k);
    return o;
  }
  return valor;
}

// Muestra solo el tramo que cambia, con un poco de contexto.
function recorte(a, b) {
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  let j = 0; while (j < a.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  const desde = Math.max(0, i - 40);
  return [a.slice(desde, a.length - j + 30), b.slice(desde, b.length - j + 30)].map((s) => s.replace(/\s+/g, ' '));
}

const docs = await sanity.fetch(`*[_type=="page" && slug.current in $s && !(_id in path("drafts.**"))]`, { s: Object.keys(CAMBIOS) });
let escritas = 0, frenadas = 0;
for (const doc of docs) {
  const slug = doc.slug.current, pares = CAMBIOS[slug];
  const cuenta = pares.map(() => 0), cambios = [];
  const campos = {};
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith('_') || k === 'slug') continue;
    const nuevo = aplicar(v, pares, cuenta, cambios, k);
    if (JSON.stringify(nuevo) !== JSON.stringify(v)) campos[k] = nuevo;
  }
  const faltan = pares.filter((_, i) => !cuenta[i]);
  console.log(`\n######## ${slug} — ${pares.length} frases, ${cuenta.reduce((a, b) => a + b, 0)} reemplazos en ${cambios.length} textos · campos: ${Object.keys(campos).join(', ') || '-'}`);
  for (const c of cambios) {
    const [a, d] = recorte(c.antes, c.despues);
    console.log(`  ${c.ruta}\n    - ${a}\n    + ${d}`);
  }
  if (faltan.length) {
    frenadas++;
    console.log(`  ⛔ ${faltan.length} frase(s) no aparecen; esta page no se escribe:`);
    for (const [v] of faltan) console.log(`     «${v}»`);
    continue;
  }
  if (EXECUTE && Object.keys(campos).length) {
    await sanity.patch(doc._id).ifRevisionId(doc._rev).set(campos).commit();
    escritas++;
  }
}
console.log(`\n${EXECUTE ? `✅ ${escritas} pages escritas` : 'DRY — nada escrito. --execute para aplicar.'} · frenadas: ${frenadas}`);
