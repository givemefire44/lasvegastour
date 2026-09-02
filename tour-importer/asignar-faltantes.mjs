// asignar-faltantes.mjs — Le pone pregunta a los tours que no tienen, y desdobla
// los que comparten la pregunta con otro tour. NO toca las que ya estan bien.
//
// POR QUE UN SCRIPT APARTE Y NO asignar-quick-answer.mjs:
// ese reparte la intencion sobre el catalogo ENTERO y reescribe todo. Aca 333 de
// 375 preguntas ya funcionan (89% de coherencia, el mejor del portfolio): volver
// a generarlas seria tirar trabajo que anda para reemplazarlo por otro distinto.
//
// POR QUE NO HACE FALTA REGENERAR NINGUN CUERPO:
// el modelo ve el TEXTO YA PUBLICADO de cada tour y esta obligado a citar
// textualmente el fragmento que hace contestable la pregunta. O sea que la
// pregunta se deriva de lo que el cuerpo YA dice. Un control verifica esa cita
// contra el texto real y bloquea la escritura si no aparece.
//
// LAS FAMILIAS salen de los 14 articulos publicados (app/utils/proTips.ts), que
// se escribieron porque la gente busca esas preguntas.
//
//   node asignar-faltantes.mjs --dry-run
//   node asignar-faltantes.mjs --execute

import { config } from './config.js';
import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const EXECUTE = process.argv.includes('--execute');
// --desde-archivo escribe la propuesta YA REVISADA en vez de pedir una nueva.
// Sin esto, aplicar obliga a volver a llamar al modelo, que devuelve preguntas
// DISTINTAS a las que uno reviso: se estaria escribiendo algo que nadie miro.
const DESDE_ARCHIVO = process.argv.includes('--desde-archivo');
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const sanity = createClient({ ...config.sanity });
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// Lugares que se BUSCAN, no solo los famosos: la primera version rechazaba
// preguntas que nombraban Fremont Street o Nellis Dunes, que son termino de
// busqueda igual que el Gran Canion. El control existe para que la pregunta
// nombre algo buscable, no algo que yo haya recordado poner en la lista.
const LUGAR = /vegas|strip|grand canyon|hoover|red rock|valley of fire|antelope|horseshoe|death valley|zion|bryce|sphere|mojave|colorado river|emerald (cave|cove)|nevada|monument valley|seven magic|fremont|nellis|white rock|arizona|hot springs|lake mead|boulder city|eldorado|techatticup|neon|area ?15|willow beach/i;

const FAMILIAS = `
1. GRAND CANYON — West Rim o South Rim: cual, cuanto se tarda, que se ve realmente
   (/grand-canyon-west-vs-south-rim-from-las-vegas)
2. AIR — helicoptero o avioneta: aterriza o solo sobrevuela, que incluye el vuelo
   (/las-vegas-helicopter-tours-which-worth-it)
3. DAY TRIP — Hoover Dam, Red Rock, Valley of Fire: cuanto dura, que paradas hace
   (/hoover-dam-tour-from-las-vegas, /red-rock-canyon-from-las-vegas, /valley-of-fire-from-las-vegas)
4. SHOWS — Sphere, espectaculos: que asiento, que entrada, como se elige
   (/sphere-las-vegas-seats-tickets-guide, /how-to-choose-las-vegas-shows)
5. NIGHTLIFE — club crawls, barra libre, que cubre la entrada
   (/las-vegas-nightlife-club-crawls)
6. COSTO — que entra en el precio y que se paga aparte
   (/how-much-las-vegas-trip-costs, /las-vegas-resort-fees-tipping-hidden-charges)
7. LOGISTICA — pickup del hotel, traslados, punto de encuentro
   (/how-to-get-around-las-vegas)
8. PRIMERA VEZ — como se planifica, que errores se pagan caro
   (/first-time-las-vegas-how-to-plan, /most-expensive-first-timer-mistakes-las-vegas)
`;

// ── que tours hay que tocar ─────────────────────────────────────────────────
const tours = await sanity.fetch(`*[_type=="post" && discontinued != true && !(_id in path("drafts.**"))]{
  _id, "slug": slug.current, title, quickAnswerQuestion,
  "rasgos": tourFeatures,
  "cuerpo": pt::text(body)
} | order(slug asc)`);

// Dos preguntas son la misma si comparten sus palabras significativas: "Do you
// walk on top of the Hoover Dam" y "Can you walk on top of the Hoover Dam" son
// una sola busqueda, y tenerlas en dos paginas las hace competir entre si.
const VACIAS = new Set(['the','a','an','is','are','do','does','this','tour','from','and','in','of','you','can','what','on','for','it','to','with','get','how','much','many','long']);
const huella = q => String(q || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/).filter(w => w && !VACIAS.has(w)).sort().join(' ');

