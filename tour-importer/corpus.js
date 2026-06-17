
// corpus.js - Capa de acceso al CORPUS local (SQLite). Fuente unica de verdad de los
// datos crudos de origen (Viator hoy; GYG u otros manana). Source-agnostico y replicable:
// se copia a cualquier importer del portfolio y se apunta a su propia DB via CORPUS_DB.
//
// Principio: raw_json guarda el payload COMPLETO verbatim (nada se descarta nunca);
// las columnas normalizadas son para consultar; buildFactSheet() es el puente que entrega
// a los generadores/guard el texto de hechos autoritativo (incluye additionalInfo + itinerario
// con tiempos reales).
//
// Requiere: npm install better-sqlite3

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DEFAULT_DB = path.resolve(process.env.CORPUS_DB || './corpus/products.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  product_code             TEXT PRIMARY KEY,
  source                   TEXT NOT NULL DEFAULT 'viator',
  title                    TEXT,
  description              TEXT,
  duration                 TEXT,
  price                    REAL,
  currency                 TEXT DEFAULT 'USD',
  rating                   REAL,
  review_count             INTEGER,
  supplier                 TEXT,
  booking_url              TEXT,
  source_url               TEXT,
  itinerary_json           TEXT,
  itinerary_text           TEXT,
  includes_json            TEXT,
  excludes_json            TEXT,
  highlights_json          TEXT,
  additional_info_json     TEXT,
  review_distribution_json TEXT,
  images_json              TEXT,
  cancellation_text        TEXT,
  raw_json                 TEXT,
  scraped_at               TEXT,
  updated_at               TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_source ON products(source);
`;

let _db = null;
export function openCorpus(dbPath = DEFAULT_DB) {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.exec(SCHEMA);
  // Migración aditiva para DBs creadas antes de agregar columnas (ignora "duplicate column").
  for (const col of ['itinerary_text TEXT']) {
    try { _db.exec(`ALTER TABLE products ADD COLUMN ${col}`); } catch { /* ya existe */ }
  }
  return _db;
}
export function closeCorpus() { if (_db) { _db.close(); _db = null; } }

const J = v => (v == null ? null : JSON.stringify(v));
const P = v => { try { return v ? JSON.parse(v) : null; } catch { return null; } };

// Acepta el objeto que ya produce mapProductToTourData (mismas claves) + opcional `raw`.
export function upsertProduct(p) {
  const db = openCorpus();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO products (
      product_code, source, title, description, duration, price, currency, rating, review_count,
      supplier, booking_url, source_url, itinerary_json, itinerary_text, includes_json, excludes_json, highlights_json,
      additional_info_json, review_distribution_json, images_json, cancellation_text, raw_json,
      scraped_at, updated_at
    ) VALUES (
      @product_code, @source, @title, @description, @duration, @price, @currency, @rating, @review_count,
      @supplier, @booking_url, @source_url, @itinerary_json, @itinerary_text, @includes_json, @excludes_json, @highlights_json,
      @additional_info_json, @review_distribution_json, @images_json, @cancellation_text, @raw_json,
      @scraped_at, @updated_at
    )
    ON CONFLICT(product_code) DO UPDATE SET
      source=excluded.source, title=excluded.title, description=excluded.description, duration=excluded.duration,
      price=excluded.price, currency=excluded.currency, rating=excluded.rating, review_count=excluded.review_count,
      supplier=excluded.supplier, booking_url=excluded.booking_url, source_url=excluded.source_url,
      itinerary_json=excluded.itinerary_json, itinerary_text=excluded.itinerary_text, includes_json=excluded.includes_json, excludes_json=excluded.excludes_json,
      highlights_json=excluded.highlights_json, additional_info_json=excluded.additional_info_json,
      review_distribution_json=excluded.review_distribution_json, images_json=excluded.images_json,
      cancellation_text=excluded.cancellation_text, raw_json=excluded.raw_json, updated_at=excluded.updated_at
  `).run({
    product_code: p.productCode,
    source: p.source || 'viator',
    title: p.title ?? null,
    description: p.description ?? null,
    duration: p.duration ?? null,
    price: p.price ?? null,
    currency: p.currency || 'USD',
    rating: p.rating ?? null,
    review_count: p.reviewCount ?? null,
    supplier: p.provider || p.supplier || null,
    booking_url: p.url || p.bookingUrl || null,
    source_url: p.sourceUrl || null,
    itinerary_json: J(p.itinerary),
    itinerary_text: p.itineraryText || null,
    includes_json: J(p.includes),
    excludes_json: J(p.excludes),
    highlights_json: J(p.highlights),
    additional_info_json: J(p.additionalInfo),
    review_distribution_json: J(p.reviewDistribution),
    images_json: J(p.images),
    cancellation_text: p.cancellationText ?? null,
    raw_json: J(p.raw ?? p),
    scraped_at: p.scrapedAt || now,
    updated_at: now,
  });
  return { productCode: p.productCode, ok: true };
}

