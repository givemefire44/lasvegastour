#!/usr/bin/env node
/**
 * import-googlemaps.mjs
 *
 * Importa el JSON descargado de Apify (Google Maps Reviews Scraper)
 * al corpus SQLite con source='googlemaps'.
 *
 * Como la URL pasada a Apify es específica del Coliseo, NO filtra por palabra
 * clave: todas las reviews son del Coliseo por definición.
 *
 * Uso:
 *   node import-googlemaps.mjs                        # default: googlemaps-reviews.json
 *   node import-googlemaps.mjs --file=otro.json       # archivo distinto
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import crypto from 'crypto';

const DB_PATH = './colosseum-corpus.db';
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
const INPUT = fileArg || './googlemaps-reviews.json';

if (!existsSync(INPUT)) {
  console.error(`❌ No encontré el archivo: ${INPUT}`);
  process.exit(1);
}

console.log('━'.repeat(70));
console.log('📥 IMPORT GOOGLE MAPS (Apify) → CORPUS');
console.log('━'.repeat(70));

const data = JSON.parse(readFileSync(INPUT, 'utf8'));

if (!Array.isArray(data)) {
  console.error('❌ El JSON no es un array.');
  process.exit(1);
}

console.log(`📦 Items en JSON: ${data.length}`);
if (data.length > 0) {
  console.log(`🔍 Campos disponibles: ${Object.keys(data[0]).join(', ')}`);
}
console.log('');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const runResult = db.prepare(`
  INSERT INTO scrape_runs (source, notes, status)
  VALUES ('googlemaps', 'Apify import — Coliseo Roma', 'running')
`).run();
const runId = runResult.lastInsertRowid;

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO corpus_items (
    source, source_url, source_id, type,
    text, text_length, language,
    rating, country, author_handle,
    published_date,
    related_topic, metadata_json,
    fetched_at
  ) VALUES (
    @source, @source_url, @source_id, @type,
    @text, @text_length, @language,
    @rating, @country, @author_handle,
    @published_date,
    @related_topic, @metadata_json,
    datetime('now')
  )
`);

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return null;
}

let added = 0;
let skipped = 0;
let skippedNoText = 0;
const byRating = {};
const byLanguage = {};

const insertAll = db.transaction(() => {
  for (const item of data) {
    // Apify Google Maps Reviews Scraper devuelve campos típicos:
    // reviewerId, name, text, textTranslated, stars, publishedAtDate,
    // reviewUrl, originalLanguage, etc.
    const reviewId = item.reviewId || item.id || null;
    const text = item.text || item.textTranslated || item.reviewText || '';
    const rating = item.stars || item.rating || null;
    const author = item.name || item.reviewerName || item.author || null;
    const language = item.originalLanguage || item.language || 'unknown';
    const publishedDate = parseDate(item.publishedAtDate || item.publishedAt || item.date);
    const reviewUrl = item.reviewUrl || item.url || null;
    const placeName = item.title || item.placeName || null;
    const placeUrl = item.placeUrl || item.url || null;
    const reviewerNumberOfReviews = item.reviewerNumberOfReviews || null;
    const isLocalGuide = item.isLocalGuide || false;
    const responseFromOwner = item.responseFromOwnerText || null;
    const likesCount = item.likesCount || 0;

    if (!text || text.length < 10) {
      skippedNoText++;
      continue;
    }

    byRating[rating || 'unknown'] = (byRating[rating || 'unknown'] || 0) + 1;
    byLanguage[language || 'unknown'] = (byLanguage[language || 'unknown'] || 0) + 1;

    const sourceId = reviewId
      ? `gmaps_${reviewId}`
      : 'gmaps_' + crypto.createHash('md5').update(text).digest('hex').slice(0, 16);

    const meta = {
      place_name: placeName,
      reviewer_total_reviews: reviewerNumberOfReviews,
      is_local_guide: isLocalGuide,
      response_from_owner: responseFromOwner,
      likes_count: likesCount,
      apify_review_id: reviewId,
    };

    const result = insertStmt.run({
      source: 'googlemaps',
      source_url: reviewUrl || placeUrl,
      source_id: sourceId,
      type: 'review',
      text: text.trim(),
      text_length: text.trim().length,
      language: language,
      rating: typeof rating === 'number' ? rating : (rating ? parseInt(rating) : null),
      country: null,  // Google Maps no expone país en reviews
      author_handle: author,
      published_date: publishedDate,
      related_topic: 'colosseum',
      metadata_json: JSON.stringify(meta),
    });
    if (result.changes > 0) added++;
    else skipped++;
  }
});

insertAll();

db.prepare(`
  UPDATE scrape_runs
  SET finished_at = datetime('now'),
      items_added = ?,
      items_skipped = ?,
      status = 'success'
  WHERE id = ?
`).run(added, skipped + skippedNoText, runId);

const totalCorpus = db.prepare(`SELECT COUNT(*) as n FROM corpus_items`).get().n;
const stats = db.prepare(`SELECT * FROM v_stats_by_source`).all();
db.close();

console.log('━'.repeat(70));
console.log('✅ IMPORT TERMINADO');
console.log('━'.repeat(70));
console.log(`Items en JSON:     ${data.length}`);
console.log(`Agregados:         ${added}`);
console.log(`Skip (duplicados): ${skipped}`);
console.log(`Skip (sin texto):  ${skippedNoText}`);
console.log(`Total corpus:      ${totalCorpus}`);
console.log('');
console.log('📊 Por rating:');
Object.entries(byRating).sort((a, b) => Number(b[0]) - Number(a[0])).forEach(([r, n]) => {
  console.log(`   ⭐ ${r}: ${String(n).padStart(4)}`);
});
console.log('');
console.log('📊 Top 10 idiomas:');
Object.entries(byLanguage).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([l, n]) => {
  console.log(`   ${l.padEnd(15)} | ${String(n).padStart(4)}`);
});
console.log('');
console.log('📊 Stats por fuente:');
stats.forEach(s => {
  console.log(`   ${s.source.padEnd(12)} | ${String(s.total_items).padStart(5)} items | rating ${s.avg_rating?.toFixed(2) || 'N/A'}`);
});
