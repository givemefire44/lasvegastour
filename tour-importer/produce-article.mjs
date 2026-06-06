#!/usr/bin/env node
/**
 * produce-article.mjs
 *
 * FASE 4 — PRODUCCIÓN DE DOCUMENTO DE TRABAJO PARA REDACCIÓN
 *
 * Genera un documento estructurado con los 7 componentes obligatorios:
 * INTENCIÓN, TESIS, HARD DATA, TRADE-OFFS, ESTRUCTURA, NARRATIVA, CITAS
 * PRE-ARMADAS, EXPERIENCIA, AUTORIDAD (methodology robusto).
 *
 * v3: TRADE-OFF se remarca como bloque visual dentro de CADA H2 del
 * narrative draft, para que redacción no lo entierre en prosa.
 *
 * Uso:
 *   node produce-article.mjs --hub=tickets-booking-system --pillar
 *   node produce-article.mjs --hub=tickets-booking-system --supporting=1
 *   node produce-article.mjs --list
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DB_PATH = './colosseum-corpus.db';
const ARCHITECTURE_PATH = './architecture.json';
const OUTPUT_DIR = './articles';
const MODEL = 'claude-opus-4-7';

// Mapping hub_id → categoría Sanity
const HUB_TO_CATEGORY = {
  'tickets-booking-system': 'colosseum-tickets-booking',
  'ticket-tiers-comparison': 'colosseum-ticket-tiers',
  'premium-experiences': 'colosseum-premium-tours',
  'combo-tours': 'colosseum-combo-tours',
  'guides-quality': 'colosseum-tour-guides',
  'operator-selection': 'colosseum-tour-operators',
  'on-site-logistics': 'colosseum-onsite-logistics',
  'timing-crowds': 'colosseum-best-time-to-visit',
  'physical-comfort': 'colosseum-survival-guide',
};

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌ Falta ANTHROPIC_API_KEY en .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
const hubArg = args.find(a => a.startsWith('--hub='))?.split('=')[1];
const isPillar = args.includes('--pillar');
const supportingArg = args.find(a => a.startsWith('--supporting='))?.split('=')[1];
const isList = args.includes('--list');

if (!existsSync(ARCHITECTURE_PATH)) {
  console.error(`❌ No encontré ${ARCHITECTURE_PATH}. Corré primero design-hub-architecture.mjs`);
  process.exit(1);
}

const architecture = JSON.parse(readFileSync(ARCHITECTURE_PATH, 'utf8'));

// LIST mode
if (isList) {
  console.log('━'.repeat(70));
  console.log('📋 ARTÍCULOS DISPONIBLES PARA PRODUCIR');
  console.log('━'.repeat(70));
  architecture.hubs.forEach(hub => {
    const cat = HUB_TO_CATEGORY[hub.id] || '?';
    console.log('');
    console.log(`HUB: ${hub.id} — ${hub.name}`);
    console.log(`   Categoría Sanity: ${cat} (priority ${hub.priority_score})`);
    console.log(`   PILLAR: ${hub.pillar.title}`);
    console.log(`     → node produce-article.mjs --hub=${hub.id} --pillar`);
    (hub.supporting_articles || []).forEach((art, i) => {
      console.log(`   SUPPORTING ${i + 1}: ${art.title}`);
      console.log(`     → node produce-article.mjs --hub=${hub.id} --supporting=${i + 1}`);
    });
  });
  process.exit(0);
}

if (!hubArg) {
  console.error('❌ Falta --hub=<hub-slug>. Usá --list para ver todos.');
  process.exit(1);
}
if (!isPillar && !supportingArg) {
  console.error('❌ Indicá --pillar o --supporting=N');
  process.exit(1);
}

const hub = architecture.hubs.find(h => h.id === hubArg);
if (!hub) {
  console.error(`❌ Hub no encontrado: ${hubArg}`);
  process.exit(1);
}

const article = isPillar
  ? hub.pillar
  : hub.supporting_articles[parseInt(supportingArg) - 1];
if (!article) {
  console.error(`❌ Artículo no encontrado en hub ${hubArg}`);
  process.exit(1);
}

const categorySlug = HUB_TO_CATEGORY[hub.id] || 'unknown-category';

console.log('━'.repeat(70));
console.log('📝 PRODUCCIÓN DE DOCUMENTO DE TRABAJO');
console.log('━'.repeat(70));
console.log(`Hub:               ${hub.name}`);
console.log(`Categoría Sanity:  ${categorySlug}`);
console.log(`Tipo:              ${isPillar ? 'PILLAR' : 'SUPPORTING'}`);
console.log(`Título:            ${article.title}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// 1. EXTRAER KEYWORDS
// ═══════════════════════════════════════════════════════════════════
function extractKeywords(article, hub) {
  const text = [
    article.title,
    article.covers_gap_or_cluster || '',
    article.rationale || '',
    hub.description,
    hub.clusters_included?.join(' ') || '',
  ].join(' ').toLowerCase();

  const domainKeywords = [
    'colosseum', 'underground', 'arena', 'forum', 'palatine', 'vatican',
    'skip the line', 'skip-the-line', 'guide', 'tour', 'ticket',
    'booking', 'official', 'price', 'scam', 'reseller', 'meeting',
    'audio', 'headset', 'app', 'crowd', 'heat', 'shade', 'water',
    'night', 'sunset', 'combo', 'private', 'group', 'family',
    'kids', 'accessibility', 'voucher', 're-entry', 'photography',
    'getyourguide', 'viator', 'walks of italy', 'crown tours',
    'roman guy', 'belvedere',
  ];
  return domainKeywords.filter(kw => text.includes(kw));
}

const keywords = extractKeywords(article, hub);
console.log(`🔑 Keywords detectados: ${keywords.join(', ')}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// 2. CONSULTAR EVIDENCIA EN CORPUS
// ═══════════════════════════════════════════════════════════════════
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const cols = db.prepare(`PRAGMA table_info(corpus_items)`).all().map(c => c.name);

function buildSearchConditions(keywords) {
  if (keywords.length === 0) return { where: '1=1', params: [] };
  const conditions = [];
  const params = [];
  for (const kw of keywords) {
    const fields = ['text'];
    if (cols.includes('topic_tags')) fields.push('topic_tags');
    if (cols.includes('pain_points')) fields.push('pain_points');
    if (cols.includes('claims')) fields.push('claims');
    if (cols.includes('questions_raised')) fields.push('questions_raised');
    const subConds = fields.map(f => `${f} LIKE ?`).join(' OR ');
    conditions.push(`(${subConds})`);
    fields.forEach(() => params.push(`%${kw}%`));
  }
  return { where: conditions.join(' OR '), params };
}

const { where, params } = buildSearchConditions(keywords);

// Reviews por fuente
const reviewsBySource = {};
const sources = ['gyg', 'youtube', 'tripadvisor', 'googlemaps', 'trustpilot'];
for (const src of sources) {
  const rows = db.prepare(`
    SELECT id, source, source_url, text, rating, country, language,
           ${cols.includes('topic_tags') ? 'topic_tags,' : ''}
           ${cols.includes('pain_points') ? 'pain_points,' : ''}
           ${cols.includes('claims') ? 'claims,' : ''}
           ${cols.includes('questions_raised') ? 'questions_raised,' : ''}
           published_date, text_length
    FROM corpus_items
    WHERE source = ? AND (${where})
      AND text_length BETWEEN 80 AND 1500
    ORDER BY text_length DESC
    LIMIT 25
  `).all(src, ...params);
  if (rows.length > 0) reviewsBySource[src] = rows;
}

const totalReviews = Object.values(reviewsBySource).reduce((acc, arr) => acc + arr.length, 0);
console.log(`📚 Evidencia recolectada por fuente:`);
sources.forEach(s => {
  if (reviewsBySource[s]) {
    console.log(`   ${s.padEnd(12)}: ${reviewsBySource[s].length} reviews`);
  }
});
console.log(`   Total: ${totalReviews}`);
console.log('');

if (totalReviews < 5) {
  console.error(`❌ Muy poca evidencia (${totalReviews}). Ajustá keywords o cluster.`);
  db.close();
  process.exit(1);
}

// Pain points / claims / questions únicos
function uniqueExtract(field, limit = 30) {
  if (!cols.includes(field)) return [];
  const rows = db.prepare(`
    SELECT ${field} FROM corpus_items
    WHERE ${field} IS NOT NULL AND ${field} != '' AND ${field} != '[]'
      AND (${where})
  `).all(...params);
  const all = new Set();
  for (const row of rows) {
    try {
      const arr = JSON.parse(row[field]);
      if (Array.isArray(arr)) arr.forEach(v => v && all.add(String(v).trim()));
    } catch {}
  }
  return Array.from(all).slice(0, limit);
}

const painPoints = uniqueExtract('pain_points', 30);
const claims = uniqueExtract('claims', 30);
const questions = uniqueExtract('questions_raised', 30);

console.log(`📊 Insights:`);
console.log(`   Pain points únicos: ${painPoints.length}`);
console.log(`   Claims únicos:      ${claims.length}`);
console.log(`   Questions únicas:   ${questions.length}`);
console.log('');

// Stats globales corpus
const corpusStats = db.prepare(`SELECT * FROM v_stats_by_source`).all();
const totalCorpus = db.prepare(`SELECT COUNT(*) as n FROM corpus_items`).get().n;
const enrichedCount = db.prepare(`
  SELECT COUNT(*) as n FROM corpus_items
  WHERE topic_tags IS NOT NULL AND topic_tags != ''
`).get().n;
const dateRange = db.prepare(`
  SELECT MIN(published_date) as min_d, MAX(published_date) as max_d
  FROM corpus_items
  WHERE published_date IS NOT NULL
`).get();
const langStats = db.prepare(`
  SELECT language, COUNT(*) as n FROM corpus_items
  WHERE language IS NOT NULL AND (${where})
  GROUP BY language ORDER BY n DESC LIMIT 10
`).all(...params);
const countryStats = db.prepare(`
  SELECT country, COUNT(*) as n FROM corpus_items
  WHERE country IS NOT NULL AND country != 'unknown' AND (${where})
  GROUP BY country ORDER BY n DESC LIMIT 10
`).all(...params);

// ═══════════════════════════════════════════════════════════════════
// 3. ARMAR MEMO PARA OPUS
// ═══════════════════════════════════════════════════════════════════
function buildEvidenceMemo() {
  const lines = [];

  lines.push('# ARTICLE BRIEF');
  lines.push(`Site: colosseumroman.com`);
  lines.push(`Hub: ${hub.name}`);
  lines.push(`Sanity Category: ${categorySlug}`);
  lines.push(`Article type: ${isPillar ? 'PILLAR (central reference of hub)' : 'SUPPORTING (deep-dive)'}`);
  lines.push(`Title: ${article.title}`);
  lines.push(`Category: ${article.category}`);
  if (article.intent) lines.push(`Intent: ${article.intent}`);
  lines.push(`Covers: ${article.covers_gap_or_cluster || article.covers_clusters?.join(', ') || ''}`);
  lines.push(`Rationale: ${article.rationale || hub.rationale}`);
  lines.push('');

  lines.push('# HUB CONTEXT');
  lines.push(hub.description);
  lines.push('');
  lines.push('Clusters covered:');
  (hub.clusters_included || []).forEach(c => lines.push(`- ${c}`));
  lines.push('');

  if (painPoints.length > 0) {
    lines.push('# PAIN POINTS DETECTED IN CORPUS');
    painPoints.slice(0, 25).forEach(pp => lines.push(`- ${pp}`));
    lines.push('');
  }

  if (claims.length > 0) {
    lines.push('# VERIFIABLE CLAIMS FROM CORPUS (use as fact basis — DO NOT INVENT)');
    claims.slice(0, 25).forEach(cl => lines.push(`- ${cl}`));
    lines.push('');
  }

  if (questions.length > 0) {
    lines.push('# QUESTIONS RAISED BY USERS (article must address)');
    questions.slice(0, 25).forEach(q => lines.push(`- ${q}`));
    lines.push('');
  }

  lines.push('# RAW REVIEW EXCERPTS (build CITAS PRE-ARMADAS from these)');
  lines.push('');
  for (const src of sources) {
    const rows = reviewsBySource[src];
    if (!rows || rows.length === 0) continue;
    lines.push(`## Source: ${src.toUpperCase()}`);
    rows.slice(0, 10).forEach(r => {
      const rating = r.rating ? `${r.rating}stars` : 'N/A';
      const country = r.country && r.country !== 'unknown' ? `, ${r.country}` : '';
      const date = r.published_date || 'unknown';
      const text = r.text.replace(/\s+/g, ' ').trim().slice(0, 500);
      lines.push(`### [REVIEW-${src}-${r.id}] ${rating}${country} (${date})`);
      lines.push(`URL: ${r.source_url || '(no url)'}`);
      lines.push(`TEXT: "${text}${r.text.length > 500 ? '...' : ''}"`);
      lines.push('');
    });
  }
  return lines.join('\n');
}

const evidenceMemo = buildEvidenceMemo();
console.log(`📝 Memo evidencia: ${evidenceMemo.length} chars (~${Math.round(evidenceMemo.length / 4)} tokens)`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// 4. PROMPT
// ═══════════════════════════════════════════════════════════════════
const prompt = `You are a senior content strategist producing a PRODUCTION BRIEF for an editorial team that will write the final article in Sanity.

You are NOT writing a finished article. You are producing a structured working document that will be handed off to redaction. The document must contain everything needed: intent, thesis, hard data (untouchable), trade-offs, structure, narrative draft, pre-built quotes, and a robust methodology block.

CORE RULES:

1. EVIDENCE-ONLY. Every fact, number, claim, quote MUST come from the evidence brief below. Do NOT invent prices, names, or stats. If you don't have evidence for something, omit it. NO speculation.

2. TRADE-OFFS ARE THE MOST IMPORTANT COMPONENT. Each section MUST have an explicit cost/benefit pair. "Pay X to get Y" or "X is better but only if Z". Avoid soft narrative like "it depends" or "consider your needs". Be sharp and data-backed. Trade-offs MUST appear AS A VISUAL BLOCK inside the narrative of every H2 (see structure below — do not skip this).

3. QUOTES MUST BE EXACT. Copy review text verbatim from the brief. Cite source like: REVIEW-trustpilot-12345 (Trustpilot, 1 star, June 2025). Quotes UNDER 30 words. If a review is multilingual, quote original + English translation.

4. ATTRIBUTION DISCIPLINE. Only attribute country/nationality if the country field is present in the review metadata. NO generic "Australian visitor" if country is unknown.

5. FILL ALL 7 COMPONENTS. Every section in the OUTPUT FORMAT below is mandatory. Do not skip TRADE-OFFS or HARD DATA — those are the spine of the document.

6. CATEGORÍA SANITY: Always include "${categorySlug}" in the SEO META block.

7. TRADE-OFF VISUAL BLOCK INSIDE EACH H2 OF THE NARRATIVE. After developing each H2 of the NARRATIVA / DRAFT, you MUST close the section with a clearly demarcated trade-off block in this exact format:

[TRADE-OFF]
PAGÁS: [the cost/sacrifice in concrete terms]
TE LLEVÁS: [the benefit/value gained in concrete terms]
[/TRADE-OFF]

This block must be visually separable from the prose so the editorial team can render it as a callout/highlighted component in Sanity. Every H2 in the draft gets ONE trade-off block. Pillars typically have 5-8 trade-off blocks total. This is non-negotiable.

OUTPUT FORMAT — return EXACTLY this structure as plain text (NO code fences, NO markdown wrapper):

═══════════════════════════════════════
ARTÍCULO: ${article.title}
HUB: ${hub.name}
CATEGORÍA SANITY: ${categorySlug}
TIPO: ${isPillar ? 'PILLAR' : 'SUPPORTING'}
═══════════════════════════════════════

▌INTENCIÓN
[1 paragraph: what question this article answers, who it targets, why it matters now]

▌TESIS PRINCIPAL [INTOCABLE]
[1-2 sentences: standalone-citable claim with hard data inside. Must be copy-pasteable by an AI engine]

▌HARD DATA — NÚMEROS QUE SÍ O SÍ VAN [INTOCABLE]
- [Metric 1: X% based on N verified reviews / source]
- [Metric 2: $X vs $Y based on Z]
- [Metric 3: ...]
[Minimum 4-6 hard data points. All from corpus.]

▌TRADE-OFFS DETECTADOS [COMPONENTE CRÍTICO]
1. PAGÁS: [cost/sacrifice] — TE LLEVÁS: [benefit]
2. PAGÁS: [...] — TE LLEVÁS: [...]
3. ...
[Minimum 3 trade-offs. Concrete pairs, no soft language. These will be remarked again inside each H2 of the narrative below.]

▌ESTRUCTURA SUGERIDA (H2)
H2.1: [Citable title]
   ↳ Hard data clave: [data points used in this section]
   ↳ Cita sugerida: CITA #N
   ↳ Trade-off destacado: [the trade-off this section makes explicit]

H2.2: [...]
[As many H2 as the content requires. Don't force quantity. ${isPillar ? 'Pillar typically 5-8 H2.' : 'Supporting typically 3-5 H2.'}]

▌NARRATIVA / DRAFT

[Opening paragraph — hook, the one-line summary that establishes the thesis. NO trade-off block here, this is the lede.]

H2.1: [H2 Title]

[Prose body of H2.1. Embed [CITA #N] inline references where quotes go. Cite hard data points. Be honest, transparent, no shilling.]

[TRADE-OFF]
PAGÁS: [concrete cost/sacrifice for this section's topic]
TE LLEVÁS: [concrete benefit/value for this section's topic]
[/TRADE-OFF]

H2.2: [H2 Title]

[Prose body of H2.2. Same rules.]

[TRADE-OFF]
PAGÁS: [...]
TE LLEVÁS: [...]
[/TRADE-OFF]

[Continue for every H2. Every H2 closes with [TRADE-OFF]...[/TRADE-OFF] block. ${isPillar ? '2,000-3,000 words total.' : '1,200-1,800 words total.'}]

▌CITAS PRE-ARMADAS [PARA INTERCALAR EN EL TEXTO]

CITA #1
TEXTO: "[exact verbatim text from review, under 30 words]"
FUENTE: [Platform + rating + country if known + date]
URL: [review source url]
USE CASE: [what data point or insight this quote illustrates]
POSICIÓN SUGERIDA: [in which H2 this should appear and why]

CITA #2
[same structure]

[Generate 4-8 quotes. Diversify source platforms. Include critical quotes when available.]

▌EXPERIENCIA / FRICCIONES TÍPICAS
- [Pain point exact quote/paraphrase] — mentioned in N reviews
- [...] — appears in M% of cases
[6-10 friction points. Specific. Avoid generalities.]

▌AUTORIDAD / METHODOLOGY [BLOQUE DE EVIDENCIA CIENTÍFICA]

═════════════════════════════════════════
RESEARCH BY: Intercoper Curator Team
DATA COLLECTION DATE: ${new Date().toISOString().split('T')[0]}
═════════════════════════════════════════

▶ DATASET
Total verified items in corpus: ${totalCorpus.toLocaleString()}
Items relevant to this article: ${totalReviews}
Period covered: ${dateRange.min_d || 'N/A'} — ${dateRange.max_d || 'N/A'}
Languages represented: ${langStats.slice(0, 6).map(l => l.language).join(', ')}
Countries represented (top 10): ${countryStats.slice(0, 10).map(c => c.country).join(', ')}

▶ SOURCES (5 platforms)
${corpusStats.map(s => `- ${s.source}: ${s.total_items} items (avg rating ${s.avg_rating ? s.avg_rating.toFixed(2) : 'N/A'})`).join('\n')}

▶ VARIABLES TRACKED (14)
Pain points, verifiable claims, questions raised, topic tags, sentiment polarity, review consistency, operator mentions, named guide mentions, group size signals, pricing references, logistics friction, premium tier exposure, accessibility signals, language and country normalization

▶ AI-ASSISTED ENRICHMENT
- Topic + sentiment + claims extraction: Claude Sonnet 4.6
- Strategic clustering + article structure: Claude Opus 4.7
- Enrichment success rate: ${((enrichedCount / totalCorpus) * 100).toFixed(1)}% (${enrichedCount}/${totalCorpus} items)

▶ ANOMALY DETECTION LAYERS APPLIED
- Duplicate listing detection (URL normalization + content fingerprinting)
- Suspicious review spike detection (cadence-based flagging)
- Pricing outlier detection (50% single-day movement threshold)
- Cross-platform consistency checks (contradictions surfaced, not silently reconciled)

▶ FILTERS APPLIED FOR THIS ARTICLE
- Keywords queried: ${keywords.join(', ')}
- Hub source: ${hub.id}
- Items matched: ${totalReviews}

▶ EVIDENCE TRAIL FOR THIS PIECE
- Pain points referenced: ${painPoints.length} unique items
- Verifiable claims used: ${claims.length} unique items
- User questions addressed: ${questions.length} unique items
- Reviews quoted in article: [TO BE FILLED — count of CITAs above]

▶ LIMITATIONS
- GetYourGuide sample is positively biased (post-purchase satisfaction effect)
- TripAdvisor critical sample weighted toward 1-3 star reviews (intentional filter applied at scrape)
- Pricing claims subject to operator changes; verify at booking
[+ 1-2 article-specific limitations YOU detect from the evidence]

▶ FULL METHODOLOGY
Complete corpus + analysis methodology published at colosseumroman.com/methodology

═════════════════════════════════════════

▌SEO META (sugerencias para redacción)

SEO Title (≤60 chars): [...]
Meta Description (≤160 chars): [...]
SEO Keywords (5-7): [...]
Slug sugerido: [...]
H1 sugerido: ${article.title}
Categoría Sanity (asignar): ${categorySlug}

═══════════════════════════════════════
FIN DEL DOCUMENTO DE TRABAJO
═══════════════════════════════════════

EVIDENCE BRIEF:

${evidenceMemo}`;

// ═══════════════════════════════════════════════════════════════════
// 5. LLAMADA A OPUS
// ═══════════════════════════════════════════════════════════════════
const client = new Anthropic({ apiKey });

console.log(`🤖 Enviando a ${MODEL}...`);
const start = Date.now();

let response;
try {
  response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }]
  });
} catch (err) {
  console.error('❌ Error en API:', err.message);
  db.close();
  process.exit(1);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const inputTokens = response.usage.input_tokens;
const outputTokens = response.usage.output_tokens;
const cost = (inputTokens * 5 / 1e6) + (outputTokens * 25 / 1e6);

console.log(`✅ Recibido en ${elapsed}s | $${cost.toFixed(3)} | tokens: ${inputTokens} in / ${outputTokens} out`);
console.log('');

let rawOutput = response.content[0].text;
// Limpiar code fences si Opus puso alguno
rawOutput = rawOutput.replace(/^```(?:markdown|md|text)?\s*\n/, '').replace(/\n```\s*$/, '').trim();

// ═══════════════════════════════════════════════════════════════════
// 6. GUARDAR
// ═══════════════════════════════════════════════════════════════════
function slugify(s) {
  return s.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

const articleSlug = slugify(article.title);
const hubDir = join(OUTPUT_DIR, hub.id);
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);
if (!existsSync(hubDir)) mkdirSync(hubDir);

const articlePath = join(hubDir, `${articleSlug}.md`);
const evidencePath = join(hubDir, `${articleSlug}-evidence.json`);

writeFileSync(articlePath, rawOutput, 'utf8');
writeFileSync(evidencePath, JSON.stringify({
  generated_at: new Date().toISOString(),
  hub: { id: hub.id, name: hub.name, sanity_category: categorySlug },
  article: {
    title: article.title,
    type: isPillar ? 'pillar' : 'supporting',
    category: article.category,
  },
  keywords_used: keywords,
  evidence_stats: {
    total_reviews: totalReviews,
    by_source: Object.fromEntries(
      Object.entries(reviewsBySource).map(([k, v]) => [k, v.length])
    ),
    pain_points: painPoints.length,
    claims: claims.length,
    questions: questions.length,
  },
  generation: {
    model: MODEL,
    cost_usd: parseFloat(cost.toFixed(4)),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_seconds: parseFloat(elapsed),
  },
  reviews_pool: Object.fromEntries(
    Object.entries(reviewsBySource).map(([src, arr]) => [
      src,
      arr.slice(0, 10).map(r => ({
        id: r.id,
        rating: r.rating,
        country: r.country,
        date: r.published_date,
        url: r.source_url,
        excerpt: r.text.slice(0, 250),
      }))
    ])
  ),
}, null, 2), 'utf8');

db.close();

console.log('━'.repeat(70));
console.log('✅ DOCUMENTO DE TRABAJO PRODUCIDO');
console.log('━'.repeat(70));
console.log(`Costo:     $${cost.toFixed(3)}`);
console.log(`Output:`);
console.log(`  ${articlePath}`);
console.log(`  ${evidencePath}`);
console.log('');
console.log('Próximos pasos:');
console.log('  1. Abrí el .md y revisá los 7 componentes');
console.log('  2. Si está OK, pasalo a redacción para armado en Sanity');
console.log(`  3. Asignar categoría Sanity: "${categorySlug}"`);