const porHuella = {};
for (const t of tours.filter(t => t.quickAnswerQuestion)) {
  (porHuella[huella(t.quickAnswerQuestion)] ||= []).push(t);
}

const sinPregunta = tours.filter(t => !t.quickAnswerQuestion);
// De cada grupo repetido se conserva el PRIMERO y se reasignan los demas: asi se
// rompe el empate sin tirar una pregunta que ya funciona.
const duplicados = Object.values(porHuella).filter(g => g.length > 1).flatMap(g => g.slice(1));
const pendientes = [...sinPregunta, ...duplicados];

// Todo lo que se conserva queda RESERVADO: el modelo no puede repetirlo.
const conservadas = tours.filter(t => t.quickAnswerQuestion && !duplicados.includes(t))
  .map(t => t.quickAnswerQuestion);

console.log(`\nASIGNACION DE FALTANTES — lasvegastour | ${EXECUTE ? 'PRODUCCION' : 'DRY RUN'}`);
console.log(`  tours vivos:            ${tours.length}`);
console.log(`  preguntas que se dejan: ${conservadas.length}`);
console.log(`  sin pregunta:           ${sinPregunta.length}`);
console.log(`  con pregunta repetida:  ${duplicados.length}`);
console.log(`  a asignar:              ${pendientes.length}\n`);

if (!pendientes.length) { console.log('No hay nada que asignar.'); process.exit(0); }

const INSTRUCCIONES = `You are assigning the H3 "Quick Answer" question to the tour pages of lasvegastour.com that do not have a usable one yet.

That H3 is what search engines and AI assistants read as "the question this page answers". The rest of the catalogue already has its questions and they are working; your job is to fill the gaps WITHOUT colliding with what is already there.

${FAMILIAS}

THE RULE THAT DECIDES WHETHER THIS WORKS — ANSWERABILITY:
The page's existing body must already settle your question in its FIRST SENTENCE. You are NOT commissioning a rewrite: the text is already published and will not change. So before you write a question, find the sentence in THAT TOUR'S DATA that answers it. If you cannot point at one, the question is wrong — no matter how good a search query it would be.

Questions that FAIL this test: "Where does the group meet?" when the listing only says a meeting point exists. "How early is hotel pickup?" when no hour is stated. Excellent queries, still wrong here, because the page cannot answer them honestly.

PREFER CLOSED QUESTIONS. One that can open with "Yes", "No", "Twelve" or "Two hours" gets answered in the first sentence. An open evaluative question ("is it worth it?") tempts the page into describing itself instead of answering — and this catalogue's best pages are all factual.

HOW TO WRITE EACH QUESTION
- A question a real buyer would TYPE. Never a definition, never "What is X?".
- 5 to 11 words. It is a heading.
- MUST name the place: "Las Vegas", "the Strip", "Grand Canyon", "Hoover Dam", "Red Rock", "Valley of Fire", "Antelope Canyon", "Death Valley", "Zion", "the Sphere" — that is the searched term.
- NEVER a price or any figure a cron updates twice a week. Duration and group size are fine.
- No operator names. Do not copy the tour title.
- MOST IMPORTANT: your question must not duplicate, or differ only cosmetically from, ANY question in the RESERVED list you are given, or from any other question you write in this batch. "Do you walk on top of the Hoover Dam" and "Can you walk on top of the Hoover Dam" are the SAME question. Vary the ANGLE, not the wording.

OUTPUT
A JSON array, one object per tour, same order as received:
[{"slug": "...", "family": "GRAND CANYON", "question": "...", "evidence": "..."}]

"evidence" is a VERBATIM fragment — 3 to 12 words — copied character for character from THAT tour's data, the fragment that makes the question answerable. Copy it exactly: it is checked automatically against the text, and a question whose evidence is not found is rejected.
Nothing else — no prose, no markdown fence.`;

// Corta por puntos de codigo y no por indice: los emoji del cuerpo (⭐ 💰 ⏱️)
// ocupan dos posiciones, y un slice crudo puede partir uno al medio. El
// resultado es UTF-16 invalido que la API rechaza con 400 'no low surrogate'.
const recortar = (s, n) => Array.from(String(s || '').replace(/\s+/g, ' ')).slice(0, n).join('');
const rasgos = r => Object.entries(r || {}).filter(([, v]) => v === true).map(([k]) => k).join(', ') || '(none stated)';
const lote = pendientes.map((t, i) => `${i + 1}. slug: ${t.slug}
   title: ${t.title}
   features stated: ${rasgos(t.rasgos)}
   data: ${recortar(t.cuerpo, 900)}`).join('\n\n');

const reservadas = conservadas.map(q => `- ${q}`).join('\n');

