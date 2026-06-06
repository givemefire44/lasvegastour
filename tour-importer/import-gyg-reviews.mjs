#!/usr/bin/env node
/**
 * import-gyg-reviews.mjs
 *
 * Importa reviews-colosseum-clean.json al corpus SQLite.
 * Mapea cada review al schema universal corpus_items.
 *
 * Uso:
 *   node import-gyg-reviews.mjs
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const DB_PATH = './colosseum-corpus.db';
const INPUT = './reviews-colosseum-clean.json';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─────────────────────────────────────────────────────────────────
// Empezar registro de scrape run
// ─────────────────────────────────────────────────────────────────
const runResult = db.prepare(`
  INSERT INTO scrape_runs (source, notes, status)
  VALUES ('gyg', 'Import inicial desde reviews-colosseum-clean.json', 'running')
`).run();
const runId = runResult.lastInsertRowid;

console.log('━'.repeat(70));
console.log('📥 IMPORTANDO GYG REVIEWS AL CORPUS');
console.log('━'.repeat(70));

// ─────────────────────────────────────────────────────────────────
// Leer JSON
// ─────────────────────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(INPUT, 'utf8'));
console.log(`📦 Tours en JSON: ${raw.totalTours}`);
console.log(`📦 Reviews únicas en JSON: ${raw.totalReviews}`);
console.log('');

// ─────────────────────────────────────────────────────────────────
// Convertir fecha "October 24, 2025" → "2025-10-24"
// ─────────────────────────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0]; // "2025-10-24"
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Generar source_id único (hash del text + country + tour)
// ─────────────────────────────────────────────────────────────────
function makeSourceId(tour, review) {
  const key = `${tour.slug}|${review.country || ''}|${review.text || ''}`;
  return 'gyg_' + crypto.createHash('md5').update(key).digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────
// INSERT preparado (más rápido para bulk)
// ─────────────────────────────────────────────────────────────────
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO corpus_items (
    source, source_url, source_id, type,
    text, text_length, language,
    rating, country, published_date,
    related_tour_slug, related_topic,
    metadata_json,
    fetched_at
  ) VALUES (
    @source, @source_url, @source_id, @type,
    @text, @text_length, @language,
    @rating, @country, @published_date,
    @related_tour_slug, @related_topic,
    @metadata_json,
    @fetched_at
  )
`);

// ─────────────────────────────────────────────────────────────────
// Transacción para hacer todo de una (mucho más rápido)
// ─────────────────────────────────────────────────────────────────
const importAll = db.transaction(() => {
  let added = 0;
  let skipped = 0;

  for (const tour of raw.tours) {
    const tourMeta = {
      gyg_tour_id: tour.gygTourId,
      gyg_url: tour.gygUrl,
      provider: tour.provider,
      tour_type: tour.tourType,
      format: tour.format,
      group_size: tour.groupSize,
      tour_total_rating: tour.rating,
      tour_total_review_count: tour.reviewCount,
      tour_price: tour.price,
      tour_duration: tour.duration
    };

    for (const review of tour.reviews) {
      const sourceId = makeSourceId(tour, review);
      const text = (review.text || '').trim();
      if (!text) {
        skipped++;
        continue;
      }

      const result = insertStmt.run({
        source: 'gyg',
        source_url: tour.gygUrl,
        source_id: sourceId,
        type: 'review',
        text: text,
        text_length: text.length,
        language: 'en', // GYG mostly English by default
        rating: review.rating || null,
        country: review.country || null,
        published_date: parseDate(review.date),
        related_tour_slug: tour.slug,
        related_topic: 'colosseum',
        metadata_json: JSON.stringify(tourMeta),
        fetched_at: raw.sourceGeneratedAt || new Date().toISOString()
      });

      if (result.changes > 0) added++;
      else skipped++; // ya existía (UNIQUE source_id)
    }
  }

  return { added, skipped };
});

const { added, skipped } = importAll();

// ─────────────────────────────────────────────────────────────────
// Cerrar registro de run
// ─────────────────────────────────────────────────────────────────
db.prepare(`
  UPDATE scrape_runs
  SET finished_at = datetime('now'),
      items_added = ?,
      items_skipped = ?,
      status = 'success'
  WHERE id = ?
`).run(added, skipped, runId);

// ─────────────────────────────────────────────────────────────────
// Stats finales
// ─────────────────────────────────────────────────────────────────
const totalInDb = db.prepare(`SELECT COUNT(*) as n FROM corpus_items`).get().n;
const stats = db.prepare(`SELECT * FROM v_stats_by_source`).all();

db.close();

console.log('━'.repeat(70));
console.log('✅ IMPORT COMPLETADO');
console.log('━'.repeat(70));
console.log(`Items agregados: ${added}`);
console.log(`Items skip (duplicado / texto vacío): ${skipped}`);
console.log(`Total en corpus_items: ${totalInDb}`);
console.log('');
console.log('📊 Stats por fuente:');
stats.forEach(s => {
  console.log(`   ${s.source.padEnd(12)} | ${String(s.total_items).padStart(5)} items | avg rating: ${s.avg_rating?.toFixed(2) || 'N/A'} | ${s.countries} países`);
});
console.log('');
console.log('Para explorar: abrí DB Browser → tab "Browse Data" → seleccioná "corpus_items"');