#!/usr/bin/env node
/**
 * check-titles.mjs
 *
 * Chequea solapamiento ANTES de generar/publicar un articulo nuevo.
 * Trae TODOS los titulos publicados en Sanity (la fuente de verdad,
 * no architecture.json) y los compara contra un titulo candidato.
 *
 * Uso:
 *   node check-titles.mjs "is a guided colosseum tour worth it"
 *   node check-titles.mjs --list        (lista todos los titulos publicados)
 */
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
import { createClient } from '@sanity/client';

const c = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

// Stopwords que no aportan a la comparacion
const STOP = new Set(['the','a','an','is','are','to','of','in','on','for','and','or','vs','your','you','it','at','what','how','why','when','which','who','this','that','with','do','does','should','go','be','i','my','we','our','not','but','from','as','by']);

function tokenize(s) {
  return new Set(
    (s || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
  );
}

function similarity(a, b) {
  const ta = tokenize(a), tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  // Jaccard: interseccion / union
  const union = new Set([...ta, ...tb]).size;
  return { score: shared / union, shared, sharedWords: [...ta].filter(w => tb.has(w)) };
}

const args = process.argv.slice(2);
const isList = args.includes('--list');
const candidate = args.find(a => !a.startsWith('--'));

console.log('Trayendo todos los posts publicados de Sanity...\n');
const posts = await c.fetch(`*[_type == "page" && !(_id in path("drafts.**")) && defined(title)] | order(title asc){
  title, "slug": slug.current
}`);
console.log(`Total posts publicados: ${posts.length}\n`);

if (isList) {
  posts.forEach((p, i) => console.log(`${String(i+1).padStart(3)}. ${p.title}\n     /${p.slug}`));
  process.exit(0);
}

if (!candidate) {
  console.error('Falta el titulo candidato. Uso: node check-titles.mjs "tu titulo aca"');
  console.error('O bien: node check-titles.mjs --list');
  process.exit(1);
}

console.log(`CANDIDATO: "${candidate}"\n`);
console.log('─'.repeat(70));

const ranked = posts
  .map(p => ({ ...p, sim: similarity(candidate, p.title) }))
  .filter(p => p.sim.score > 0)
  .sort((a, b) => b.sim.score - a.sim.score)
  .slice(0, 10);

if (ranked.length === 0) {
  console.log('\n✅ TERRENO LIMPIO — ningun titulo publicado comparte keywords relevantes.\n');
  process.exit(0);
}

console.log('\nTITULOS PUBLICADOS MAS PARECIDOS:\n');
ranked.forEach(p => {
  const pct = Math.round(p.sim.score * 100);
  let flag = '';
  if (pct >= 50) flag = '🔴 ALTO SOLAPAMIENTO';
  else if (pct >= 30) flag = '🟡 solapamiento medio';
  else flag = '🟢 bajo';
  console.log(`  ${flag}  (${pct}%)`);
  console.log(`  "${p.title}"`);
  console.log(`  /${p.slug}`);
  console.log(`  comparten: ${p.sim.sharedWords.join(', ') || '(nada relevante)'}\n`);
});

const top = ranked[0].sim.score;
console.log('─'.repeat(70));
if (top >= 0.5) {
  console.log('\n🔴 VEREDICTO: NO publicar con este angulo. Hay un articulo casi identico.');
  console.log('   Reenfoca el angulo o consolida con el existente.\n');
} else if (top >= 0.3) {
  console.log('\n🟡 VEREDICTO: Solapamiento medio. Diferencia bien el titulo/H1/intent.');
  console.log('   Asegurate de que respondan preguntas DISTINTAS.\n');
} else {
  console.log('\n🟢 VEREDICTO: Solapamiento bajo. Terreno relativamente limpio.\n');
}