let asignacion, msg = null;
if (DESDE_ARCHIVO) {
  asignacion = JSON.parse(fs.readFileSync(path.join(AQUI, 'faltantes-propuesta.json'), 'utf8').replace(/^﻿/, ''));
  console.log(`Leyendo la propuesta YA REVISADA: ${asignacion.length} preguntas. No se llama al modelo.
`);
} else {
const stream = await anthropic.messages.stream({
  model: 'claude-opus-5',
  // 64000 y no 32000: el modelo tiene que razonar contra las 358 preguntas
  // reservadas para no repetir ninguna, y con 32000 la respuesta salio
  // truncada. El guard de stop_reason lo atrapo, pero es una llamada pagada.
  max_tokens: 64000,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
  system: [{ type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content:
    `RESERVED — questions already live on other pages. Do not repeat or paraphrase any of these (${conservadas.length}):\n\n${reservadas}\n\n` +
    `THE TOURS THAT NEED A QUESTION (${pendientes.length}):\n\n${lote}` }],
});
msg = await stream.finalMessage();
if (msg.stop_reason === 'max_tokens') throw new Error(`Respuesta truncada (${msg.usage.output_tokens} tokens).`);

const texto = msg.content.find(b => b.type === 'text')?.text || '';
try { asignacion = JSON.parse(texto.slice(texto.indexOf('['), texto.lastIndexOf(']') + 1)); }
catch { console.log('No pude parsear la respuesta:', texto.slice(0, 600)); process.exit(1); }
}

// ── controles ───────────────────────────────────────────────────────────────
const normalizar = x => String(x || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const huellasReservadas = new Set(conservadas.map(huella));

const nuevas = {};
asignacion.forEach(a => (nuevas[huella(a.question)] ||= []).push(a));

const chocaConVivas = asignacion.filter(a => huellasReservadas.has(huella(a.question)));
const chocanEntreSi = Object.values(nuevas).filter(g => g.length > 1);
const sinLugar = asignacion.filter(a => !LUGAR.test(a.question));
const conPrecio = asignacion.filter(a => /\$|\bUSD\b|\d+\s*(dollars?)/i.test(a.question));
const largas = asignacion.filter(a => a.question.split(/\s+/).length > 11);
const faltantes = pendientes.filter(t => !asignacion.some(a => a.slug === t.slug));
const sinEvidencia = asignacion.filter(a => {
  const t = pendientes.find(x => x.slug === a.slug);
  if (!t) return true;
  if (!a.evidence) return true;
  return !normalizar(t.cuerpo).includes(normalizar(a.evidence));
});

console.log('CONTROLES');
console.log(`  devueltos:                    ${asignacion.length}/${pendientes.length}`);
console.log(`  chocan con una pregunta viva: ${chocaConVivas.length}`);
chocaConVivas.slice(0, 5).forEach(a => console.log(`      ${a.question}`));
console.log(`  chocan entre si:              ${chocanEntreSi.length}`);
chocanEntreSi.slice(0, 5).forEach(g => console.log(`      ${g.map(a => a.question).join('  ||  ')}`));
console.log(`  sin nombrar el lugar:         ${sinLugar.length}`);
sinLugar.slice(0, 5).forEach(a => console.log(`      ${a.question}`));
console.log(`  con precio (prohibido):       ${conPrecio.length}`);
console.log(`  de mas de 11 palabras:        ${largas.length}`);
console.log(`  evidencia NO verificada:      ${sinEvidencia.length}`);
sinEvidencia.slice(0, 5).forEach(a => console.log(`      ${a.slug}\n        Q: ${a.question}\n        cita: "${a.evidence || '(sin cita)'}"`));

if (msg) {
  const u = msg.usage;
  const costo = ((u.input_tokens || 0) * 5 + (u.cache_creation_input_tokens || 0) * 6.25
    + (u.cache_read_input_tokens || 0) * 0.5 + (u.output_tokens || 0) * 25) / 1e6;
  console.log(`
costo de esta llamada: US$${costo.toFixed(3)}`);
  // Solo se pisa el archivo cuando la propuesta es NUEVA: escribir desde el
  // archivo no debe sobreescribir lo que uno acaba de revisar.
  fs.writeFileSync(path.join(AQUI, 'faltantes-propuesta.json'), JSON.stringify(asignacion, null, 2));
}

if (!EXECUTE) { console.log('\nNADA escrito. La propuesta quedo en faltantes-propuesta.json'); process.exit(0); }

if (chocaConVivas.length || chocanEntreSi.length || sinLugar.length || conPrecio.length || faltantes.length || sinEvidencia.length) {
  console.log('\n<<< NO se escribe: hay controles en rojo.');
  process.exit(1);
}

let n = 0;
for (const a of asignacion) {
  const t = pendientes.find(x => x.slug === a.slug);
  if (!t) continue;
  await sanity.patch(t._id).set({ quickAnswerQuestion: a.question }).commit();
  n++;
  if (n % 20 === 0) console.log(`  ${n}/${asignacion.length}…`);
}
console.log(`\nescritos: ${n} tours`);
