import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const tours = await sanity.fetch(
  `*[_type=="post" && defined(getYourGuideUrl)]{ "slug": slug.current, "price": tourInfo.price, "body": pt::text(body) }`
);

// set de todos los precios del catálogo (para detectar "ajeno citado")
const catalogPrices = new Map();   // precio -> slug
for (const t of tours) if (t.price != null) catalogPrices.set(Number(t.price), t.slug);

const norm = s => parseFloat(String(s).replace(/[^\d.]/g, ''));
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;   // tolerancia de redondeo $1

let propio = 0, ajeno = 0, tercero = 0;
let ejemplosAjeno = [], ejemplosTercero = [];

for (const t of tours) {
  const body = t.body || '';
  const decimales = body.match(/(?:USD\s?|\$\s?)\d[\d,]*\.\d+/gi) || [];
  for (const d of decimales) {
    const v = norm(d);
    if (!v) continue;
    // ¿es el propio? (con tolerancia)
    if (t.price != null && near(v, Number(t.price))) { propio++; continue; }
    // ¿coincide con precio de OTRO tour del catálogo?
    let matchAjeno = null;
    for (const [p, slug] of catalogPrices) {
      if (slug !== t.slug && near(v, p)) { matchAjeno = slug; break; }
    }
    if (matchAjeno) {
      ajeno++;
      if (ejemplosAjeno.length < 8) ejemplosAjeno.push(`${t.slug}: "${d}" = precio de ${matchAjeno}`);
    } else {
      tercero++;
      if (ejemplosTercero.length < 8) ejemplosTercero.push(`${t.slug}: "${d}" (no matchea ningún tour)`);
    }
  }
}

console.log(`=== Clasificación de menciones con decimales ===`);
console.log(`PROPIO (= precio del tour):        ${propio}`);
console.log(`AJENO (= precio de otro tour):     ${ajeno}`);
console.log(`TERCERO (add-on/depósito/derivado):${tercero}`);
console.log(`TOTAL:                             ${propio + ajeno + tercero}\n`);
console.log('--- ejemplos AJENO ---');
ejemplosAjeno.forEach(e => console.log('  ' + e));
console.log('\n--- ejemplos TERCERO ---');
ejemplosTercero.forEach(e => console.log('  ' + e));
