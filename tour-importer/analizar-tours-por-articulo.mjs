// analizar-tours-por-articulo.mjs — Empareja cada pagina informacional con los
// tours que de verdad le sirven a quien la esta leyendo.
//
// POR QUE EXISTE
// El widget del sidebar elige hoy por palabras poco comunes del titulo. Acierta
// en lo obvio —el articulo de underground trae los tres de underground— y falla
// exactamente donde esta el trafico: medido sobre las visitas reales del 26 sep
// 2026, la pagina mas vista del sitio (67 usuarios, 10,5% del total) no comparte
// NINGUNA palabra util con ningun titulo de tour, y otras dos de las cuatro mas
// vistas tampoco. Ahi el puntaje da cero para todos y el desempate decide solo.
//
// POR QUE DE CATALOGO Y NO PAGINA POR PAGINA
// Mismo motivo que asignar-quick-answer.mjs: preguntando de a una, el modelo no
// puede repartir. Termina poniendo el tour mas popular en todas y el widget
// vuelve a ser una lista generica, que es justo lo que se quiere dejar atras.
// Viendo el catalogo entero puede darle a cada articulo lo suyo.
//
// SE PROPONE, NO SE APLICA
// Deja tours-por-articulo.json para revisar. Volver a llamar al modelo para
// escribir devuelve asignaciones DISTINTAS de las que se revisaron: por eso la
// escritura lee el archivo y no vuelve a preguntar.
//
// CLI:
//   node analizar-tours-por-articulo.mjs                 # propone y deja el JSON
//   node analizar-tours-por-articulo.mjs --execute       # escribe lo del JSON en Sanity
//   node analizar-tours-por-articulo.mjs --limit=10      # prueba corta

import { config } from './config.js';
import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '9999', 10);
// Anclado al archivo y no al cwd: con una ruta relativa, correr el script desde
// la raiz del repo no encuentra la propuesta y la rehace, cobrando de nuevo.
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PROPUESTA = path.join(AQUI, 'tours-por-articulo.json');

const sanity = createClient({ ...config.sanity });
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const INSTRUCCIONES = `You are matching each editorial article on lasvegastour.com to the tours a reader of THAT article would actually want.

The reader has just read a specific article — about what a package really includes, about what to book ahead, about visiting with kids, about the mistakes first-timers make in Las Vegas. They are on the page. The tours you pick are what the sidebar offers them.

WHAT MAKES A GOOD MATCH
Match on what the article is ABOUT, not on shared words. An article about tickets selling out should surface tours that include entry (so the reader stops fighting the official site). An article about accessibility should surface tours that are physically doable. An article about the building's history should surface guided tours where a guide tells that story, not a self-guided audio ticket.

Ask yourself: having read this, what is this person's next problem, and which tour solves it?

HARD RULES
- Pick exactly 3 tours per article, ordered: the first is the one you would put in front of them if you only had one slot.
- Only pick from the catalogue given. Use the exact slug.
- A tour may serve several articles, but do not put the same tour first on more than 6 articles. If you find yourself doing that, the match is lazy — look again at what makes each article different.
- "reason" must name something CONCRETE from the article, not a generic phrase. "Readers here are dealing with sold-out official tickets, and this tour includes entry" is a reason. "This is a popular, well-reviewed tour" is not.
- If an article genuinely has no good match — it is institutional, methodological, or not about visiting — return "sinMatch": true for it, with 0 tours and a one-line reason. Do NOT force three tours onto it. A bad match is worse than the current behaviour.

OUTPUT
A JSON array and nothing else. One object per article:

[
  {
    "slug": "un-slug-de-articulo",
    "tours": ["slug-del-tour-1", "slug-del-tour-2", "slug-del-tour-3"],
    "reason": "..."
  },
  { "slug": "otro-slug", "sinMatch": true, "tours": [], "reason": "Methodology page, not a visit-planning article." }
]`;

