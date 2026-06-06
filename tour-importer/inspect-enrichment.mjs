#!/usr/bin/env node
/**
 * inspect-enrichment.mjs
 *
 * Muestra una muestra de items enriquecidos para validar calidad
 * antes de escalar el procesamiento al resto del corpus.
 */

import Database from 'better-sqlite3';

const db = new Database('./colosseum-corpus.db', { readonly: true });

console.log('━'.repeat(70));
console.log('🔍 INSPECCIÓN DE ENRIQUECIMIENTO');
console.log('━'.repeat(70));

// Stats generales
const totalEnriched = db.prepare(`
  SELECT COUNT(*) as n FROM corpus_items
  WHERE enriched_at IS NOT NULL AND enrichment_version = 'v1'
`).get().n;

console.log(`Items enriquecidos: ${totalEnriched}`);
console.log('');

// Distribución de sentiment
console.log('📊 DISTRIBUCIÓN DE SENTIMENT:');
const sentimentDist = db.prepare(`
  SELECT sentiment, COUNT(*) as n
  FROM corpus_items
  WHERE enrichment_version = 'v1'
  GROUP BY sentiment
  ORDER BY n DESC
`).all();
sentimentDist.forEach(s => {
  const bar = '█'.repeat(Math.round(s.n / totalEnriched * 40));
  console.log(`   ${(s.sentiment || 'NULL').padEnd(7)} ${String(s.n).padStart(4)} ${bar}`);
});
console.log('');

// Topic tags más frecuentes
console.log('🏷️  TOP 20 TOPIC TAGS:');
const allTags = db.prepare(`
  SELECT topic_tags FROM corpus_items
  WHERE enrichment_version = 'v1' AND topic_tags IS NOT NULL
`).all();

const tagCounts = {};
for (const row of allTags) {
  try {
    const tags = JSON.parse(row.topic_tags);
    for (const t of tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  } catch {}
}
const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
sortedTags.forEach(([tag, count]) => {
  console.log(`   ${tag.padEnd(20)} ${String(count).padStart(4)}`);
});
console.log('');

// Pain points totales
const allPainPoints = db.prepare(`
  SELECT pain_points FROM corpus_items
  WHERE enrichment_version = 'v1' AND pain_points IS NOT NULL
`).all();

let totalPainPoints = 0;
const samplePains = [];
for (const row of allPainPoints) {
  try {
    const pp = JSON.parse(row.pain_points);
    totalPainPoints += pp.length;
    if (pp.length > 0 && samplePains.length < 15) {
      samplePains.push(...pp);
    }
  } catch {}
}
console.log(`💢 PAIN POINTS DETECTADOS: ${totalPainPoints} en total`);
console.log('   Muestra:');
samplePains.slice(0, 12).forEach(p => console.log(`   - "${p}"`));
console.log('');

// Claims
const allClaims = db.prepare(`
  SELECT claims FROM corpus_items
  WHERE enrichment_version = 'v1' AND claims IS NOT NULL
`).all();

let totalClaims = 0;
const sampleClaims = [];
for (const row of allClaims) {
  try {
    const cc = JSON.parse(row.claims);
    totalClaims += cc.length;
    if (cc.length > 0 && sampleClaims.length < 15) {
      sampleClaims.push(...cc);
    }
  } catch {}
}
console.log(`📌 CLAIMS DETECTADOS: ${totalClaims} en total`);
console.log('   Muestra:');
sampleClaims.slice(0, 12).forEach(c => console.log(`   - "${c}"`));
console.log('');

// Questions
const allQuestions = db.prepare(`
  SELECT questions_raised FROM corpus_items
  WHERE enrichment_version = 'v1' AND questions_raised IS NOT NULL
`).all();

let totalQuestions = 0;
const sampleQuestions = [];
for (const row of allQuestions) {
  try {
    const qq = JSON.parse(row.questions_raised);
    totalQuestions += qq.length;
    if (qq.length > 0 && sampleQuestions.length < 15) {
      sampleQuestions.push(...qq);
    }
  } catch {}
}
console.log(`❓ QUESTIONS RAISED: ${totalQuestions} en total`);
console.log('   Muestra:');
sampleQuestions.slice(0, 12).forEach(q => console.log(`   - "${q}"`));
console.log('');

// 3 ejemplos completos
console.log('━'.repeat(70));
console.log('📋 3 ITEMS COMPLETOS (texto + extracción)');
console.log('━'.repeat(70));

const samples = db.prepare(`
  SELECT id, source, text, sentiment, topic_tags, pain_points, claims, questions_raised
  FROM corpus_items
  WHERE enrichment_version = 'v1'
    AND (
      length(pain_points) > 5
      OR length(claims) > 5
      OR length(questions_raised) > 5
    )
  ORDER BY RANDOM()
  LIMIT 3
`).all();

samples.forEach((item, idx) => {
  console.log('');
  console.log(`[${idx + 1}] id=${item.id} | source=${item.source} | sentiment=${item.sentiment}`);
  console.log(`    Text: "${item.text.slice(0, 200).replace(/\n/g, ' ')}${item.text.length > 200 ? '...' : ''}"`);
  console.log(`    Tags: ${item.topic_tags}`);
  console.log(`    Pain: ${item.pain_points}`);
  console.log(`    Claims: ${item.claims}`);
  console.log(`    Q: ${item.questions_raised}`);
});

db.close();
console.log('');