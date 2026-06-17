// viator-inventory.mjs — análisis de viabilidad de inventario (desechable)
// Va en tour-importer\ (usa tu config.js y tu src/sanityUploader.js).
// Trae todo el catálogo de Las Vegas y cuenta cuántos tours pasan distintos
// pisos de calidad, desglosado por las 8 categorías. Borralo cuando termine.
import { fileURLToPath } from 'url';
import * as cfg from './config.js';
import { classifyCategory, CATEGORIES } from './src/sanityUploader.js';

const K = (cfg.config || cfg.default).viator.apiKey;
const H = {
  'exp-api-key': K,
  'Accept': 'application/json;version=2.0',
  'Accept-Language': 'en-US',
  'Content-Type': 'application/json'
};
const BASE = 'https://api.viator.com/partner';
const DEST = '684'; // Las Vegas

// Pisos a evaluar (ajustables)
const THRESHOLDS = [
  { label: 'Laxo    ', minRating: 4.0, minReviews: 10 },
  { label: 'Medio   ', minRating: 4.5, minReviews: 25 },
  { label: 'Estricto', minRating: 4.5, minReviews: 50 }
];

// ---- fetch paginado de todo el catálogo ----
async function fetchAllProducts() {
  const all = [];
  let start = 1;
  const count = 50;
  for (let guard = 0; guard < 60; guard++) {
    const body = { filtering: { destination: DEST }, pagination: { start, count }, currency: 'USD' };
    const res = await fetch(`${BASE}/products/search`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`search -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    const prods = data.products || [];
    all.push(...prods);
    const total = data.totalCount || 0;
    process.stdout.write(`\r  trayendo... ${all.length}/${total}   `);
    if (prods.length === 0 || all.length >= total) { console.log(''); break; }
    start += count;
    await new Promise((r) => setTimeout(r, 250)); // delay anti rate-limit
  }
  return all;
}

// ---- análisis PURO (testeable sin red) ----
export function analyzeInventory(products) {
  const norm = products.map((p) => ({
    rating: p.reviews?.combinedAverageRating ?? 0,
    reviews: p.reviews?.totalReviews ?? 0,
    price: p.pricing?.summary?.fromPrice ?? null,
    cat: classifyCategory(p.title || '')
  }));

  const report = { total: norm.length, rows: [] };
  for (const th of THRESHOLDS) {
    const passed = norm.filter((p) => p.rating >= th.minRating && p.reviews >= th.minReviews);
    const byCat = {};
    for (const slug of Object.keys(CATEGORIES)) byCat[slug] = 0;
    for (const p of passed) byCat[p.cat] = (byCat[p.cat] || 0) + 1;
    report.rows.push({ ...th, count: passed.length, byCat });
  }
  return report;
}

function printReport(rep) {
  console.log(`\nTotal de tours en Las Vegas (destino ${DEST}): ${rep.total}\n`);
  for (const row of rep.rows) {
    const variety = Object.values(row.byCat).filter((n) => n > 0).length;
    console.log(`=== ${row.label}  (rating>=${row.minRating}, reviews>=${row.minReviews})  ->  ${row.count} tours, ${variety}/8 categorias ===`);
    for (const slug of Object.keys(CATEGORIES)) {
      console.log(`     ${String(row.byCat[slug]).padStart(4)}  ${CATEGORIES[slug]}`);
    }
    console.log('');
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const products = await fetchAllProducts();
  printReport(analyzeInventory(products));
}
// vegas-inventory