// ── los datos ───────────────────────────────────────────────────────────────
// Del articulo se manda el titulo, su Quick Answer (que es lo que el articulo
// contesta, no su titulo decorativo) y sus encabezados, que son el esqueleto del
// tema. Todo el cuerpo no entra y tampoco haria falta.
const paginas = await sanity.fetch(`*[_type=="page" && !(_id in path("drafts.**")) && defined(slug.current)]{
  _id, "slug": slug.current, title,
  "quick": pt::text(content[_type=="quickAnswerBox"][0]),
  "encabezados": content[style in ["h2","h3"]]{"h": pt::text(@)}
} | order(slug asc)`);

// Este sitio tiene el inventario en Viator, asi que el widget acepta cualquier
// partner. Solo se descarta un tour sin URL de reserva: proponer uno que el
// widget no va a poder mostrar seria trabajo tirado.
const tours = (await sanity.fetch(`*[_type=="post" && discontinued != true && !(_id in path("drafts.**"))]{
  _id, "slug": slug.current, title,
  "url": coalesce(bookingUrl, getYourGuideUrl),
  "duracion": tourInfo.duration, "precio": tourInfo.price,
  "reviews": getYourGuideData.reviewCount,
  "resumen": pt::text(body[1...3])
} | order(slug asc)`)).filter(t => /^https?:\/\//.test(t.url || ''));

const lote = paginas.slice(0, LIMIT);

// ── escritura desde el archivo ya revisado ──────────────────────────────────
if (EXECUTE) {
  if (!fs.existsSync(PROPUESTA)) {
    console.log(`No existe ${PROPUESTA}. Corre el script sin --execute primero, revisa el JSON, y recien ahi aplicá.`);
    process.exit(1);
  }
  const propuesta = JSON.parse(fs.readFileSync(PROPUESTA, 'utf8'));
  const porSlug = Object.fromEntries(tours.map(t => [t.slug, t._id]));
  let escritas = 0, saltadas = 0;

  for (const a of propuesta) {
    const pagina = paginas.find(p => p.slug === a.slug);
    if (!pagina) { console.log(`   ${a.slug}: no existe la pagina, salteada`); saltadas++; continue; }
    if (a.sinMatch || !a.tours?.length) { saltadas++; continue; }

    const refs = a.tours.map(s => porSlug[s]).filter(Boolean);
    if (refs.length !== a.tours.length) {
      console.log(`   ${a.slug}: algun tour ya no existe o quedo sin URL de reserva, salteada`);
      saltadas++; continue;
    }
    await sanity.patch(pagina._id).set({
      toursRecomendados: refs.map((id, i) => ({ _type: 'reference', _ref: id, _key: `t${i}` })),
    }).commit();
    escritas++;
  }
  console.log(`\nEscritas: ${escritas}   sin tocar: ${saltadas}`);
  process.exit(0);
}

// ── la llamada ──────────────────────────────────────────────────────────────
console.log(`\nTOURS POR ARTICULO — lasvegastour`);
console.log(`  articulos: ${lote.length}   tours reservables: ${tours.length}\n`);

const catalogoTours = tours.map((t, i) => `${i + 1}. slug: ${t.slug}
   title: ${t.title}
   duration: ${t.duracion || '(not stated)'} | price: ${t.precio ? '$' + t.precio : '(unknown)'} | reviews: ${t.reviews || 0}
   what it is: ${(t.resumen || '').replace(/\s+/g, ' ').slice(0, 200)}`).join('\n\n');

const catalogoPaginas = lote.map((p, i) => `${i + 1}. slug: ${p.slug}
   title: ${p.title}
   what it answers: ${(p.quick || '').replace(/\s+/g, ' ').slice(0, 260) || '(no quick answer)'}
   sections: ${(p.encabezados || []).map(h => h.h).filter(Boolean).slice(0, 7).join(' | ').slice(0, 260)}`).join('\n\n');

const stream = await anthropic.messages.stream({
  model: 'claude-opus-5',
  max_tokens: 64000,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'high' },
  // El catalogo de tours va cacheado: no cambia entre corridas y es lo mas
  // pesado del pedido.
  system: [
    { type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `THE TOUR CATALOGUE (${tours.length} tours):\n\n${catalogoTours}`, cache_control: { type: 'ephemeral' } },
  ],
  messages: [{ role: 'user', content: `THE ARTICLES (${lote.length}):\n\n${catalogoPaginas}` }],
});
const msg = await stream.finalMessage();

