#!/usr/bin/env node
/**
 * design-hub-architecture.mjs
 *
 * FASE 3 — DISEÑO DE ARQUITECTURA DE HUBS JERÁRQUICA (data-driven)
 *
 * Toma los insights de la tabla `insights` (patterns, gaps, contradictions)
 * + el reporte ./insights-report.md (que contiene los 45 articles propuestos)
 * y le pide a Opus que arme la arquitectura jerárquica del sitio:
 *
 *   - Cantidad de hubs (NO fijo, lo decide la data)
 *   - Pillar article por hub
 *   - Supporting articles por hub (cantidad determinada por gaps + questions)
 *   - Cross-hub linking sugerido
 *   - Score de prioridad por hub (orden de producción)
 *
 * Output:
 *   - architecture.json     (estructura jerárquica completa)
 *   - architecture-report.md (versión legible)
 *
 * Uso:
 *   node design-hub-architecture.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const DB_PATH = './colosseum-corpus.db';
const MODEL = 'claude-opus-4-7';
const TOPIC_KEY_PREFIX = ''; // sin filtro, agarramos todo lo de colosseum
const REPORT_PATH = './insights-report.md';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌ Falta ANTHROPIC_API_KEY en .env.local');
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const db = new Database(DB_PATH);

console.log('━'.repeat(70));
console.log('🏗️  FASE 3 — DISEÑO DE ARQUITECTURA DE HUBS');
console.log('━'.repeat(70));

// ═══════════════════════════════════════════════════════════════════
// 1. CARGAR INSIGHTS — schema real (insight_type, topic_key, title, ...)
// ═══════════════════════════════════════════════════════════════════
const patterns = db.prepare(`
  SELECT * FROM insights
  WHERE insight_type = 'pattern'
  ORDER BY id
`).all();

const gaps = db.prepare(`
  SELECT * FROM insights
  WHERE insight_type = 'gap'
  ORDER BY id
`).all();

const contradictions = db.prepare(`
  SELECT * FROM insights
  WHERE insight_type = 'contradiction'
  ORDER BY id
`).all();

const painPoints = db.prepare(`
  SELECT * FROM insights
  WHERE insight_type = 'pain_point'
  ORDER BY id
`).all();

console.log(`📊 Insights cargados:`);
console.log(`   Patterns (clusters): ${patterns.length}`);
console.log(`   Gaps:                ${gaps.length}`);
console.log(`   Contradictions:      ${contradictions.length}`);
console.log(`   Pain points:         ${painPoints.length}`);
console.log('');

if (patterns.length === 0) {
  console.error('❌ No hay patterns en la DB. Corré primero cluster-and-hypothesize.mjs');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════
// 2. EXTRAER LOS 45 ARTÍCULOS DEL insights-report.md
// ═══════════════════════════════════════════════════════════════════
let articlesFromReport = [];
if (existsSync(REPORT_PATH)) {
  const reportContent = readFileSync(REPORT_PATH, 'utf8');
  // Buscar la tabla de artículos: líneas tipo "| 1 | Title | category | high |"
  const tableLines = reportContent.split('\n').filter(line =>
    /^\|\s*\d+\s*\|/.test(line)
  );
  articlesFromReport = tableLines.map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      return {
        n: cells[0],
        title: cells[1],
        category: cells[2],
        score: cells[3]
      };
    }
    return null;
  }).filter(Boolean);
}
console.log(`📋 Artículos extraídos del report: ${articlesFromReport.length}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// 3. ARMAR MEMO PARA OPUS
// ═══════════════════════════════════════════════════════════════════
function buildMemo() {
  const lines = [];

  lines.push('# CONTEXTO');
  lines.push('Site: colosseumroman.com');
  lines.push('Goal: Topic-authority hub architecture for SEO/GEO based on real corpus data.');
  lines.push('');

  lines.push(`# ${patterns.length} THEMATIC CLUSTERS (patterns)`);
  lines.push('');
  patterns.forEach((p, i) => {
    let sources = '';
    try {
      const arr = JSON.parse(p.sources_json || '[]');
      sources = arr.join(', ');
    } catch {}
    lines.push(`## ${i + 1}. ${p.title} _(signal: ${p.article_potential || 'unknown'}, evidence: ${p.evidence_count || 0})_`);
    lines.push(`Slug: ${p.topic_key}`);
    lines.push(p.description || '');
    if (sources) lines.push(`Sources: ${sources}`);
    lines.push('');
  });

  lines.push('# CONTENT GAPS');
  lines.push('');
  gaps.forEach((g, i) => {
    lines.push(`- (${g.article_potential || 'medium'}, evidence: ${g.evidence_count || 0}) ${g.title}`);
    if (g.description) lines.push(`  ${g.description}`);
  });
  lines.push('');

  lines.push('# CONTRADICTIONS BETWEEN SOURCES');
  lines.push('');
  contradictions.forEach((c, i) => {
    lines.push(`- ${c.title}`);
    if (c.description) lines.push(`  ${c.description}`);
  });
  lines.push('');

  if (articlesFromReport.length > 0) {
    lines.push(`# 45 HYPOTHESIZED ARTICLES (starting point — feel free to merge/discard/add)`);
    lines.push('');
    articlesFromReport.forEach(a => {
      lines.push(`${a.n}. [${a.category} / ${a.score}] ${a.title}`);
    });
  }

  return lines.join('\n');
}

const memo = buildMemo();
console.log(`📝 Memo construido: ${memo.length} chars (~${Math.round(memo.length / 4)} tokens)`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// 4. PROMPT
// ═══════════════════════════════════════════════════════════════════
const prompt = `You are a senior content architect designing a topic-authority website on Colosseum tours and tickets at colosseumroman.com.

You will receive a strategic analysis of a 12,000+ item corpus including:
- Thematic clusters (patterns) with signal strength
- Content gaps with evidence counts
- Contradictions between source platforms (GYG vs YouTube)
- 45 hypothesized articles with categories and scores (starting point only)

Your task: design the OPTIMAL hub architecture for this site, DATA-DRIVEN.

CRITICAL RULES:
1. The number of hubs is NOT predefined. Let cluster affinity determine it. Could be 5, 8, 12, 15. The data decides.
2. Hubs should group clusters that share TOPIC + USER INTENT, not just keyword overlap.
3. Some clusters may merge (if user intent overlaps). Some clusters may split (if too broad).
4. Each hub MUST have:
   - A clear pillar article (the central reference)
   - N supporting articles (N determined by gaps and unique questions in the cluster, NOT a fixed number)
5. Calculate priority score for each hub (1-100) based on:
   - Sum of cluster signals (high=3, medium=2, low=1)
   - Number of high-evidence gaps in the hub
   - SEO opportunity (commercial vs informational intent)
6. Suggest internal linking BETWEEN hubs for clusters that overlap.

OUTPUT FORMAT:
Return ONLY a valid JSON object with this exact structure:

{
  "rationale": "2-3 sentences on how you grouped clusters into hubs",
  "total_hubs": <number>,
  "total_articles": <number, sum of pillars + supportings>,
  "hubs": [
    {
      "id": "hub-slug-here",
      "name": "Hub Name in English",
      "description": "1-2 sentence hub description",
      "priority_score": 95,
      "rationale": "Why these clusters belong together",
      "clusters_included": ["Cluster Name 1", "Cluster Name 2"],
      "pillar": {
        "title": "Pillar article title",
        "category": "guide|comparison|warning|informational|review-aggregation",
        "covers_clusters": ["Cluster Name 1"],
        "rationale": "Why this is the pillar"
      },
      "supporting_articles": [
        {
          "title": "Supporting article title",
          "category": "guide|comparison|warning|informational|review-aggregation",
          "covers_gap_or_cluster": "Specific gap or cluster question this answers",
          "intent": "informational|commercial|navigational|transactional"
        }
      ],
      "cross_hub_links": [
        {
          "to_hub": "other-hub-id",
          "reason": "Why these hubs should link bidirectionally"
        }
      ]
    }
  ],
  "orphan_articles": [
    {
      "title": "Article that doesn't fit any hub clearly",
      "reason": "Why it's orphan"
    }
  ],
  "production_order": ["hub-id-1", "hub-id-2", "..."],
  "production_rationale": "How to order hub production for max SEO impact"
}

The 45 hypothesized articles are STARTING POINT but you can:
- Discard ones that don't fit the architecture
- Merge similar ones
- Propose NEW articles if clusters/gaps reveal needs not yet captured

Quality over quantity. Each hub must have clear topical authority. Don't force articles into hubs.

ANALYSIS DATA:
${memo}`;

// ═══════════════════════════════════════════════════════════════════
// 5. LLAMADA A OPUS
// ═══════════════════════════════════════════════════════════════════
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
  process.exit(1);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const inputTokens = response.usage.input_tokens;
const outputTokens = response.usage.output_tokens;
// Pricing aprox Opus 4.5: $15/M input, $75/M output
const cost = (inputTokens * 5 / 1e6) + (outputTokens * 25 / 1e6);

console.log(`✅ Recibido en ${elapsed}s | $${cost.toFixed(3)} | tokens: ${inputTokens} in / ${outputTokens} out`);
console.log('');

const rawText = response.content[0].text;

// ═══════════════════════════════════════════════════════════════════
// 6. PARSEAR JSON
// ═══════════════════════════════════════════════════════════════════
let architecture;
try {
  architecture = JSON.parse(rawText);
} catch {
  const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      architecture = JSON.parse(match[1].trim());
    } catch (err) {
      console.error('❌ JSON dentro de code block inválido:', err.message);
      writeFileSync('./architecture-raw-output.txt', rawText);
      console.error('   Output crudo guardado en architecture-raw-output.txt');
      process.exit(1);
    }
  } else {
    console.error('❌ No se encontró JSON parseable en la respuesta');
    writeFileSync('./architecture-raw-output.txt', rawText);
    console.error('   Output crudo guardado en architecture-raw-output.txt');
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 7. GUARDAR JSON Y REPORTE LEGIBLE
// ═══════════════════════════════════════════════════════════════════
writeFileSync('./architecture.json', JSON.stringify(architecture, null, 2));
console.log(`💾 architecture.json guardado`);

const report = [];
report.push(`# 🏗️ Hub Architecture Design — Colosseum`);
report.push('');
report.push(`Generated: ${new Date().toISOString()}`);
report.push(`Model: ${MODEL}`);
report.push(`Cost: $${cost.toFixed(3)}`);
report.push('');
report.push('---');
report.push('');
report.push(`## Rationale`);
report.push('');
report.push(architecture.rationale || '(no rationale)');
report.push('');
report.push(`## Stats`);
report.push('');
report.push(`- **Total hubs:** ${architecture.total_hubs}`);
report.push(`- **Total articles:** ${architecture.total_articles}`);
report.push(`- **Orphan articles:** ${architecture.orphan_articles?.length || 0}`);
report.push('');
report.push(`## Production Order`);
report.push('');
(architecture.production_order || []).forEach((id, i) => {
  report.push(`${i + 1}. ${id}`);
});
report.push('');
report.push(`**Rationale:** ${architecture.production_rationale || ''}`);
report.push('');
report.push('---');
report.push('');
report.push(`## Hubs`);
report.push('');

(architecture.hubs || []).forEach((hub, i) => {
  report.push(`### ${i + 1}. ${hub.name} _(score: ${hub.priority_score})_`);
  report.push('');
  report.push(`**ID:** \`${hub.id}\``);
  report.push('');
  report.push(`**Description:** ${hub.description}`);
  report.push('');
  report.push(`**Rationale:** ${hub.rationale}`);
  report.push('');
  report.push(`**Clusters included:**`);
  (hub.clusters_included || []).forEach(c => report.push(`- ${c}`));
  report.push('');
  report.push(`#### 🏛️ Pillar Article`);
  report.push(`- **Title:** ${hub.pillar?.title || '?'}`);
  report.push(`- **Category:** ${hub.pillar?.category || '?'}`);
  report.push(`- **Rationale:** ${hub.pillar?.rationale || ''}`);
  report.push('');
  report.push(`#### 📄 Supporting Articles (${hub.supporting_articles?.length || 0})`);
  report.push('');
  (hub.supporting_articles || []).forEach((art, j) => {
    report.push(`${j + 1}. **${art.title}** _(${art.category} / ${art.intent})_`);
    if (art.covers_gap_or_cluster) {
      report.push(`   - Covers: ${art.covers_gap_or_cluster}`);
    }
  });
  report.push('');
  if (hub.cross_hub_links?.length) {
    report.push(`#### 🔗 Cross-Hub Links`);
    hub.cross_hub_links.forEach(link => {
      report.push(`- → \`${link.to_hub}\`: ${link.reason}`);
    });
    report.push('');
  }
  report.push('---');
  report.push('');
});

if (architecture.orphan_articles?.length) {
  report.push(`## Orphan Articles`);
  report.push('');
  architecture.orphan_articles.forEach(a => {
    report.push(`- **${a.title}**`);
    report.push(`  - ${a.reason}`);
  });
}

writeFileSync('./architecture-report.md', report.join('\n'));
console.log(`📄 architecture-report.md guardado`);

db.close();

console.log('');
console.log('━'.repeat(70));
console.log('✅ FASE 3 TERMINADA');
console.log('━'.repeat(70));
console.log(`Costo:               $${cost.toFixed(3)}`);
console.log(`Total hubs:          ${architecture.total_hubs}`);
console.log(`Total articles:      ${architecture.total_articles}`);
console.log(`Orphan articles:     ${architecture.orphan_articles?.length || 0}`);
console.log('');
console.log('Output:');
console.log('  - ./architecture.json');
console.log('  - ./architecture-report.md');