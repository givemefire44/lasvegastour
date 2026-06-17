// src/viator-extract-urls.js
// Archivo NUEVO, al lado de extract-urls.js de GYG (que queda como respaldo).
// Trae el catálogo de Las Vegas vía /products/search, aplica un piso de calidad
// POR CATEGORIA, rankea por score bayesiano y toma el top N de cada una.
// Salida: un CSV de candidatos para que cures a mano (marcás la columna "incluir").
// El batch despues levanta solo los productCode marcados.
//
// vegas-viator-extract

import { fileURLToPath } from 'url';
import fs from 'fs';
import * as configModule from '../config.js';
import { classifyCategory, CATEGORIES } from './sanityUploader.js';

const config = configModule.config || configModule.default;

const API_KEY = config.viator?.apiKey || process.env.VIATOR_API_KEY || '';
const HEADERS = {
  'exp-api-key': API_KEY,
  'Accept': 'application/json;version=2.0',
  'Accept-Language': 'en-US',
  'Content-Type': 'application/json'
};
const BASE = 'https://api.viator.com/partner';
const DEST = '684'; // Las Vegas

// --- piso de calidad POR CATEGORIA ---
// Abundantes: piso alto. Flacas (poco volumen de reseñas): piso laxo para no quedarse sin candidatos.
const FLOORS = {
  'grand-canyon-tours': { minRating: 4.2, minReviews: 15 },
  'hoover-dam-tours':   { minRating: 4.2, minReviews: 15 },
  'adventure-tours':    { minRating: 4.2, minReviews: 15 },
  'day-trips':          { minRating: 4.2, minReviews: 15 },
  'shows':              { minRating: 4.2, minReviews: 15 },
  'strip-tours':        { minRating: 4.2, minReviews: 15 },
  'nightlife':          { minRating: 4.2, minReviews: 15 },
  'helicopter-tours':   { minRating: 4.2, minReviews: 15 }
};
const DEFAULT_FLOOR = { minRating: 4.2, minReviews: 15 };
const TOP_N = 100;    // cap alto por categoría: catálogo amplio (el piso de calidad ya filtra)
const BAYES_M = 50;   // peso del prior (cuántas reseñas "pesa" el promedio global)
const CSV_FILE = 'viator-candidates.csv';

// --- fetch paginado del catálogo ---
async function fetchAllProducts() {
  if (!API_KEY) throw new Error('Falta VIATOR_API_KEY (config.viator.apiKey o .env)');
  const all = [];
  let start = 1;
  const count = 50;
  for (let guard = 0; guard < 60; guard++) {
    const body = { filtering: { destination: DEST }, pagination: { start, count }, currency: 'USD' };
    const res = await fetch(`${BASE}/products/search`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`search -> ${res.status} ${res.statusText}`);
    const data = await res.json();
    const prods = data.products || [];
    all.push(...prods);
    const total = data.totalCount || 0;
    process.stdout.write(`\r  trayendo... ${all.length}/${total}   `);
    if (prods.length === 0 || all.length >= total) { console.log(''); break; }
    start += count;
    await new Promise((r) => setTimeout(r, 250));
  }
  return all;
}

// Score bayesiano: ratings con muchas reseñas pesan su valor real;
// con pocas reseñas, el score se acerca al promedio global (no premia 5★ con 8 reseñas).
function bayesianScore(rating, reviews, globalAvg, m = BAYES_M) {
  if (!reviews) return 0;
  return (reviews / (reviews + m)) * rating + (m / (reviews + m)) * globalAvg;
}

// --- lógica PURA (testeable sin red): arma las filas del reporte ---
export function buildCandidateReport(products) {
  const norm = products.map((p) => ({
    productCode: p.productCode || '',
    title: p.title || '',
    rating: p.reviews?.combinedAverageRating ?? 0,
    reviews: p.reviews?.totalReviews ?? 0,
    price: p.pricing?.summary?.fromPrice ?? null,
    url: p.productUrl || '',
    cat: classifyCategory(p.title || '')
  }));

  // promedio global (solo de los que tienen reseñas) para el prior bayesiano
  const withReviews = norm.filter((p) => p.reviews > 0);
  const globalAvg = withReviews.length
    ? withReviews.reduce((s, p) => s + p.rating, 0) / withReviews.length
    : 4.5;

  // agrupar por categoría aplicando el piso correspondiente
  const byCat = {};
  for (const slug of Object.keys(CATEGORIES)) byCat[slug] = [];
  for (const p of norm) {
    const floor = FLOORS[p.cat] || DEFAULT_FLOOR;
    if (p.rating >= floor.minRating && p.reviews >= floor.minReviews) {
      p.score = +bayesianScore(p.rating, p.reviews, globalAvg).toFixed(3);
      byCat[p.cat].push(p);
    }
  }

  // ordenar por score y tomar top N por categoría
  const rows = [];
  const counts = {};
  for (const slug of Object.keys(CATEGORIES)) {
    byCat[slug].sort((a, b) => b.score - a.score);
    counts[slug] = byCat[slug].length;
    rows.push(...byCat[slug].slice(0, TOP_N));
  }

  return { rows, globalAvg: +globalAvg.toFixed(3), counts };
}

// --- CSV (separador ; para que Excel en español lo abra en columnas directo) ---
function csvField(v) {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function toCSV(rows) {
  const head = ['incluir', 'productCode', 'categoria', 'titulo', 'rating', 'reviews', 'price', 'score', 'viatorUrl'];
  const lines = [head.join(';')];
  for (const r of rows) {
    lines.push([
      'x', r.productCode, r.cat, r.title, r.rating, r.reviews, r.price ?? '', r.score, r.url
    ].map(csvField).join(';'));
  }
  return lines.join('\r\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const products = await fetchAllProducts();
  const rep = buildCandidateReport(products);
  fs.writeFileSync(CSV_FILE, toCSV(rep.rows), 'utf-8'); // UTF-8 sin BOM

  console.log(`\nPromedio global de rating (prior bayesiano): ${rep.globalAvg}`);
  console.log('Candidatos por categoria (en CSV / total que pasó el piso):');
  for (const slug of Object.keys(CATEGORIES)) {
    const total = rep.counts[slug];
    const inCsv = Math.min(total, TOP_N);
    console.log(`   ${String(inCsv).padStart(3)} / ${String(total).padEnd(4)}  ${CATEGORIES[slug]}`);
  }
  console.log(`\nTotal en el CSV: ${rep.rows.length} candidatos  ->  ${CSV_FILE}`);
  console.log('Abrilo en Excel, marca la columna "incluir" con una x en los que entran, y guarda.');
}
// vegas-viator-extract
