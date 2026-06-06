#!/usr/bin/env node
/**
 * import-trustpilot.mjs
 *
 * Importa el JSON descargado de Apify (Trustpilot Reviews Scraper)
 * al corpus SQLite con source='trustpilot'.
 *
 * NOTA: Como los operadores se eligen manualmente en Apify (todos relacionados
 * con tours del Coliseo / Roma), no se filtra por palabra clave en el texto.
 *
 * Uso:
 *   node import-trustpilot.mjs                     # default: trustpilot-reviews.json
 *   node import-trustpilot.mjs --file=otro.json    # archivo distinto
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import crypto from 'crypto';

const DB_PATH = './colosseum-corpus.db';
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
const INPUT = fileArg || './trustpilot-reviews.json';

if (!existsSync(INPUT)) {
  console.error(`❌ No encontré el archivo: ${INPUT}`);
  console.error('   Asegurate de que esté en la carpeta tour-importer/');
  process.exit(1);
}

console.log('━'.repeat(70));
console.log('📥 IMPORT TRUSTPILOT (Apify) → CORPUS');
console.log('━'.repeat(70));

// Leer JSON
const raw = readFileSync(INPUT, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('❌ No pude parsear el JSON:', err.message);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('❌ El JSON no es un array.');
  process.exit(1);
}

console.log(`📦 Items en JSON: ${data.length}`);

if (data.length > 0) {
  console.log(`🔍 Campos disponibles: ${Object.keys(data[0]).join(', ')}`);
}
console.log('');

// DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const runResult = db.prepare(`
  INSERT INTO scrape_runs (source, notes, status)
  VALUES ('trustpilot', 'Apify import', 'running')
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

// Extraer dominio del operador desde reviewUrl (Trustpilot redirige así)
// La reviewUrl es de la forma https://www.trustpilot.com/reviews/{reviewId}
// El dominio del operador hay que sacarlo de otra fuente — buscar en businessUrl, companyUrl, o domain
function extractOperatorInfo(item) {
  // Buscar en varios campos posibles
  const possibleFields = [
    item.companyDomain, item.businessDomain, item.domain, item.businessUnitId,
    item.companyName, item.businessName,
    item.companyUrl, item.businessUrl,
  ];
  let operator = null;
  for (const field of possibleFields) {
    if (field && typeof field === 'string') {
      operator = field.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
      break;
    }
  }
  return operator;
}

let added = 0;
let skipped = 0;
let skippedNoText = 0;
const byOperator = {};
const byCountry = {};
const byRating = {};

const insertAll = db.transaction(() => {
  for (const item of data) {
    const reviewId = item.reviewId || item.id || null;
    const title = item.title || '';
    const text = item.text || item.reviewText || '';
    const rating = item.rating || item.stars || null;
    const author = item.authorName || item.author || null;
    const country = item.country || item.authorCountry || null;
    const language = item.language || 'en';
    const publishedDate = parseDate(item.publishedDate || item.date || item.createdAt);
    const reviewUrl = item.reviewUrl || item.url || null;
    const operatorInfo = extractOperatorInfo(item);
    const verified = item.verificationLevel || item.verified || null;
    const reply = item.companyReply || item.reply || null;
    const experienceDate = item.dateOfExperience || item.experienceDate || null;

    const fullText = [title, text].filter(Boolean).join('\n').trim();
    if (!fullText || fullText.length < 20) {
      skippedNoText++;
      continue;
    }

    // SIN filtro de relevancia: confiamos en que los operadores fueron elegidos a mano
    const opKey = operatorInfo || 'unknown';
    byOperator[opKey] = (byOperator[opKey] || 0) + 1;
    byCountry[country || 'unknown'] = (byCountry[country || 'unknown'] || 0) + 1;
    byRating[rating || 'unknown'] = (byRating[rating || 'unknown'] || 0) + 1;

    const sourceId = reviewId
      ? `tp_${reviewId}`
      : 'tp_' + crypto.createHash('md5').update(`${opKey}|${fullText}`).digest('hex').slice(0, 16);

    const meta = {
      operator_domain: operatorInfo,
      review_title: title || null,
      verified: verified || null,
      experience_date: experienceDate,
      operator_response: reply || null,
      apify_review_id: reviewId,
    };

    const result = insertStmt.run({
      source: 'trustpilot',
      source_url: reviewUrl,
      source_id: sourceId,
      type: 'review',
      text: fullText,
      text_length: fullText.length,
      language: language,
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
console.log(`Items en JSON:       ${data.length}`);
console.log(`Agregados:           ${added}`);
console.log(`Skip (duplicados):   ${skipped}`);
console.log(`Skip (sin texto):    ${skippedNoText}`);
console.log(`Total corpus:        ${totalCorpus}`);
console.log('');
console.log('📊 Por rating:');
Object.entries(byRating).sort((a, b) => b[1] - a[1]).forEach(([r, n]) => {
  console.log(`   ⭐ ${r}: ${String(n).padStart(4)} reviews`);
});
console.log('');
console.log('📊 Top 10 países:');
Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([c, n]) => {
  console.log(`   ${c.padEnd(20)} | ${String(n).padStart(4)}`);
});
console.log('');
console.log('📊 Stats por fuente:');
stats.forEach(s => {
  console.log(`   ${s.source.padEnd(12)} | ${String(s.total_items).padStart(5)} items | rating ${s.avg_rating?.toFixed(2) || 'N/A'}`);
});
