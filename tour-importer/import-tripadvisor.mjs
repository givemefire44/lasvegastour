#!/usr/bin/env node
/**
 * import-tripadvisor.mjs
 *
 * Importa el JSON descargado de Apify (TripAdvisor Reviews Scraper - maxcopell)
 * al corpus SQLite con source='tripadvisor'.
 *
 * Como la URL pasada a Apify es específica del Coliseo, NO filtra por palabra
 * clave: todas las reviews son del Coliseo por definición.
 *
 * Uso:
 *   node import-tripadvisor.mjs                       # default: tripadvisor-reviews.json
 *   node import-tripadvisor.mjs --file=otro.json      # archivo distinto
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import crypto from 'crypto';

const DB_PATH = './colosseum-corpus.db';
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
const INPUT = fileArg || './tripadvisor-reviews.json';

if (!existsSync(INPUT)) {
  console.error(`❌ No encontré el archivo: ${INPUT}`);
  process.exit(1);
}

console.log('━'.repeat(70));
console.log('📥 IMPORT TRIPADVISOR (Apify) → CORPUS');
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
  VALUES ('tripadvisor', 'Apify import — Coliseo Roma', 'running')
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
const byCountry = {};

const insertAll = db.transaction(() => {
  for (const item of data) {
    // Apify TripAdvisor Reviews Scraper devuelve campos:
    // title, text, rating, travelDate, publishedDate, url, user (objeto), ownerResponse, placeInfo
    const title = item.title || '';
    const text = item.text || '';
    const rating = item.rating || null;
    const author = item.user?.username || item.user?.name || item.userName || null;
    const country = item.user?.userLocation?.shortName || item.user?.location || null;
    const publishedDate = parseDate(item.publishedDate || item.date);
    const travelDate = item.travelDate || null;
    const reviewUrl = item.url || null;
    const ownerResponse = item.ownerResponse?.text || item.ownerResponseText || null;
    const helpfulVotes = item.user?.helpfulVotes || item.helpfulVotes || 0;
    const totalContributions = item.user?.totalContributions || item.user?.contributions || null;
    const placeName = item.placeInfo?.name || item.placeName || 'Colosseum';

    const fullText = [title, text].filter(Boolean).join('\n').trim();
    if (!fullText || fullText.length < 20) {
      skippedNoText++;
      continue;
    }

    byRating[rating || 'unknown'] = (byRating[rating || 'unknown'] || 0) + 1;
    byCountry[country || 'unknown'] = (byCountry[country || 'unknown'] || 0) + 1;

    // Source ID único (TripAdvisor URLs tienen /r123456789-Reviews-...)
    const reviewIdMatch = (reviewUrl || '').match(/-r(\d+)-/);
    const reviewId = reviewIdMatch ? reviewIdMatch[1] : null;
    const sourceId = reviewId
      ? `ta_${reviewId}`
      : 'ta_' + crypto.createHash('md5').update(fullText).digest('hex').slice(0, 16);

    const meta = {
      place_name: placeName,
      review_title: title || null,
      travel_date: travelDate,
      owner_response: ownerResponse,
      helpful_votes: helpfulVotes,
      total_contributions: totalContributions,
      apify_review_id: reviewId,
    };

    const result = insertStmt.run({
      source: 'tripadvisor',
      source_url: reviewUrl,
      source_id: sourceId,
      type: 'review',
      text: fullText,
      text_length: fullText.length,
      language: item.language || 'unknown',
      rating: typeof rating === 'number' ? rating : (rating ? parseInt(rating) : null),
      country: country,
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
console.log('📊 Top 10 países / ubicaciones:');
Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([c, n]) => {
  console.log(`   ${c.padEnd(25).slice(0, 25)} | ${String(n).padStart(4)}`);
});
console.log('');
console.log('📊 Stats por fuente:');
stats.forEach(s => {
  console.log(`   ${s.source.padEnd(12)} | ${String(s.total_items).padStart(5)} items | rating ${s.avg_rating?.toFixed(2) || 'N/A'}`);
});