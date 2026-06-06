#!/usr/bin/env node
/**
 * explore-corpus.mjs
 *
 * Ejecuta queries útiles sobre el corpus y muestra resultados.
 * Sin DB Browser, sin SQL manual. Solo correr el script.
 *
 * Uso:
 *   node explore-corpus.mjs
 */

import Database from 'better-sqlite3';

const db = new Database('./colosseum-corpus.db', { readonly: true });

function divider(title) {
  console.log('');
  console.log('━'.repeat(70));
  console.log(`📊 ${title}`);
  console.log('━'.repeat(70));
}

function table(rows, columns) {
  if (rows.length === 0) {
    console.log('   (sin resultados)');
    return;
  }
  // Calcular ancho de cada columna
  const widths = {};
  columns.forEach(c => {
    widths[c] = Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length));
  });
  // Header
  console.log('   ' + columns.map(c => c.padEnd(widths[c])).join(' | '));
  console.log('   ' + columns.map(c => '─'.repeat(widths[c])).join('─┼─'));
  // Filas
  rows.forEach(r => {
    console.log('   ' + columns.map(c => String(r[c] ?? '').padEnd(widths[c])).join(' | '));
  });
}

// ─────────────────────────────────────────────────────────────────
// 1. Resumen general
// ─────────────────────────────────────────────────────────────────
divider('RESUMEN GENERAL DEL CORPUS');
const general = db.prepare(`
  SELECT
    COUNT(*) as total_items,
    COUNT(DISTINCT source) as fuentes,
    COUNT(DISTINCT country) as paises,
    COUNT(DISTINCT related_tour_slug) as tours_referenciados,
    ROUND(AVG(rating), 2) as rating_promedio,
    MIN(published_date) as review_mas_vieja,
    MAX(published_date) as review_mas_nueva
  FROM corpus_items
`).get();
console.log(`   Total items:           ${general.total_items}`);
console.log(`   Fuentes distintas:     ${general.fuentes}`);
console.log(`   Países distintos:      ${general.paises}`);
console.log(`   Tours referenciados:   ${general.tours_referenciados}`);
console.log(`   Rating promedio:       ${general.rating_promedio}`);
console.log(`   Review más vieja:      ${general.review_mas_vieja}`);
console.log(`   Review más nueva:      ${general.review_mas_nueva}`);

// ─────────────────────────────────────────────────────────────────
// 2. Top 10 países por reviews
// ─────────────────────────────────────────────────────────────────
divider('TOP 10 PAÍSES POR CANTIDAD DE REVIEWS');
const countries = db.prepare(`
  SELECT country, COUNT(*) as reviews, ROUND(AVG(rating), 2) as avg_rating
  FROM corpus_items
  WHERE country IS NOT NULL
  GROUP BY country
  ORDER BY reviews DESC
  LIMIT 10
`).all();
table(countries, ['country', 'reviews', 'avg_rating']);

// ─────────────────────────────────────────────────────────────────
// 3. Distribución de ratings
// ─────────────────────────────────────────────────────────────────
divider('DISTRIBUCIÓN DE RATINGS');
const ratings = db.prepare(`
  SELECT rating, COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM corpus_items WHERE rating IS NOT NULL), 1) as percent
  FROM corpus_items
  WHERE rating IS NOT NULL
  GROUP BY rating
  ORDER BY rating DESC
`).all();
table(ratings, ['rating', 'count', 'percent']);

// ─────────────────────────────────────────────────────────────────
// 4. Top 10 tours por reviews
// ─────────────────────────────────────────────────────────────────
divider('TOP 10 TOURS POR REVIEWS EN EL CORPUS');
const tours = db.prepare(`
  SELECT related_tour_slug, COUNT(*) as reviews, ROUND(AVG(rating), 2) as avg_rating
  FROM corpus_items
  WHERE related_tour_slug IS NOT NULL
  GROUP BY related_tour_slug
  ORDER BY reviews DESC
  LIMIT 10
`).all();
tours.forEach(t => {
  console.log(`   ${String(t.reviews).padStart(3)} reviews | ⭐ ${t.avg_rating} | ${t.related_tour_slug}`);
});

// ─────────────────────────────────────────────────────────────────
// 5. Reviews negativas (rating ≤ 3) — pain points
// ─────────────────────────────────────────────────────────────────
divider('REVIEWS NEGATIVAS (RATING ≤ 3) — PAIN POINTS POR EXPLORAR');
const negativas = db.prepare(`
  SELECT COUNT(*) as total
  FROM corpus_items
  WHERE rating <= 3
`).get();
console.log(`   Total reviews negativas: ${negativas.total}`);
console.log('');
console.log('   Muestra de 5 reviews negativas:');
const samples = db.prepare(`
  SELECT rating, country, substr(text, 1, 200) as texto
  FROM corpus_items
  WHERE rating <= 3
  LIMIT 5
`).all();
samples.forEach((r, i) => {
  console.log('');
  console.log(`   [${i + 1}] ⭐ ${r.rating} — ${r.country}`);
  console.log(`       "${r.texto}..."`);
});

// ─────────────────────────────────────────────────────────────────
// 6. Búsqueda de keywords críticas
// ─────────────────────────────────────────────────────────────────
divider('FRECUENCIA DE KEYWORDS CLAVE EN REVIEWS');
const keywords = ['guide', 'underground', 'arena', 'late', 'app', 'price', 'expensive', 'crowded', 'hot', 'wait'];
const stats = keywords.map(kw => {
  const total = db.prepare(`SELECT COUNT(*) as n FROM corpus_items WHERE LOWER(text) LIKE ?`).get(`%${kw}%`).n;
  const neg = db.prepare(`SELECT COUNT(*) as n FROM corpus_items WHERE LOWER(text) LIKE ? AND rating <= 3`).get(`%${kw}%`).n;
  return { keyword: kw, mentions: total, in_negative: neg };
});
table(stats.sort((a, b) => b.mentions - a.mentions), ['keyword', 'mentions', 'in_negative']);

// ─────────────────────────────────────────────────────────────────
// 7. Reviews más largas (las que tienen más para analizar)
// ─────────────────────────────────────────────────────────────────
divider('TOP 5 REVIEWS MÁS LARGAS (RICAS EN INFORMACIÓN)');
const longest = db.prepare(`
  SELECT rating, country, text_length, substr(text, 1, 250) as preview
  FROM corpus_items
  ORDER BY text_length DESC
  LIMIT 5
`).all();
longest.forEach((r, i) => {
  console.log('');
  console.log(`   [${i + 1}] ⭐ ${r.rating} — ${r.country} (${r.text_length} caracteres)`);
  console.log(`       "${r.preview}..."`);
});

console.log('');
console.log('━'.repeat(70));
console.log('✅ Exploración terminada.');
console.log('━'.repeat(70));

db.close();