function rowToProduct(r) {
  if (!r) return null;
  return {
    productCode: r.product_code, source: r.source, title: r.title, description: r.description,
    duration: r.duration, price: r.price, currency: r.currency, rating: r.rating, reviewCount: r.review_count,
    supplier: r.supplier, bookingUrl: r.booking_url, sourceUrl: r.source_url,
    itinerary: P(r.itinerary_json), itineraryText: r.itinerary_text, includes: P(r.includes_json), excludes: P(r.excludes_json),
    highlights: P(r.highlights_json), additionalInfo: P(r.additional_info_json),
    reviewDistribution: P(r.review_distribution_json), images: P(r.images_json),
    cancellationText: r.cancellation_text, raw: P(r.raw_json),
    scrapedAt: r.scraped_at, updatedAt: r.updated_at,
  };
}

export function getProduct(code) {
  return rowToProduct(openCorpus().prepare('SELECT * FROM products WHERE product_code = ?').get(code));
}
export function getAllProducts({ limit = 100000 } = {}) {
  return openCorpus().prepare('SELECT * FROM products ORDER BY review_count DESC NULLS LAST LIMIT ?')
    .all(limit).map(rowToProduct);
}
export function listProductCodes() {
  return openCorpus().prepare('SELECT product_code FROM products').all().map(r => r.product_code);
}
export function countProducts() {
  return openCorpus().prepare('SELECT COUNT(*) n FROM products').get().n;
}

// ---- El puente: producto del corpus -> texto de HECHOS autoritativo para generadores/guard ----
// Esto reemplaza el buildSourceText-desde-el-body. La verdad viene del origen, no del derivado.
// Quality tags que Viator usa para rankear (señal de calidad de la fuente).
const QUALITY_TAGS = {
  367652: 'Top Product', 21972: 'Excellent Quality', 22143: 'Best Conversion',
  22083: 'Likely To Sell', 367653: 'Low Supplier Cancellation', 367654: 'Low Last-Minute Cancellation',
};
const qualityTags = tags => (tags || []).map(t => QUALITY_TAGS[t]).filter(Boolean);

// pricingInfo.ageBands -> línea citable de edades + tamaño de grupo.
function ageBandsLine(pi) {
  const bands = pi?.ageBands;
  if (!Array.isArray(bands) || !bands.length) return '';
  const parts = bands.map(b => `${(b.ageBand || '').toLowerCase()} ${b.startAge}-${b.endAge}`);
  const adult = bands.find(b => b.ageBand === 'ADULT') || bands[0];
  const grp = (adult && (adult.minTravelersPerBooking || adult.maxTravelersPerBooking))
    ? `; group ${adult.minTravelersPerBooking || 1}-${adult.maxTravelersPerBooking} per booking` : '';
  return `- ${pi.type === 'PER_PERSON' ? 'Per person' : (pi.type || 'Pricing')}; ages: ${parts.join(', ')}${grp}`;
}

// logistics -> pickup/meeting en palabras (sin refs opacos).
function logisticsLine(lg) {
  if (!lg) return '';
  const out = [];
  const tp = lg.travelerPickup;
  const map = {
    PICKUP_EVERYONE: 'Hotel pickup included for all travelers',
    PICKUP_AND_MEET_AT_START_POINT: 'Hotel pickup available, or meet at the start point',
    MEET_EVERYONE_AT_START_POINT: 'Meet at the start point (no pickup)',
    PICKUP_AND_MEET_AT_DEPARTURE_POINT: 'Pickup available, or meet at the departure point',
  };
  if (tp?.pickupOptionType) out.push('- ' + (map[tp.pickupOptionType] || tp.pickupOptionType));
  const start = Array.isArray(lg.start) ? lg.start[0] : null;
  if (start?.description) out.push(`- Meeting point note: ${String(start.description).trim()}`);
  return out.join('\n');
}

