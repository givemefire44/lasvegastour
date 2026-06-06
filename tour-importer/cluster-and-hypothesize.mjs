#!/usr/bin/env node
/**
 * cluster-and-hypothesize-v2.mjs
 *
 * FASE 2 — Análisis estratégico (versión partida en 2 llamadas para evitar
 * truncamiento de JSON en respuestas largas).
 *
 * Llamada 1: clusters + contradictions + gaps + executive_summary
 * Llamada 2: article_hypotheses (la parte más larga)
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'fs';

const DB_PATH = './colosseum-corpus.db';
const MODEL = 'claude-opus-4-7';
const REPORT_PATH = './insights-report.md';
const MAX_TOKENS = 16000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Falta ANTHROPIC_API_KEY en .env.local');
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('━'.repeat(70));
console.log(`🧠 FASE 2 v2 — CLUSTERING + HIPÓTESIS (${MODEL})`);
console.log('━'.repeat(70));

// ═══════════════════════════════════════════════════════════════════
// PASO 1 — Recolectar datos
// ═══════════════════════════════════════════════════════════════════
const items = db.prepare(`
  SELECT id, source, type, sentiment, topic_tags, pain_points, claims, questions_raised
  FROM corpus_items
  WHERE related_topic = 'colosseum'
    AND enrichment_version = 'v1'
    AND topic_tags IS NOT NULL
    AND topic_tags NOT LIKE '%off-topic%'
`).all();

console.log(`📦 Items relevantes: ${items.length}`);

const tagCounts = {};
const tagItemsMap = {};
let totalPainPoints = 0, totalClaims = 0, totalQuestions = 0;
const sourceBySentiment = { gyg: { pos: 0, neg: 0, neu: 0, mixed: 0 }, youtube: { pos: 0, neg: 0, neu: 0, mixed: 0 } };

for (const item of items) {
  if (sourceBySentiment[item.source] && item.sentiment) {
    sourceBySentiment[item.source][item.sentiment] = (sourceBySentiment[item.source][item.sentiment] || 0) + 1;
  }
  try {
    const tags = JSON.parse(item.topic_tags || '[]');
    for (const t of tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
      if (!tagItemsMap[t]) tagItemsMap[t] = [];
      tagItemsMap[t].push(item);
    }
  } catch {}
  try { totalPainPoints += JSON.parse(item.pain_points || '[]').length; } catch {}
  try { totalClaims += JSON.parse(item.claims || '[]').length; } catch {}
  try { totalQuestions += JSON.parse(item.questions_raised || '[]').length; } catch {}
}

console.log(`   Pain points: ${totalPainPoints} | Claims: ${totalClaims} | Questions: ${totalQuestions}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// PASO 2 — Construir memo (igual que v1)
// ═══════════════════════════════════════════════════════════════════
function sampleByTag(tag, list, max = 8) {
  const matching = items.filter(i => {
    try { return JSON.parse(i.topic_tags || '[]').includes(tag); } catch { return false; }
  });
  const samples = [];
  for (const item of matching) {
    if (samples.length >= max) break;
    try {
      const data = JSON.parse(item[list] || '[]');
      for (const entry of data) {
        if (samples.length >= max) break;
        samples.push({ source: item.source, sentiment: item.sentiment, text: entry });
      }
    } catch {}
  }
  return samples;
}

const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
const topTags = sortedTags.slice(0, 20);

let memo = `# COLOSSEUM CORPUS ANALYSIS\n\n`;
memo += `Total items: ${items.length}\n`;
memo += `- GYG reviews: ${items.filter(i => i.source === 'gyg').length}\n`;
memo += `- YouTube content: ${items.filter(i => i.source === 'youtube').length}\n\n`;
memo += `## Sentiment by source\n`;
memo += `GYG: ${JSON.stringify(sourceBySentiment.gyg)}\n`;
memo += `YouTube: ${JSON.stringify(sourceBySentiment.youtube)}\n\n`;
memo += `## Topic frequencies (top 20)\n`;
for (const [tag, count] of topTags) memo += `- ${tag}: ${count}\n`;
memo += `\n## Sampled data by topic\n\n`;
for (const [tag, count] of topTags) {
  memo += `### ${tag} (${count} items)\n\n`;
  const pains = sampleByTag(tag, 'pain_points', 6);
  if (pains.length > 0) { memo += `Pain points:\n`; pains.forEach(p => memo += `- [${p.source}|${p.sentiment}] "${p.text}"\n`); memo += `\n`; }
  const claims = sampleByTag(tag, 'claims', 6);
  if (claims.length > 0) { memo += `Claims:\n`; claims.forEach(c => memo += `- [${c.source}] "${c.text}"\n`); memo += `\n`; }
  const qs = sampleByTag(tag, 'questions_raised', 6);
  if (qs.length > 0) { memo += `Questions:\n`; qs.forEach(q => memo += `- [${q.source}] "${q.text}"\n`); memo += `\n`; }
}

console.log(`📝 Memo: ${memo.length} chars (~${Math.ceil(memo.length / 4)} tokens)`);
console.log('');

let totalCost = 0;

// ═══════════════════════════════════════════════════════════════════
// LLAMADA 1 — Clusters + contradictions + gaps + summary
// ═══════════════════════════════════════════════════════════════════
const PROMPT_1 = `You are a senior content strategist analyzing a corpus of real user data about visiting the Roman Colosseum (GetYourGuide reviews + YouTube content).

Goal: produce strategic insights for a tour affiliate site (colosseumroman.com).

Return ONLY a JSON object (no markdown, no preamble) with this schema:

{
  "executive_summary": "2-3 paragraphs. The dominant story. What surprised you. Big patterns.",
  "thematic_clusters": [
    {
      "cluster_name": "string (e.g. 'Underground Access Premium')",
      "description": "what this cluster captures",
      "frequency_signal": "high|medium|low",
      "sources": ["gyg", "youtube"],
      "key_data_points": ["concrete claims with numbers"],
      "key_pain_points": ["specific user problems"],
      "key_questions": ["unanswered questions"]
    }
  ],
  "contradictions": [
    {
      "topic": "string",
      "gyg_perspective": "what GYG says",
      "youtube_perspective": "what YouTube says",
      "implication": "what this reveals"
    }
  ],
  "gaps": [
    {
      "gap_description": "what users keep asking but isn't answered",
      "evidence_count": 5,
      "article_potential": "high|medium|low"
    }
  ],
  "strategic_recommendations": ["high-level recommendations"]
}

Guidelines:
- 12-18 thematic_clusters
- Be concrete and specific
- Look for "scam", "booking-process", "queue" patterns specifically
- Return ONLY JSON, no markdown fences

Corpus memo:

${memo}`;

console.log(`🤖 Llamada 1/2: clusters + gaps + contradictions...`);
const t1 = Date.now();

let phase1;
try {
  const r1 = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: PROMPT_1 }]
  });
  const text1 = r1.content.find(b => b.type === 'text')?.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  phase1 = JSON.parse(text1);
  const cost1 = (r1.usage.input_tokens * 15 + r1.usage.output_tokens * 75) / 1_000_000;
  totalCost += cost1;
  console.log(`✅ Recibido en ${((Date.now() - t1) / 1000).toFixed(1)}s | $${cost1.toFixed(3)} | tokens: ${r1.usage.input_tokens} in / ${r1.usage.output_tokens} out`);
} catch (err) {
  console.error('❌ Error llamada 1:', err.message);
  process.exit(1);
}

console.log(`   Clusters: ${phase1.thematic_clusters?.length || 0}`);
console.log(`   Contradictions: ${phase1.contradictions?.length || 0}`);
console.log(`   Gaps: ${phase1.gaps?.length || 0}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// LLAMADA 2 — Article hypotheses (alimentada por los clusters)
// ═══════════════════════════════════════════════════════════════════
const clustersDigest = (phase1.thematic_clusters || [])
  .map((c, i) => `${i + 1}. ${c.cluster_name} (${c.frequency_signal}): ${c.description}\n   Pain: ${(c.key_pain_points || []).slice(0, 3).join('; ')}\n   Data: ${(c.key_data_points || []).slice(0, 3).join('; ')}`)
  .join('\n\n');

const gapsDigest = (phase1.gaps || []).map((g, i) => `${i + 1}. ${g.gap_description}`).join('\n');

const PROMPT_2 = `You are a senior content strategist. You already analyzed a corpus about Roman Colosseum tours and identified these thematic clusters and gaps:

## Clusters identified
${clustersDigest}

## Gaps identified
${gapsDigest}

Now produce 30-50 article hypotheses for colosseumroman.com (tour affiliate site monetized via GetYourGuide and Viator).

Return ONLY a JSON array (no markdown, no preamble) with this schema:

[
  {
    "title": "concrete SEO-friendly article title",
    "angle": "what makes this unique vs existing competitor articles",
    "supporting_data": ["specific claims/numbers/data that back this article"],
    "target_questions": ["user questions this answers"],
    "potential_score": "high|medium|low",
    "category": "informational|comparison|warning|guide|review-aggregation",
    "primary_cluster": "name of the main cluster this article comes from"
  }
]

Guidelines:
- Aim for 35-45 articles
- PRIORITIZE articles with VERIFIABLE data (specific numbers, prices, durations) — that's our GEO/AI-citability edge
- Cover scam-warning angles (high-value)
- Cover booking-process pain (official site is broken)
- Cover queue/wait time data (quantifiable)
- Cover comparisons (Underground vs Arena, GYG vs official, group vs private)
- Avoid generic titles like "Tips for Visiting the Colosseum"
- Each title should have a unique angle
- Return ONLY the JSON array, no preamble or markdown`;

console.log(`🤖 Llamada 2/2: article hypotheses...`);
const t2 = Date.now();

let articles;
try {
  const r2 = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: PROMPT_2 }]
  });
  const text2 = r2.content.find(b => b.type === 'text')?.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  articles = JSON.parse(text2);
  const cost2 = (r2.usage.input_tokens * 15 + r2.usage.output_tokens * 75) / 1_000_000;
  totalCost += cost2;
  console.log(`✅ Recibido en ${((Date.now() - t2) / 1000).toFixed(1)}s | $${cost2.toFixed(3)} | tokens: ${r2.usage.input_tokens} in / ${r2.usage.output_tokens} out`);
} catch (err) {
  console.error('❌ Error llamada 2:', err.message);
  console.error('Continuando solo con phase1...');
  articles = [];
}

console.log(`   Articles propuestos: ${articles.length}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════
// PASO 3 — Guardar en DB
// ═══════════════════════════════════════════════════════════════════
const insertInsight = db.prepare(`
  INSERT INTO insights (
    insight_type, topic_key, title, description,
    evidence_count, sources_json, article_potential, suggested_title
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
for (const c of phase1.thematic_clusters || []) {
  insertInsight.run('pattern', (c.cluster_name || '').toLowerCase().replace(/\s+/g, '-').slice(0, 80), c.cluster_name || '', c.description || '', (c.key_data_points?.length || 0) + (c.key_pain_points?.length || 0), JSON.stringify(c.sources || []), c.frequency_signal || 'medium', null);
  inserted++;
}
for (const c of phase1.contradictions || []) {
  insertInsight.run('contradiction', (c.topic || '').toLowerCase().replace(/\s+/g, '-').slice(0, 80), `Contradiction: ${c.topic}`, c.implication || '', 1, JSON.stringify(['gyg', 'youtube']), 'high', null);
  inserted++;
}
for (const g of phase1.gaps || []) {
  insertInsight.run('gap', (g.gap_description || '').slice(0, 80), (g.gap_description || '').slice(0, 200), g.gap_description || '', g.evidence_count || 0, JSON.stringify([]), g.article_potential || 'medium', null);
  inserted++;
}
for (const a of articles) {
  insertInsight.run('pain_point', a.category || 'informational', a.title || '', a.angle || '', a.supporting_data?.length || 0, JSON.stringify([]), a.potential_score || 'medium', a.title || null);
  inserted++;
}
console.log(`💾 ${inserted} insights guardados`);

// ═══════════════════════════════════════════════════════════════════
// PASO 4 — Reporte Markdown
// ═══════════════════════════════════════════════════════════════════
let report = `# 📊 Colosseum Corpus — Strategic Analysis Report\n\n`;
report += `Generated: ${new Date().toISOString()}\n`;
report += `Model: ${MODEL}\n`;
report += `Items analyzed: ${items.length}\n`;
report += `Cost: $${totalCost.toFixed(3)}\n\n---\n\n`;

report += `## Executive Summary\n\n${phase1.executive_summary || ''}\n\n`;

report += `## Thematic Clusters (${phase1.thematic_clusters?.length || 0})\n\n`;
for (const c of phase1.thematic_clusters || []) {
  report += `### ${c.cluster_name} _(${c.frequency_signal})_\n`;
  report += `${c.description}\n\n`;
  report += `**Sources:** ${(c.sources || []).join(', ')}\n\n`;
  if (c.key_data_points?.length) { report += `**Key data points:**\n`; c.key_data_points.forEach(d => report += `- ${d}\n`); report += `\n`; }
  if (c.key_pain_points?.length) { report += `**Key pain points:**\n`; c.key_pain_points.forEach(p => report += `- ${p}\n`); report += `\n`; }
  if (c.key_questions?.length) { report += `**Key questions:**\n`; c.key_questions.forEach(q => report += `- ${q}\n`); report += `\n`; }
}

report += `## Contradictions GYG vs YouTube\n\n`;
for (const c of phase1.contradictions || []) {
  report += `### ${c.topic}\n`;
  report += `- **GYG says:** ${c.gyg_perspective}\n`;
  report += `- **YouTube says:** ${c.youtube_perspective}\n`;
  report += `- **Implication:** ${c.implication}\n\n`;
}

report += `## Gaps in Existing Information\n\n`;
for (const g of phase1.gaps || []) {
  report += `- _(${g.article_potential}, ${g.evidence_count} mentions)_ ${g.gap_description}\n`;
}
report += `\n`;

report += `## Article Hypotheses (${articles.length})\n\n`;
report += `| # | Title | Category | Score |\n|---|---|---|---|\n`;
articles.forEach((a, i) => {
  report += `| ${i + 1} | ${a.title} | ${a.category} | ${a.potential_score} |\n`;
});
report += `\n### Article details\n\n`;
articles.forEach((a, i) => {
  report += `#### ${i + 1}. ${a.title}\n`;
  report += `- **Category:** ${a.category}\n- **Score:** ${a.potential_score}\n- **Cluster:** ${a.primary_cluster || '—'}\n- **Angle:** ${a.angle}\n`;
  if (a.supporting_data?.length) { report += `- **Supporting data:**\n`; a.supporting_data.forEach(d => report += `  - ${d}\n`); }
  if (a.target_questions?.length) { report += `- **Target questions:**\n`; a.target_questions.forEach(q => report += `  - ${q}\n`); }
  report += `\n`;
});

report += `## Strategic Recommendations\n\n`;
(phase1.strategic_recommendations || []).forEach(r => report += `- ${r}\n`);

writeFileSync(REPORT_PATH, report, 'utf8');
console.log(`📄 Reporte: ${REPORT_PATH}`);

db.close();

console.log('');
console.log('━'.repeat(70));
console.log('✅ FASE 2 TERMINADA');
console.log('━'.repeat(70));
console.log(`Costo total:        $${totalCost.toFixed(3)}`);
console.log(`Clusters:           ${phase1.thematic_clusters?.length || 0}`);
console.log(`Contradicciones:    ${phase1.contradictions?.length || 0}`);
console.log(`Gaps:               ${phase1.gaps?.length || 0}`);
console.log(`Article hypotheses: ${articles.length}`);
console.log(`\nAbrí: ${REPORT_PATH}`);