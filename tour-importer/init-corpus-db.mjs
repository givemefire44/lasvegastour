#!/usr/bin/env node
/**
 * init-corpus-db.mjs
 *
 * Crea la base de datos SQLite del corpus Coliseo con el schema completo.
 * Diseñado para máxima capacidad analítica y comparativa entre fuentes.
 *
 * Uso:
 *   node init-corpus-db.mjs
 *
 * Crea: ./colosseum-corpus.db
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';

const DB_PATH = './colosseum-corpus.db';

// ─────────────────────────────────────────────────────────────────
// Si existe, avisar y abortar (para no sobrescribir sin querer)
// ─────────────────────────────────────────────────────────────────
if (existsSync(DB_PATH)) {
  console.log(`⚠️  El archivo ${DB_PATH} ya existe.`);
  console.log(`   Si querés recrearlo desde cero, borralo primero:`);
  console.log(`   Remove-Item ${DB_PATH}`);
  process.exit(0);
}

const db = new Database(DB_PATH);

// Activar mejoras de performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('━'.repeat(70));
console.log('🏗️  CREANDO BASE DE DATOS DEL CORPUS COLISEO');
console.log('━'.repeat(70));

// ─────────────────────────────────────────────────────────────────
// TABLA PRINCIPAL: corpus_items
// ─────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE corpus_items (
  -- Identificación
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,                   -- 'gyg', 'reddit', 'tripadvisor', 'viator', 'quora', 'youtube', 'paa', 'forum'
  source_url TEXT,                        -- URL original
  source_id TEXT,                         -- ID interno de la fuente (para dedup)
  type TEXT NOT NULL,                     -- 'review', 'question', 'answer', 'comment', 'post', 'transcript', 'search_query'

  -- Contenido
  text TEXT NOT NULL,                     -- contenido completo
  text_original TEXT,                     -- si fue traducido, original acá
  text_length INTEGER,                    -- caracteres (para filtros rápidos)
  language TEXT DEFAULT 'en',             -- 'en', 'es', 'de', 'fr', 'it', etc.

  -- Metadata del autor / item
  rating REAL,                            -- 1-5 si aplica, NULL si no
  country TEXT,                           -- país del autor si está
  author_handle TEXT,                     -- usuario/nick si está
  votes INTEGER,                          -- upvotes/likes si aplica
  published_date TEXT,                    -- ISO date del item original
  parent_id INTEGER REFERENCES corpus_items(id),  -- si es respuesta a otro item del corpus

  -- Conexión con tu catálogo
  related_tour_slug TEXT,                 -- match exacto con un tour tuyo
  related_tour_match_score REAL,          -- 0-1 si fue matching difuso
  related_topic TEXT,                     -- 'colosseum', 'vatican', 'rome-general', etc.

  -- Cajón de sastre para campos específicos de cada fuente
  metadata_json TEXT,                     -- JSON con campos extra (flair Reddit, provider GYG, etc.)

  -- Análisis (llenado después por enriquecimiento con Opus)
  topic_tags TEXT,                        -- JSON array: ["guide","underground","price"]
  sentiment TEXT,                         -- 'pos', 'neg', 'neu', 'mixed'
  sentiment_score REAL,                   -- -1 a +1 si querés precisión
  pain_points TEXT,                       -- JSON array: ["app crashed","late guide"]
  claims TEXT,                            -- JSON array: afirmaciones citables
  questions_raised TEXT,                  -- JSON array: preguntas implícitas/explícitas

  -- Tracking
  fetched_at TEXT DEFAULT (datetime('now')),
  enriched_at TEXT,                       -- NULL hasta que Opus lo procese
  enrichment_version TEXT,                -- 'v1', 'v2' (por si reprocessamos con prompts mejores)

  -- Constraint para evitar duplicados de la misma fuente+id
  UNIQUE(source, source_id)
);
`);

console.log('✅ Tabla creada: corpus_items');

// ─────────────────────────────────────────────────────────────────
// ÍNDICES (para que las queries sean rápidas con miles de items)
// ─────────────────────────────────────────────────────────────────
db.exec(`
CREATE INDEX idx_source ON corpus_items(source);
CREATE INDEX idx_type ON corpus_items(type);
CREATE INDEX idx_rating ON corpus_items(rating);
CREATE INDEX idx_country ON corpus_items(country);
CREATE INDEX idx_published_date ON corpus_items(published_date);
CREATE INDEX idx_related_tour ON corpus_items(related_tour_slug);
CREATE INDEX idx_related_topic ON corpus_items(related_topic);
CREATE INDEX idx_sentiment ON corpus_items(sentiment);
CREATE INDEX idx_enriched_at ON corpus_items(enriched_at);
CREATE INDEX idx_text_length ON corpus_items(text_length);
`);

console.log('✅ Índices creados (10 índices para queries rápidas)');

// ─────────────────────────────────────────────────────────────────
// TABLA AUXILIAR: scrape_runs (log de cada corrida de scraping)
// ─────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE scrape_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  items_added INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'running'           -- 'running', 'success', 'partial', 'failed'
);
`);

console.log('✅ Tabla creada: scrape_runs (log de scrapings)');

// ─────────────────────────────────────────────────────────────────
// TABLA AUXILIAR: topics_catalog (taxonomía maestra de temas)
// ─────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE topics_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_key TEXT UNIQUE NOT NULL,         -- 'guide-quality', 'underground-access', etc.
  topic_label TEXT NOT NULL,              -- "Guide Quality", "Underground Access"
  description TEXT,
  parent_topic TEXT,                      -- jerarquía: 'access' > 'underground-access'
  created_at TEXT DEFAULT (datetime('now'))
);
`);

console.log('✅ Tabla creada: topics_catalog (taxonomía de temas)');

// ─────────────────────────────────────────────────────────────────
// TABLA AUXILIAR: insights (hallazgos del análisis para artículos)
// ─────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insight_type TEXT NOT NULL,             -- 'pattern', 'contradiction', 'gap', 'pain_point', 'claim'
  topic_key TEXT,                         -- referencia a topics_catalog
  title TEXT NOT NULL,                    -- "67% de reviews 5★ mencionan al guía"
  description TEXT,                       -- explicación detallada
  evidence_json TEXT,                     -- JSON con IDs de corpus_items que lo respaldan
  evidence_count INTEGER,                 -- cuántos items lo respaldan
  sources_json TEXT,                      -- JSON: ["gyg","reddit"] (qué fuentes lo confirman)
  confidence_score REAL,                  -- 0-1 (qué tan sólido es)
  article_potential TEXT,                 -- 'high', 'medium', 'low'
  suggested_title TEXT,                   -- título de artículo sugerido
  used_in_article_slug TEXT,              -- si ya se usó en un artículo, slug acá
  created_at TEXT DEFAULT (datetime('now'))
);
`);

console.log('✅ Tabla creada: insights (hallazgos para artículos)');

// ─────────────────────────────────────────────────────────────────
// VISTA: stats por fuente (para dashboard rápido)
// ─────────────────────────────────────────────────────────────────
db.exec(`
CREATE VIEW v_stats_by_source AS
SELECT
  source,
  COUNT(*) as total_items,
  COUNT(DISTINCT country) as countries,
  AVG(rating) as avg_rating,
  AVG(text_length) as avg_text_length,
  MIN(published_date) as oldest_item,
  MAX(published_date) as newest_item,
  SUM(CASE WHEN enriched_at IS NOT NULL THEN 1 ELSE 0 END) as enriched_items,
  SUM(CASE WHEN sentiment = 'neg' THEN 1 ELSE 0 END) as negative_items,
  SUM(CASE WHEN sentiment = 'pos' THEN 1 ELSE 0 END) as positive_items
FROM corpus_items
GROUP BY source;
`);

console.log('✅ Vista creada: v_stats_by_source');

// ─────────────────────────────────────────────────────────────────
// FINAL
// ─────────────────────────────────────────────────────────────────
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
const views = db.prepare(`SELECT name FROM sqlite_master WHERE type='view' ORDER BY name`).all();

db.close();

console.log('');
console.log('━'.repeat(70));
console.log('✅ BASE DE DATOS CREADA');
console.log('━'.repeat(70));
console.log(`📁 Archivo: ${DB_PATH}`);
console.log(`📋 Tablas: ${tables.map(t => t.name).join(', ')}`);
console.log(`🔍 Índices: ${indexes.length}`);
console.log(`👁️  Vistas: ${views.map(v => v.name).join(', ')}`);
console.log('');
console.log('Próximo paso: abrí el archivo con DB Browser for SQLite');
console.log('  1. Open DB Browser for SQLite');
console.log('  2. File → Open Database → seleccioná colosseum-corpus.db');
console.log('  3. Tab "Database Structure" → vas a ver las 4 tablas vacías');