// bold-key-data.js - Pass DETERMINISTICO de negritas estructurales sobre el body ya regenerado.
// NO usa modelo. Negrita datos/estructura por seccion:
//   - Quick Answer : primera aparicion de precio ($X) y duracion (N hours/minutes).
//   - Best For     : el tipo de viajero (lo que va antes del guion en cada bullet).
//   - The Itinerary: horarios (6:20am) y duraciones.
// Seguro: solo toca bloques de TEXTO PLANO (sin marks ni markDefs), idempotente (no re-negrita
// lo ya negritado), cada seccion guardada. Sirve standalone Y como ultimo paso de regenerate.
//
// CLI:
//   node bold-key-data.js --slug=<slug> --dry-run     # cuenta cambios, no escribe
//   node bold-key-data.js --slug=<slug> --execute     # aplica en Sanity
//   node bold-key-data.js --all --execute             # todo el catalogo (reanudable)

import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const sanity = createClient({
  projectId: config.sanity.projectId, dataset: config.sanity.dataset,
  token: config.sanity.token, apiVersion: '2024-01-01', useCdn: false,
});

const key = () => Math.random().toString(36).slice(2, 12);
const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');
const blockText = b => (b.children || []).map(c => c.text || '').join('');

// Solo bloques de texto plano: sin markDefs y todos los spans sin marks. Garantiza idempotencia
// (si ya tiene un strong, se saltea) y que no pisamos links ni bold previo.
function isPlainBlock(b) {
  return b && b._type === 'block' && Array.isArray(b.children) &&
    (!b.markDefs || b.markDefs.length === 0) &&
    b.children.every(c => c._type === 'span' && (!c.marks || c.marks.length === 0));
}

// Reconstruye los children: texto plano + spans 'strong' en los rangos dados (merge de solapados).
function rebuildSpans(text, ranges) {
  const valid = ranges.filter(([s, e]) => Number.isInteger(s) && Number.isInteger(e) && s >= 0 && e <= text.length && s < e);
  if (!valid.length) return null;
  valid.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of valid) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const spans = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) spans.push({ _type: 'span', _key: key(), marks: [], text: text.slice(pos, s) });
    spans.push({ _type: 'span', _key: key(), marks: ['strong'], text: text.slice(s, e) });
    pos = e;
  }
  if (pos < text.length) spans.push({ _type: 'span', _key: key(), marks: [], text: text.slice(pos) });
  return spans;
}

// Aplica negritas a un bloque (si es plano y hay rangos). Devuelve bloque nuevo o el original.
function boldBlock(b, ranges) {
  if (!isPlainBlock(b) || !ranges || !ranges.length) return b;
  const text = blockText(b);
  const spans = rebuildSpans(text, ranges);
  return spans ? { ...b, children: spans } : b;
}

// --- matchers ---
const PRICE = /\$\d[\d,]*(?:\.\d+)?/;
const DURATION = /\b\d+(?:\.\d+)?(?:\s?[-\u2013]\s?\d+(?:\.\d+)?)?[\s-]*(?:hours?|hrs?|minutes?|mins?)\b/i;
const TIME = /\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/i;
const DASH = /\s[\u2014\u2013-]\s/; // " — " / " – " / " - "
const PROPER = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g; // 2+ palabras Capitalizadas (lugares)

function firstMatch(text, re) {
  const m = new RegExp(re.source, re.flags.replace('g', '')).exec(text);
  return m ? [[m.index, m.index + m[0].length]] : [];
}
function allMatches(text, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const out = []; let m;
  while ((m = g.exec(text))) { if (m[0].length) out.push([m.index, m.index + m[0].length]); if (m.index === g.lastIndex) g.lastIndex++; }
  return out;
}

// Rango de bloques de contenido de una seccion (excluye el heading). null si no existe.
function sectionContentRange(body, nameIncludes) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes(nameIncludes));
  if (idx === -1) return null;
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return [idx + 1, end];
}

function processQuickAnswer(body) {
  const r = sectionContentRange(body, 'quick answer'); if (!r) return 0;
  let n = 0;
  for (let i = r[0]; i < r[1]; i++) {
    if (!isPlainBlock(body[i])) continue;
    const text = blockText(body[i]);
    const ranges = [...firstMatch(text, PRICE), ...firstMatch(text, DURATION)];
    if (ranges.length) { body[i] = boldBlock(body[i], ranges); n++; }
  }
  return n;
}

