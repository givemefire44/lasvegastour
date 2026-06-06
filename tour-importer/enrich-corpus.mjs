#!/usr/bin/env node
/**
 * enrich-corpus.mjs
 *
 * Pasa cada item del corpus por Sonnet 4.6 para extraer:
 *  - topic_tags: ["guide", "underground", "price"]
 *  - sentiment: pos/neg/neu/mixed
 *  - pain_points: cosas que fallaron / problemas
 *  - claims: afirmaciones citables con datos
 *  - questions_raised: preguntas implícitas/explícitas
 *
 * Uso:
 *   node enrich-corpus.mjs                # batch prueba 200 items
 *   node enrich-corpus.mjs --batch=500    # batch personalizado
 *   node enrich-corpus.mjs --all          # procesa todo lo pendiente
 *   node enrich-corpus.mjs --resume       # alias de --all
 *
 * Costo estimado:
 *   ~$0.005 por item con Sonnet 4.6
 *   200 items ≈ $1
 *   4000 items ≈ $20
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';

const DB_PATH = './colosseum-corpus.db';
const MODEL = 'claude-sonnet-4-6';
const ENRICHMENT_VERSION = 'v1';
const PARALLELISM = 5; // items en paralelo
const MAX_RETRIES = 3;

// CLI args
const args = process.argv.slice(2);
const ALL = args.includes('--all') || args.includes('--resume');
const batchArg = args.find(a => a.startsWith('--batch='));
const BATCH = batchArg ? parseInt(batchArg.split('=')[1]) : (ALL ? Infinity : 200);

// API
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Falta ANTHROPIC_API_KEY en .env.local');
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// DB
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const updateStmt = db.prepare(`
  UPDATE corpus_items SET
    topic_tags = ?,
    sentiment = ?,
    sentiment_score = ?,
    pain_points = ?,
    claims = ?,
    questions_raised = ?,
    enriched_at = datetime('now'),
    enrichment_version = ?
  WHERE id = ?
`);

const markFailedStmt = db.prepare(`
  UPDATE corpus_items SET
    enriched_at = datetime('now'),
    enrichment_version = 'failed'
  WHERE id = ?
`);

// ═══════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You analyze content about the Roman Colosseum and Rome tours. For each item provided, extract structured data.

Return ONLY a valid JSON object (no markdown, no preamble) with this exact schema:

{
  "topic_tags": ["string"],
  "sentiment": "pos" | "neg" | "neu" | "mixed",
  "sentiment_score": -1.0 to 1.0,
  "pain_points": ["string"],
  "claims": ["string"],
  "questions_raised": ["string"]
}

Rules:
- topic_tags: 1-5 short tags from this taxonomy (use only these): guide-quality, underground, arena-floor, skip-the-line, price, value, time-of-day, crowds, weather, kids-families, accessibility, audio-guide, app, food, transport, vatican-combo, forum-palatine, history, photography, booking-process, cancellation, scam, language, group-size, private-tour, night-tour, duration, queue, meeting-point, off-topic
- sentiment: overall feeling. "mixed" only if BOTH clearly positive AND negative.
- sentiment_score: numeric -1 (very negative) to +1 (very positive)
- pain_points: SPECIFIC things that went wrong (e.g. "guide arrived 20 minutes late", "audio app crashed inside monument"). Empty array if none.
- claims: ANY verifiable factual statement with data (e.g. "tour cost $141", "underground sells out 3 weeks ahead", "Colosseum holds 50000 spectators"). Empty array if none.
- questions_raised: implicit or explicit questions the content raises (e.g. "is underground worth the extra money?", "how to book official tickets?"). Empty array if none.
- If content is OFF-TOPIC (not about Rome Colosseum or related Rome tourism), use topic_tags: ["off-topic"] and empty arrays elsewhere.
- Be specific and concrete. Avoid vague extractions.`;

function buildUserPrompt(item) {
  const meta = JSON.parse(item.metadata_json || '{}');
  const context = [];
  if (item.source === 'gyg') {
    context.push(`Source: GetYourGuide review`);
    if (meta.tour_type) context.push(`Tour type: ${meta.tour_type}`);
    if (meta.format) context.push(`Format: ${meta.format}`);
    if (item.rating) context.push(`Rating: ${item.rating}/5`);
    if (item.country) context.push(`From: ${item.country}`);
  } else if (item.source === 'youtube') {
    context.push(`Source: YouTube ${item.type}`);
    if (meta.video_title) context.push(`Video: ${meta.video_title}`);
    if (meta.channel) context.push(`Channel: ${meta.channel}`);
    if (item.votes) context.push(`Likes: ${item.votes}`);
  }
  return `${context.join('\n')}\n\nContent:\n${item.text}`;
}

// ═══════════════════════════════════════════════════════════════════
// PROCESAR UN ITEM
// ═══════════════════════════════════════════════════════════════════
async function enrichItem(item, attempt = 1) {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(item) }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text in response');

    let raw = textBlock.text.trim();
    // Sanitize: remove markdown fences if present
    raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    const data = JSON.parse(raw);

    updateStmt.run(
      JSON.stringify(data.topic_tags || []),
      data.sentiment || null,
      typeof data.sentiment_score === 'number' ? data.sentiment_score : null,
      JSON.stringify(data.pain_points || []),
      JSON.stringify(data.claims || []),
      JSON.stringify(data.questions_raised || []),
      ENRICHMENT_VERSION,
      item.id
    );

    return { ok: true, id: item.id };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return enrichItem(item, attempt + 1);
    }
    markFailedStmt.run(item.id);
    return { ok: false, id: item.id, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log('━'.repeat(70));
  console.log(`🤖 ENRIQUECIMIENTO CON ${MODEL}`);
  console.log(`Modo: ${ALL ? 'TODO PENDIENTE' : `BATCH DE ${BATCH}`}`);
  console.log('━'.repeat(70));

  // Items pendientes (related_topic = colosseum, no enriquecidos aún o fallidos)
  const items = db.prepare(`
    SELECT id, source, type, text, rating, country, metadata_json
    FROM corpus_items
    WHERE related_topic = 'colosseum'
      AND (enriched_at IS NULL OR enrichment_version = 'failed')
      AND text IS NOT NULL
      AND length(text) >= 10
    ORDER BY id ASC
    LIMIT ?
  `).all(BATCH === Infinity ? -1 : BATCH); // -1 = sin límite en SQLite

  console.log(`📦 Items a procesar: ${items.length}`);
  if (items.length === 0) {
    console.log('   No hay items pendientes. Todo enriquecido.');
    db.close();
    return;
  }

  let ok = 0;
  let failed = 0;
  let processed = 0;
  const startTime = Date.now();

  // Procesar de a PARALLELISM
  for (let i = 0; i < items.length; i += PARALLELISM) {
    const batch = items.slice(i, i + PARALLELISM);
    const results = await Promise.all(batch.map(item => enrichItem(item)));
    for (const r of results) {
      processed++;
      if (r.ok) ok++; else failed++;
    }
    // Progress cada 20 items
    if (processed % 20 === 0 || processed === items.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = items.length - processed;
      const eta = remaining / rate;
      console.log(`   ${processed}/${items.length} | ✅ ${ok} ❌ ${failed} | ${rate.toFixed(1)} items/s | ETA ${(eta / 60).toFixed(1)} min`);
    }
  }

  console.log('');
  console.log('━'.repeat(70));
  console.log('✅ ENRIQUECIMIENTO TERMINADO');
  console.log('━'.repeat(70));
  console.log(`Procesados: ${processed}`);
  console.log(`Exitosos:   ${ok}`);
  console.log(`Fallidos:   ${failed}`);
  console.log('');

  // Stats post-proceso
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN enriched_at IS NOT NULL AND enrichment_version != 'failed' THEN 1 ELSE 0 END) as enriched,
      SUM(CASE WHEN enrichment_version = 'failed' THEN 1 ELSE 0 END) as failed
    FROM corpus_items
    WHERE related_topic = 'colosseum'
  `).get();

  console.log(`Estado del corpus 'colosseum':`);
  console.log(`   Total:       ${stats.total}`);
  console.log(`   Enriquecidos: ${stats.enriched} (${((stats.enriched / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   Fallidos:    ${stats.failed}`);
  console.log(`   Pendientes:  ${stats.total - stats.enriched - stats.failed}`);

  if (stats.total - stats.enriched - stats.failed > 0) {
    console.log('');
    console.log('Para procesar el resto: node enrich-corpus.mjs --all');
  }

  db.close();
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
