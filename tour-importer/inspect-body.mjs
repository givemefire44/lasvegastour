/**
 * inspect-body.mjs — Solo lectura
 *
 * Extrae el body de un tour de Sanity y lo imprime de forma legible
 * para entender la estructura JSON antes de diseñar el extractor.
 *
 * Usage:
 *   node inspect-body.mjs                            (usa tour default)
 *   node inspect-body.mjs --slug=<slug>              (usa tour específico)
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

const args = process.argv.slice(2);
const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];
const SLUG = slugArg || 'colosseum-roman-forum-palatine-hill-tour'; // default: el más reseñado

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token: TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

console.log('\n🔍 INSPECT BODY — Coliseo (read-only)');
console.log(`   Tour slug: ${SLUG}\n`);

const tour = await sanity.fetch(
  `*[_type == "post" && slug.current == $slug][0]{
    title,
    "slug": slug.current,
    body,
    faqs
  }`,
  { slug: SLUG }
);

if (!tour) {
  console.error(`❌ Tour '${SLUG}' no encontrado`);
  process.exit(1);
}

console.log(`📌 Title: ${tour.title}\n`);

// ========================================
// Mostrar estructura del body
// ========================================
console.log(`📑 BODY: ${tour.body?.length || 0} bloques\n`);
console.log('─────────────────────────────────────────────────────────────────────\n');

const blockTypeCounts = {};
const styleCounts = {};

if (Array.isArray(tour.body)) {
  for (let i = 0; i < tour.body.length; i++) {
    const block = tour.body[i];
    const t = block._type || 'unknown';
    blockTypeCounts[t] = (blockTypeCounts[t] || 0) + 1;

    if (t === 'block') {
      const style = block.style || 'normal';
      styleCounts[style] = (styleCounts[style] || 0) + 1;

      const text = (block.children || [])
        .map(c => c.text || '')
        .join('');

      const preview = text.length > 100 ? text.slice(0, 100) + '...' : text;
      console.log(`[${String(i).padStart(3)}] ${t} (${style}) — ${preview}`);
    } else {
      // bloques especiales (image, simpleTable, imageGallery, etc.)
      const keys = Object.keys(block).filter(k => !k.startsWith('_'));
      console.log(`[${String(i).padStart(3)}] ${t}  (campos: ${keys.join(', ')})`);
    }
  }
}

console.log('\n─────────────────────────────────────────────────────────────────────');
console.log('\n📊 RESUMEN DE TIPOS DE BLOQUES:');
for (const [t, count] of Object.entries(blockTypeCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${t.padEnd(25)} ${count}`);
}

console.log('\n📊 RESUMEN DE ESTILOS (block):');
for (const [s, count] of Object.entries(styleCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${s.padEnd(15)} ${count}`);
}

if (Array.isArray(tour.faqs)) {
  console.log(`\n📋 FAQs: ${tour.faqs.length} preguntas`);
}

// Guardar JSON completo del body para referencia
const outputPath = `.cache/body-inspect-${SLUG}.json`;
writeFileSync(outputPath, JSON.stringify({ slug: tour.slug, title: tour.title, body: tour.body, faqs: tour.faqs }, null, 2));
console.log(`\n💾 JSON completo guardado en ${outputPath}`);
console.log(`   Tamaño: ${(Buffer.byteLength(JSON.stringify(tour)) / 1024).toFixed(1)} KB\n`);
