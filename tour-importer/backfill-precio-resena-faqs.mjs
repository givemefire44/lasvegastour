// backfill-precio-resena-faqs.mjs — lasvegastour.com
// Una sola vez: alinea el precio citado en editorialReview (reviewBody del Review) y en faqs (FAQPage)
// con tourInfo.price. Mismo motivo que backfill-precio-seodescription.mjs: el cron solo reemplaza cuando
// el precio CAMBIA, y hasta be7c7d7 no tocaba estos dos campos. De aca en adelante los mantiene cron-prices.mjs.
//
// Uso:
//   node backfill-precio-resena-faqs.mjs                        (DRY: lista, no escribe)
//   node backfill-precio-resena-faqs.mjs --execute              (escribe las que no son extremas ni ambiguas)
//   node backfill-precio-resena-faqs.mjs --execute --incluir=slug1,slug2   (suma extremas revisadas a mano)
//
// Reglas (a diferencia de la seoDescription, estos textos citan tasas, propinas y opciones):
//   - Si el campo ya cita el precio vigente (difiere < $1), no se toca: los otros montos son otra cosa.
//   - "Parece el precio" = monto a no mas del 50% del vigente. Un $20 de tasa en un tour de $140 no cuenta.
//   - Un solo valor que parece el precio -> se reemplaza ese valor, todas sus apariciones en el campo.
//     Dos o mas valores distintos -> ambiguo, no se aplica (puede ser precio por opcion).
//   - Formato: si el texto tenia entero, se escribe redondeado; si tenia decimales, con 2 decimales.
//   - Diferencia > 50% contra el monto citado: extrema, no se aplica sola.
//   - Escribe SOLO editorialReview y/o faqs, con ifRevisionId. Idempotente.

import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import fs from 'fs';
import { replacePriceInText } from './precio-en-texto.mjs';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const INCLUIR = new Set(((args.find((a) => a.startsWith('--incluir=')) || '').split('=')[1] || '').split(',').filter(Boolean));
const UMBRAL_PARECE = 0.5;   // fraccion del precio vigente
const UMBRAL_EXTREMO = 50;   // % contra el monto citado

// Leidos en el contexto del dry-run del 27 oct 2026: el monto parece el precio pero es otra cosa.
const NO_ES_EL_PRECIO = {
  'vip-hoover-dam-interior-comedy-club-tour-from-vegas|editorialReview': 'valor de las entradas de comedia incluidas ($45)',
  'vip-hoover-dam-interior-comedy-club-tour-from-vegas|faqs': 'valor de las entradas de comedia incluidas ($45)',
  'vegas-quick-marriage-license-signing-15-min-legal-service|faqs': 'honorario del ministro en efectivo ($60)',
};

const sanity = createClient({
  projectId: 'kabmqky1', dataset: 'production',
  apiVersion: '2023-05-03', token: process.env.SANITY_API_TOKEN, useCdn: false,
});

const RE_MONTO = /(?:\$|USD )(\d[\d,]*(?:\.\d+)?)(?!\d)(?![.,]\d)/g;
const montos = (s) => [...(s || '').matchAll(RE_MONTO)].map((m) => ({ crudo: m[1], n: Number(m[1].replace(/,/g, '')), i: m.index }));
const contexto = (s, i) => (i > 50 ? '…' : '') + s.slice(Math.max(0, i - 50), i + 40).replace(/\s+/g, ' ').replace(/\|/g, '/') + '…';

const posts = await sanity.fetch(`*[_type=="post" && discontinued != true && activeOnGyg != false && defined(tourInfo.price) && !(_id in path("drafts.**"))]{
  _id, _rev, "slug": slug.current, "price": tourInfo.price, editorialReview, faqs
}`);

// Decide sobre un conjunto de textos de un mismo campo. Devuelve null (nada que hacer) o la fila.
function evaluar(textos, precio) {
  const todos = textos.flatMap((t) => montos(t).map((m) => ({ ...m, t })));
  if (!todos.length) return null;
  if (todos.some((m) => Math.abs(m.n - precio) < 1)) return null;            // ya cita el vigente
  const parecen = todos.filter((m) => Math.abs(m.n - precio) / precio <= UMBRAL_PARECE);
  if (!parecen.length) return null;                                          // solo tasas/otros montos
  const valores = [...new Set(parecen.map((m) => m.n))];
  const m0 = parecen[0];
  const fila = { viejo: valores.join(' / $'), ctx: contexto(m0.t, m0.i) };
  if (valores.length > 1) return { ...fila, estado: 'ambigua' };
  const viejo = valores[0];
  const nuevo = Number.isInteger(viejo) ? Math.round(precio) : precio;
  const dif = Math.round((precio - viejo) / viejo * 100);
  return { ...fila, viejoN: viejo, nuevo, dif, estado: Math.abs(dif) > UMBRAL_EXTREMO ? 'extrema' : 'aplicar' };
}