function fmtItineraryStep(s) {
  const dur = s.durationMinutes ? ` (${s.durationMinutes} min)` : '';
  const name = s.name || '';
  const desc = s.description ? ` — ${s.description}` : '';
  return `- ${name}${dur}${desc}`.replace(/\s+—\s*$/, '');
}
export function buildFactSheet(codeOrProduct) {
  const p = typeof codeOrProduct === 'string' ? getProduct(codeOrProduct) : codeOrProduct;
  if (!p) return null;
  const raw = p.raw || {};
  const lines = [];
  lines.push(`TITLE: ${p.title || ''}`);
  if (p.duration) lines.push(`DURATION: ${p.duration}`);
  if (p.price != null) lines.push(`PRICE: ${p.currency || 'USD'} ${p.price} per person`);
  if (p.rating != null) lines.push(`RATING: ${p.rating}/5 (${p.reviewCount ?? 0} reviews)`);
  if (p.supplier) lines.push(`OPERATOR: ${p.supplier}`);
  if (p.description) lines.push(`\nDESCRIPTION:\n${p.description}`);
  if (p.highlights?.length) lines.push(`\nHIGHLIGHTS:\n${p.highlights.map(h => `- ${h}`).join('\n')}`);
  if (p.includes?.length) lines.push(`\nINCLUDED:\n${p.includes.map(i => `- ${i}`).join('\n')}`);
  if (p.excludes?.length) lines.push(`\nNOT INCLUDED:\n${p.excludes.map(e => `- ${e}`).join('\n')}`);
  if (p.itinerary?.length) lines.push(`\nITINERARY (stops, with real durations):\n${p.itinerary.map(fmtItineraryStep).join('\n')}`);
  else if (p.itineraryText) lines.push(`\nITINERARY:\n${p.itineraryText}`);

  // additionalInfo separado: typed (accesibilidad/aptitud/family/health, estandarizado por Viator) vs OTHER (notas del operador).
  const ai = (p.additionalInfo || [])
    .map(a => (typeof a === 'string' ? { type: 'OTHER', text: a } : a))
    .filter(a => (a.text || a.description || '').trim());
  const typed = ai.filter(a => a.type && a.type !== 'OTHER');
  const other = ai.filter(a => !a.type || a.type === 'OTHER');
  if (typed.length) lines.push(`\nTRAVELER FACTS (accessibility / fitness / family - standardized by Viator):\n${typed.map(a => `- ${a.text || a.description}`).join('\n')}`);

  const ages = ageBandsLine(raw.pricingInfo);
  if (ages) lines.push(`\nAGES & GROUP SIZE:\n${ages}`);

  const logi = logisticsLine(raw.logistics);
  if (logi) lines.push(`\nPICKUP / MEETING:\n${logi}`);

  if (other.length) lines.push(`\nGOOD TO KNOW (operator notes - operational facts):\n${other.map(a => `- ${a.text || a.description}`).join('\n')}`);

  // Variantes / escalera de upgrade (solo si hay más de una).
  const opts = (raw.productOptions || []).map(o => o.title).filter(Boolean);
  if (opts.length > 1) lines.push(`\nOPTIONS (upgrade tiers offered):\n${opts.map(t => `- ${t}`).join('\n')}`);

  if (p.cancellationText) lines.push(`\nCANCELLATION:\n${p.cancellationText}`);

  // Señales de calidad del propio Viator. Contexto para el verdict; no citar como elogio en prosa.
  const q = qualityTags(raw.tags);
  if (q.length) lines.push(`\nVIATOR QUALITY SIGNALS (Viator's own product tags - context only, do not quote as praise): ${q.join(', ')}`);

  if (raw.lastUpdatedAt) lines.push(`\nSOURCE FRESHNESS: Viator product data last updated ${String(raw.lastUpdatedAt).slice(0, 10)}.`);

  return lines.join('\n');
}
