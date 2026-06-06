/**
 * sanity-diagnostic.mjs v2 — Solo lectura
 *
 * v2 changes:
 *   - Lista valores únicos de `pageType` para tipo `page`
 *   - Muestra TODOS los slugs del tipo `page` (no solo 5)
 *   - Detecta presencia de Quick Answer en `content` además de `body`
 */

import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@sanity/client';

function getEnv(key) { return process.env[key]; }
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PROJECT_ID = getEnv('SANITY_PROJECT_ID');
const DATASET = getEnv('SANITY_DATASET') || 'production';
const TOKEN = getEnv('SANITY_TOKEN');

if (!PROJECT_ID || !TOKEN) {
  console.error('❌ Faltan SANITY_PROJECT_ID o SANITY_TOKEN');
  process.exit(1);
}

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token: TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

console.log('\n🔍 SANITY DIAGNOSTIC v2 — Coliseo (read-only)\n');

// ========================================
// FETCH ALL PAGES con campos clave
// ========================================
console.log('📥 Fetching todas las pages...\n');

const allPages = await sanity.fetch(`
  *[_type == "page"]{
    "slug": slug.current,
    title,
    pageType,
    content
  } | order(slug asc)
`);

console.log(`   ✅ ${allPages.length} pages encontradas\n`);

// ========================================
// 1. Valores únicos de pageType
// ========================================
const pageTypeCounts = {};
for (const p of allPages) {
  const pt = p.pageType || '(sin pageType)';
  pageTypeCounts[pt] = (pageTypeCounts[pt] || 0) + 1;
}

console.log('🏷️  VALORES DE `pageType`:');
const sortedPageTypes = Object.entries(pageTypeCounts).sort((a, b) => b[1] - a[1]);
for (const [pt, count] of sortedPageTypes) {
  console.log(`   ${String(pt).padEnd(30)} ${count} pages`);
}
console.log('');

// ========================================
// 2. Detectar Quick Answer en content
// ========================================
function hasQuickAnswer(content) {
  if (!Array.isArray(content)) return false;
  return content.some(block =>
    block._type === 'block' &&
    block.children?.some(child =>
      (child.text || '').toLowerCase().includes('quick answer')
    )
  );
}

let withQA = 0;
let withoutQA = 0;
for (const p of allPages) {
  if (hasQuickAnswer(p.content)) withQA++;
  else withoutQA++;
}

console.log('📝 QUICK ANSWER en `content`:');
console.log(`   Con Quick Answer:    ${withQA}`);
console.log(`   Sin Quick Answer:    ${withoutQA}\n`);

// ========================================
// 3. Listar TODOS los slugs agrupados por pageType
// ========================================
const report = [];
report.push('═══════════════════════════════════════════════════════════════════════');
report.push('  SANITY DIAGNOSTIC v2 — Coliseo / pages');
report.push(`  Generated: ${new Date().toISOString()}`);
report.push(`  Total pages: ${allPages.length}`);
report.push('═══════════════════════════════════════════════════════════════════════');
report.push('');

report.push('🏷️  VALORES DE pageType:');
for (const [pt, count] of sortedPageTypes) {
  report.push(`   ${String(pt).padEnd(30)} ${count} pages`);
}
report.push('');

report.push('📝 QUICK ANSWER:');
report.push(`   Con QA:    ${withQA}`);
report.push(`   Sin QA:    ${withoutQA}`);
report.push('');

// Agrupar por pageType
const byPageType = {};
for (const p of allPages) {
  const pt = p.pageType || '(sin pageType)';
  if (!byPageType[pt]) byPageType[pt] = [];
  byPageType[pt].push(p);
}

for (const [pt, pages] of Object.entries(byPageType).sort((a, b) => b[1].length - a[1].length)) {
  report.push('');
  report.push(`─────────────────────────────────────────────────────────────────────`);
  report.push(`  pageType: ${pt}  (${pages.length} pages)`);
  report.push(`─────────────────────────────────────────────────────────────────────`);
  report.push('');

  for (const p of pages) {
    const slug = (p.slug || '(sin slug)').padEnd(60);
    const qa = hasQuickAnswer(p.content) ? '✅QA' : '   ';
    const title = (p.title || '(sin título)').slice(0, 70);
    report.push(`  ${qa}  ${slug} | ${title}`);
  }
}

report.push('');
report.push('═══════════════════════════════════════════════════════════════════════');

const reportText = report.join('\n');
writeFileSync('.cache/sanity-diagnostic-v2.txt', reportText);

console.log('✅ Reporte guardado en .cache/sanity-diagnostic-v2.txt\n');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(reportText);