const filas = [];
for (const p of posts) {
  const precio = Number(p.price);
  if (p.editorialReview) {
    const r = evaluar([p.editorialReview], precio);
    if (r) filas.push({ ...r, p, campo: 'editorialReview' });
  }
  if (Array.isArray(p.faqs) && p.faqs.length) {
    const r = evaluar(p.faqs.flatMap((f) => [f.question, f.answer]), precio);
    if (r) filas.push({ ...r, p, campo: 'faqs' });
  }
}
for (const f of filas) if (f.estado === 'extrema' && INCLUIR.has(f.p.slug)) f.estado = 'aplicar';
for (const f of filas) {
  const motivo = NO_ES_EL_PRECIO[`${f.p.slug}|${f.campo}`];
  if (motivo) { f.estado = 'otro'; f.ctx = `${motivo} · ${f.ctx}`; }
}

const orden = { aplicar: 0, extrema: 1, ambigua: 2, otro: 3 };
filas.sort((a, b) => orden[a.estado] - orden[b.estado] || Math.abs(b.dif || 0) - Math.abs(a.dif || 0));
const de = (e) => filas.filter((f) => f.estado === e);
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

console.log(`posts: ${posts.length} · a aplicar: ${de('aplicar').length} · extremas: ${de('extrema').length} · ambiguas: ${de('ambigua').length}`);
for (const c of ['editorialReview', 'faqs']) console.log(`  ${c}: ${filas.filter((f) => f.campo === c && f.estado === 'aplicar').length} a aplicar`);

const tabla = (lista, conNuevo) => [
  conNuevo ? '| slug | campo | dice | queda | dif | contexto |' : '| slug | campo | dice | vigente | contexto |',
  conNuevo ? '|---|---|---|---|---|---|' : '|---|---|---|---|---|',
  ...lista.map((f) => conNuevo
    ? `| ${f.p.slug} | ${f.campo} | $${f.viejo} | $${fmt(f.nuevo)} | ${f.dif > 0 ? '+' : ''}${f.dif}% | ${f.ctx} |`
    : `| ${f.p.slug} | ${f.campo} | $${f.viejo} | $${f.p.price} | ${f.ctx} |`),
];
const md = [
  `# Backfill del precio en editorialReview y faqs — ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} ${new Date().toISOString().slice(0, 10)}`,
  '',
  `${de('aplicar').length} a aplicar · ${de('extrema').length} extremas (>${UMBRAL_EXTREMO}%) · ${de('ambigua').length} ambiguas (dos montos que parecen el precio).`,
  '',
  '"Parece el precio" es una inferencia: monto a no mas del 50% del vigente. Leer el contexto: si es el precio de una opcion, sacarla.',
  '',
  '## A aplicar', '', ...tabla(de('aplicar'), true), '',
  '## Extremas: no se aplican solas', '', ...tabla(de('extrema'), true), '',
  '## Ambiguas: no se aplican', '', ...tabla(de('ambigua'), false), '',
  '## No es el precio del tour (leido a mano): no se aplican', '', ...tabla(de('otro'), false), '',
];
const REPORTE = 'backfill-precio-resena-faqs.md';
fs.writeFileSync(REPORTE, md.join('\n'));
console.log(`Reporte: tour-importer/${REPORTE}`);

if (!EXECUTE) { console.log('\nDRY — nada escrito. --execute para aplicar.'); process.exit(0); }

// Un patch por tour, con los dos campos juntos: ifRevisionId fallaria en el segundo si van separados.
const porTour = new Map();
for (const f of de('aplicar')) (porTour.get(f.p._id) || porTour.set(f.p._id, []).get(f.p._id)).push(f);
let ok = 0, fallos = 0;
for (const lista of porTour.values()) {
  const p = lista[0].p, set = {};
  for (const f of lista) {
    if (f.campo === 'editorialReview') set.editorialReview = replacePriceInText(p.editorialReview, f.viejoN, f.nuevo).text;
    else set.faqs = p.faqs.map((q) => ({ ...q, question: replacePriceInText(q.question, f.viejoN, f.nuevo).text, answer: replacePriceInText(q.answer, f.viejoN, f.nuevo).text }));
  }
  try { await sanity.patch(p._id).ifRevisionId(p._rev).set(set).commit(); ok++; }
  catch (e) { fallos++; console.log(`  fallo ${p.slug}: ${e.message}`); }
}
console.log(`\n✅ ${ok} tours escritos · ${fallos} fallos`);
