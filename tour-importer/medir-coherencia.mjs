// Mide cuantos tours YA contestan su pregunta asignada, antes de regenerar nada.
//
// POR QUE HACE FALTA: las preguntas se asignaron leyendo el cuerpo de cada tour,
// asi que muchas ya estan alineadas por construccion. Regenerar a ciegas puede
// EMPEORAR paginas que ya estaban bien — lo vi en un caso: el cuerpo publicado
// abria con "Twenty minutes standing on the sand" para la pregunta "how long do
// you stand on the arena floor?", y la regeneracion lo enterraba en el medio.
//
// Un chequeo lexico no alcanza: "Twenty" no matchea /\d+/. Lo juzga el modelo,
// en una sola llamada sobre el catalogo entero.
//
// SOLO MIDE. No escribe nada.
import { config } from './config.js';
import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const sanity = createClient({ ...config.sanity });
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const INSTRUCCIONES = `You are auditing tour pages. Each page has an H3 question and, directly under it, a short "Quick Answer" passage. A search engine reads the two as a pair: query, then answer.

For each pair, judge ONE thing: does the FIRST SENTENCE of the passage settle the question?

Verdicts:
- "settled" — the first sentence answers it. A reader with that question stops reading there satisfied.
- "buried" — the passage does answer it, but not in the first sentence. The fact is there, further down.
- "missing" — the passage does not answer the question at all.

Be strict about "settled": if the first sentence would fit equally well under a different question, it is not settled.

OUTPUT
A JSON array, same order as received, one object per pair:
[{"slug":"...","verdict":"settled"}]
Nothing else — no prose, no markdown fence.`;

const tours = await sanity.fetch(`*[_type=="post" && discontinued!=true && !(_id in path("drafts.**")) && defined(quickAnswerQuestion)]{
  "slug": slug.current, quickAnswerQuestion, "qa": pt::text(body[2...4])
} | order(slug asc)`);

console.log(`\nCOHERENCIA PREGUNTA / RESPUESTA — ${tours.length} tours\n`);

const lote = tours.map((t, i) => `${i + 1}. slug: ${t.slug}
   QUESTION: ${t.quickAnswerQuestion}
   PASSAGE: ${(t.qa || '').replace(/\s+/g, ' ').slice(0, 420)}`).join('\n\n');

const stream = await anthropic.messages.stream({
  model: 'claude-opus-5',
  // 375 tours: casi el triple del catalogo mas grande que se midio hasta
  // ahora (vatican, 140). Con 32000 el veredicto se cortaba a la mitad — el
  // guard de stop_reason lo atrapa, pero es una corrida pagada y tirada.
  max_tokens: 64000,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
  system: [{ type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: `THE PAIRS (${tours.length}):\n\n${lote}` }],
});
const msg = await stream.finalMessage();
if (msg.stop_reason === 'max_tokens') throw new Error('respuesta truncada');

const texto = msg.content.find(b => b.type === 'text')?.text || '';
const veredictos = JSON.parse(texto.slice(texto.indexOf('['), texto.lastIndexOf(']') + 1));

const cuenta = {};
veredictos.forEach(v => cuenta[v.verdict] = (cuenta[v.verdict] || 0) + 1);
console.log('VEREDICTO');
for (const k of ['settled', 'buried', 'missing']) {
  const n = cuenta[k] || 0;
  console.log(`  ${String(n).padStart(3)}/${veredictos.length}  ${k.padEnd(9)} ${'█'.repeat(n)}`);
}

const aRehacer = veredictos.filter(v => v.verdict !== 'settled').map(v => v.slug);
fs.writeFileSync(path.join(AQUI, 'coherencia.json'), JSON.stringify({ veredictos, aRehacer }, null, 2));

console.log(`\n  tours que valdria la pena regenerar: ${aRehacer.length}`);
aRehacer.slice(0, 8).forEach(s => console.log(`    ${s}`));

const u = msg.usage;
const costo = ((u.input_tokens || 0) * 5 + (u.cache_creation_input_tokens || 0) * 6.25
  + (u.cache_read_input_tokens || 0) * 0.5 + (u.output_tokens || 0) * 25) / 1e6;
console.log(`\ncosto de esta medicion: US$${costo.toFixed(3)}`);
console.log('la lista quedo en coherencia.json');