// Negrita el lead antes del guion en cada bullet de una seccion (Best For y What You'll See
// usan la misma estructura "Lugar/Tipo — descripcion"). Los que ya tienen bold se saltean (no plain).
function processDashBullets(body, nameIncludes) {
  const r = sectionContentRange(body, nameIncludes); if (!r) return 0;
  let n = 0;
  for (let i = r[0]; i < r[1]; i++) {
    const b = body[i];
    if (!isPlainBlock(b) || b.listItem !== 'bullet') continue;
    const text = blockText(b);
    const m = text.match(DASH);
    if (m && m.index > 1) { body[i] = boldBlock(b, [[0, m.index]]); n++; }
  }
  return n;
}

function processItinerary(body) {
  const r = sectionContentRange(body, 'itinerary'); if (!r) return 0;
  let n = 0;
  for (let i = r[0]; i < r[1]; i++) {
    if (!isPlainBlock(body[i])) continue;
    const text = blockText(body[i]);
    const ranges = [...allMatches(text, TIME), ...allMatches(text, DURATION), ...allMatches(text, PROPER)];
    if (ranges.length) { body[i] = boldBlock(body[i], ranges); n++; }
  }
  return n;
}

export async function boldKeyDataForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(
    `*[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0]{ _id, "slug": slug.current, body }`,
    { slug }
  );
  if (!tour?._id) return { ok: false, reason: 'not-found', slug };

  const body = (tour.body || []).map(b => ({ ...b }));
  let counts;
  try {
    counts = { quickAnswer: processQuickAnswer(body), bestFor: processDashBullets(body, 'best for'), whatYoullSee: processDashBullets(body, 'what you'), itinerary: processItinerary(body) };
  } catch (e) {
    return { ok: false, reason: 'bold-error', slug, error: e.message };
  }
  const changed = counts.quickAnswer + counts.bestFor + counts.whatYoullSee + counts.itinerary;
  const out = { ok: true, slug, counts, changed };
  if (dryRun || !changed) { out.dryRun = dryRun; return out; }
  await sanity.patch(tour._id).set({ body }).commit();
  return out;
}

export async function fetchBoldSlugs({ limit = 1000 } = {}) {
  const rows = await sanity.fetch(
    `*[_type == "post" && !(_id in path("drafts.**")) && defined(body)] | order(getYourGuideData.reviewCount desc) [0...${limit}]{ "slug": slug.current }`
  );
  return (rows || []).map(r => r.slug);
}

// Export de las funciones puras para test/uso.
export const _internals = { isPlainBlock, rebuildSpans, boldBlock, processQuickAnswer, processDashBullets, processItinerary, sectionContentRange };

async function main() {
  const args = process.argv.slice(2);
  const ONE_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null;
  const ALL = args.includes('--all');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);
  const DRY_RUN = !args.includes('--execute');
  const DONE_FILE = './bold-key-data-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  if (!ONE_SLUG && !ALL) { console.error('Usá --slug=<slug> o --all. Sin --execute es DRY RUN.'); process.exit(1); }
  console.log(`\nBOLD KEY DATA  |  ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : `  |  limit: ${LIMIT}`}\n`);

  const slugs = ONE_SLUG ? [ONE_SLUG] : await fetchBoldSlugs({ limit: LIMIT });
  let ok = 0, skip = 0, err = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && !DRY_RUN && done.includes(slug)) continue;
    try {
      const r = await boldKeyDataForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); skip++; continue; }
      console.log(`${DRY_RUN ? 'preview' : 'bolded'}: ${slug}  QA:${r.counts.quickAnswer} BestFor:${r.counts.bestFor} See:${r.counts.whatYoullSee} Itin:${r.counts.itinerary}`);
      if (!DRY_RUN) { done.push(slug); fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2)); await new Promise(res => setTimeout(res, 150)); }
      ok++;
    } catch (e) { console.error(`ERROR ${slug}: ${e.message}`); err++; }
  }
  console.log(`\nDone. ${DRY_RUN ? 'preview' : 'bolded'}: ${ok}, skip: ${skip}, err: ${err}${DRY_RUN ? '  - nada escrito' : ''}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
