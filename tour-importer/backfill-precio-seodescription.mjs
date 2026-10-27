// backfill-precio-seodescription.mjs — lasvegastour.com
// Una sola vez: alinea el precio citado en la seoDescription con tourInfo.price (el que pone el cron de Viator).
// Hace falta porque el cron solo reemplaza cuando el precio CAMBIA, y estas descripciones ya quedaron atras.
// De aca en adelante las mantiene cron-prices.mjs.
//
// Uso:
//   node backfill-precio-seodescription.mjs                       (DRY: lista, no escribe)
//   node backfill-precio-seodescription.mjs --execute             (escribe las que no son extremas)
//   node backfill-precio-seodescription.mjs --execute --incluir=slug1,slug2   (suma extremos revisados a mano)
//
// Reglas:
//   - Solo posts publicados, no discontinued, con activeOnGyg != false.
//   - Solo descripciones con UN monto en dolares: el reemplazo no es ambiguo.
//   - Ya alineada = el monto difiere menos de $1 del precio (asi se escriben los redondeos: $926 por 925.68).
//   - Formato: si la descripcion tenia entero, se escribe redondeado; si tenia decimales, con 2 decimales.
//   - Diferencia > 50%: NO se aplica sola. Puede ser que la descripcion cite otra cosa (una opcion, un tramo).
//   - Escribe SOLO seoDescription, con ifRevisionId: si el cron toco el doc en el medio, ese tour falla y no pisa nada.
//   - Idempotente: una segunda corrida no encuentra nada que cambiar.

import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import fs from 'fs';
import { formatPrice } from './precio-en-texto.mjs';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const INCLUIR = new Set(((args.find((a) => a.startsWith('--incluir=')) || '').split('=')[1] || '').split(',').filter(Boolean));
const UMBRAL_EXTREMO = 50; // %

const sanity = createClient({
  projectId: 'kabmqky1', dataset: 'production',
  apiVersion: '2023-05-03', token: process.env.SANITY_API_TOKEN, useCdn: false,
});

const RE_MONTO = /\$(\d[\d,]*(?:\.\d+)?)(?!\d)/g;

const posts = await sanity.fetch(`*[_type=="post" && discontinued != true && activeOnGyg != false && defined(tourInfo.price) && !(_id in path("drafts.**"))]{
  _id, _rev, title, "slug": slug.current, seoDescription, "price": tourInfo.price
}`);

const filas = [];
let multi = 0, sinMonto = 0;
for (const p of posts) {
  const montos = [...(p.seoDescription || '').matchAll(RE_MONTO)];
  if (!montos.length) { sinMonto++; continue; }
  if (montos.length > 1) { multi++; continue; }
  const [crudo, num] = montos[0];
  const viejo = Number(num.replace(/,/g, ''));
  const precio = Number(p.price);
  if (Math.abs(viejo - precio) < 1) continue; // ya alineada
  const nuevoMonto = Number.isInteger(viejo) ? String(Math.round(precio)) : formatPrice(precio);
  const nueva = p.seoDescription.replace(crudo, () => '$' + nuevoMonto);
  const dif = Math.round((precio - viejo) / viejo * 100);
  const extremo = Math.abs(dif) > UMBRAL_EXTREMO;
  filas.push({ ...p, viejo, nuevoMonto, nueva, dif, extremo, aplicar: !extremo || INCLUIR.has(p.slug) });
}
filas.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif));

// ── reporte ──
const aAplicar = filas.filter((f) => f.aplicar);
const extremos = filas.filter((f) => f.extremo && !f.aplicar);
console.log(`posts: ${posts.length} · sin monto: ${sinMonto} · con 2+ montos (fuera de alcance): ${multi}`);
console.log(`desalineadas: ${filas.length} · a aplicar: ${aAplicar.length} · extremas para revisar a mano: ${extremos.length}\n`);

const md = [
  `# Backfill del precio en seoDescription — ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} ${new Date().toISOString().slice(0, 10)}`,
  '',
  `${filas.length} desalineadas · ${aAplicar.length} a aplicar · ${extremos.length} extremas (>${UMBRAL_EXTREMO}%) para revisar a mano.`,
  '',
  '## Extremas: no se aplican solas',
  '',
  '| slug | dice | vigente | dif | descripción actual |',
  '|---|---|---|---|---|',
  ...extremos.map((f) => `| ${f.slug} | $${f.viejo} | $${f.price} | ${f.dif > 0 ? '+' : ''}${f.dif}% | ${f.seoDescription} |`),
  '',
  '## A aplicar',
  '',
  '| slug | dice | queda | dif |',
  '|---|---|---|---|',
  ...aAplicar.map((f) => `| ${f.slug} | $${f.viejo} | $${f.nuevoMonto} | ${f.dif > 0 ? '+' : ''}${f.dif}% |`),
  '',
];
const REPORTE = 'backfill-precio-seodescription.md';
fs.writeFileSync(REPORTE, md.join('\n'));
console.log(`Reporte: tour-importer/${REPORTE}`);

if (!EXECUTE) { console.log('\nDRY — nada escrito. --execute para aplicar.'); process.exit(0); }

let ok = 0, fallos = 0;
for (const f of aAplicar) {
  try {
    await sanity.patch(f._id).ifRevisionId(f._rev).set({ seoDescription: f.nueva }).commit();
    ok++;
  } catch (e) {
    fallos++; console.log(`  fallo ${f.slug}: ${e.message}`);
  }
}
console.log(`\n✅ ${ok} seoDescription escritas · ${fallos} fallos`);