// Sin este chequeo el JSON llega cortado y el parseo falla con un error que no
// dice nada sobre la causa real.
if (msg.stop_reason === 'max_tokens') {
  throw new Error(`Respuesta truncada (${msg.usage.output_tokens} tokens de salida). Subir max_tokens o bajar --limit.`);
}

// Con thinking adaptive el primer bloque puede ser el razonamiento, no el texto.
const texto = msg.content.find(b => b.type === 'text')?.text || '';
const json = texto.slice(texto.indexOf('['), texto.lastIndexOf(']') + 1);
let asignacion;
try { asignacion = JSON.parse(json); }
catch (e) { console.log('No pude parsear la respuesta:\n', texto.slice(0, 700)); process.exit(1); }

// ── controles ───────────────────────────────────────────────────────────────
const slugsTour = new Set(tours.map(t => t.slug));
const faltantes = lote.filter(p => !asignacion.some(a => a.slug === p.slug));
const inventados = asignacion.flatMap(a => (a.tours || []).filter(s => !slugsTour.has(s)));
const cantidadMal = asignacion.filter(a => !a.sinMatch && (a.tours || []).length !== 3);
const repetidosDentro = asignacion.filter(a => new Set(a.tours || []).size !== (a.tours || []).length);
const sinMatch = asignacion.filter(a => a.sinMatch);
const razonFloja = asignacion.filter(a => (a.reason || '').split(/\s+/).length < 8);

const primeros = {};
asignacion.forEach(a => { if (a.tours?.[0]) primeros[a.tours[0]] = (primeros[a.tours[0]] || 0) + 1; });
const acaparan = Object.entries(primeros).filter(([, n]) => n > 6).sort((a, b) => b[1] - a[1]);

console.log('CONTROLES');
console.log(`  devueltos:                  ${asignacion.length}/${lote.length}${faltantes.length ? '  <<< faltan ' + faltantes.length : ''}`);
console.log(`  slugs de tour inventados:   ${inventados.length}${inventados.length ? '  <<< ' + inventados.slice(0, 3).join(', ') : ''}`);
console.log(`  sin exactamente 3 tours:    ${cantidadMal.length}`);
console.log(`  con un tour repetido:       ${repetidosDentro.length}`);
console.log(`  marcados "sin match":       ${sinMatch.length}`);
sinMatch.slice(0, 6).forEach(a => console.log(`      ${a.slug}`));
console.log(`  tours que acaparan (>6 1ros): ${acaparan.length}`);
acaparan.slice(0, 5).forEach(([s, n]) => console.log(`      x${n}  ${s}`));
console.log(`  razones de menos de 8 palabras: ${razonFloja.length}`);

const bloquea = faltantes.length || inventados.length || cantidadMal.length || repetidosDentro.length;

console.log('\nMUESTRA');
asignacion.slice(0, 5).forEach(a => {
  console.log(`\n  ${a.slug}`);
  (a.tours || []).forEach((s, i) => console.log(`     ${i + 1}. ${s}`));
  console.log(`     por que: ${a.reason}`);
});

fs.writeFileSync(PROPUESTA, JSON.stringify(asignacion, null, 2));
console.log(`\npropuesta -> ${PROPUESTA}`);

const u = msg.usage;
const costo = ((u.input_tokens || 0) * 5 + (u.cache_creation_input_tokens || 0) * 6.25
  + (u.cache_read_input_tokens || 0) * 0.5 + (u.output_tokens || 0) * 25) / 1e6;
console.log(`costo de esta llamada: US$${costo.toFixed(3)}`);

if (bloquea) {
  console.log('\nHAY CONTROLES EN ROJO. Revisar el JSON antes de aplicar con --execute.');
  process.exit(1);
}
console.log('\nControles en verde. Revisá el JSON y aplicá con --execute.');
