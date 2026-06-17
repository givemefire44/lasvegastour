// inject-at-a-glance.js - Tabla de hechos "Tour at a Glance" como bloque simpleTable real.
// DETERMINISTICA: construye las filas desde el corpus (no usa modelo) -> exacta, citable, gratis,
// sin riesgo de invento. Se inserta arriba, despues del Quick Answer. Idempotente.
//
// CLI:
//   node inject-at-a-glance.js --slug=<slug> --dry-run    # muestra filas + JSON del bloque
//   node inject-at-a-glance.js --slug=<slug> --execute    # inserta en Sanity
//   node inject-at-a-glance.js --all --limit=20 --dry-run
//
// Seguro por defecto: sin --execute es DRY RUN.

import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProduct } from './corpus.js';
import { codeFromUrl } from './factsheet-source.js';
import { fetchSectionSlugs } from './inject-extras.js';

const sanity = createClient({
  projectId: config.sanity.projectId, dataset: config.sanity.dataset,
  token: config.sanity.token, apiVersion: '2024-01-01', useCdn: false,
});

const key = () => Math.random().toString(36).slice(2, 12);
const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');

// ---------- builders deterministicos de filas ----------
function pickupLabel(raw) {
  const t = raw?.logistics?.travelerPickup?.pickupOptionType;
  const map = {
    PICKUP_EVERYONE: 'Hotel pickup included',
    PICKUP_AND_MEET_AT_START_POINT: 'Hotel pickup or meet at start',
    MEET_EVERYONE_AT_START_POINT: 'Meet at the start point',
    PICKUP_AND_MEET_AT_DEPARTURE_POINT: 'Pickup or meet at departure point',
  };
  return t ? (map[t] || null) : null;
}
function ageSummary(bands) {
  if (!Array.isArray(bands) || !bands.length) return null;
  const has = b => bands.some(x => x.ageBand === b);
  if (has('INFANT') || has('CHILD')) return 'All ages (infants ride as lap children)';
  const adult = bands.find(b => b.ageBand === 'ADULT') || bands[0];
  return adult?.startAge != null ? `Ages ${adult.startAge}+` : null;
}
function groupLabel(bands) {
  const adult = (bands || []).find(b => b.ageBand === 'ADULT') || (bands || [])[0];
  return adult?.maxTravelersPerBooking ? `Up to ${adult.maxTravelersPerBooking} per booking` : null;
}
function physicalLabel(additionalInfo) {
  const types = (additionalInfo || []).map(a => (typeof a === 'string' ? '' : a.type)).filter(Boolean);
  if (types.includes('PHYSICAL_DEMANDING')) return 'Demanding';
  if (types.includes('PHYSICAL_MEDIUM')) return 'Moderate';
  if (types.includes('PHYSICAL_EASY')) return 'Easy (all fitness levels)';
  return null;
}
function optionsLabel(raw) {
  const n = (raw?.productOptions || []).length;
  return n > 1 ? `${n} options` : null;
}
function cancelLabel(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b24\s*hour/.test(t)) return 'Free up to 24 hours before';
  if (/non[- ]?refundable|all sales final|no refund/.test(t)) return 'Non-refundable';
  return 'See cancellation policy';
}

const CUR = { USD: '$', EUR: '€', GBP: '£' };
const money = (cur, n) => `${CUR[cur || 'USD'] || (cur + ' ')}${n}`;
const commas = n => Number(n).toLocaleString('en-US');
const LANG = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', zh: 'Chinese', ja: 'Japanese', ru: 'Russian', ko: 'Korean' };

function languagesLine(raw) {
  const lg = raw?.languageGuides;
  if (!Array.isArray(lg) || !lg.length) return null;
  const names = [...new Set(lg.map(g => LANG[String(g.language || '').toLowerCase()] || g.language).filter(Boolean))];
  return names.length ? names.join(', ') : null;
}

// Construye las filas [label, value] presentes (orden de prioridad).
function buildRows(p, isShow = false) {
  const raw = p.raw || {};
  const candidates = [
    ['Duration', p.duration || null],
    ['Price (from)', p.price != null ? `${money(p.currency, p.price)} per person` : null],
    ['Departure', pickupLabel(raw)],
    ['Ages', ageSummary(raw.pricingInfo?.ageBands)],
    ['Group size', groupLabel(raw.pricingInfo?.ageBands)],
    ['Physical level', physicalLabel(p.additionalInfo)],
    ['Languages', languagesLine(raw)],
    ['Options', optionsLabel(raw)],
    ['Operator', p.supplier || null],
    ['Cancellation', cancelLabel(p.cancellationText)],
    ['Rating', p.rating != null ? `${p.rating}/5 (${commas(p.reviewCount ?? 0)} reviews)` : null],
  ];
  let rows = candidates.filter(([, v]) => v);
  if (isShow) {
    const dropForShows = new Set(['Departure', 'Group size', 'Physical level', 'Languages', 'Options']);
    rows = rows.filter(([label]) => !dropForShows.has(label));
  }
  return rows;
}

function tableBlock(rows, isShow = false) {
  return {
    _type: 'simpleTable',
    _key: key(),
    title: isShow ? 'Show at a Glance' : 'Tour at a Glance',
    rows: rows.map(([label, value]) => ({ _key: key(), cells: [label, String(value)] })),
  };
}

// Quita cualquier "Tour at a Glance" previo (idempotencia): el simpleTable y un posible heading suelto.
function stripExisting(body) {
  return (body || []).filter(b => {
    if (b._type === 'simpleTable' && /at a glance/i.test(b.title || '')) return false;
    if (isHeading(b) && /at a glance/i.test(headingText(b))) return false;
    return true;
  });
}

// Inserta el bloque despues de la seccion Quick Answer (o, si no hay, antes del primer heading / al inicio).
function insertAfterQuickAnswer(body, block) {
  const qaIdx = body.findIndex(b => isHeading(b) && /quick answer/i.test(headingText(b)));
  if (qaIdx !== -1) {
    let end = body.length;
    for (let i = qaIdx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
    return [...body.slice(0, end), block, ...body.slice(end)];
  }
  const firstHeading = body.findIndex(isHeading);
  const at = firstHeading === -1 ? 0 : firstHeading;
  return [...body.slice(0, at), block, ...body.slice(at)];
}

export async function injectAtAGlanceForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(
    `*[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0]{ _id, "slug": slug.current, body, getYourGuideUrl, "category": category->slug.current }`,
    { slug }
  );
  if (!tour?._id) return { ok: false, reason: 'not-found', slug };

  const code = codeFromUrl(tour.getYourGuideUrl);
  const product = code ? getProduct(code) : null;
  if (!product) return { ok: false, reason: 'not-in-corpus', slug, code };

  const isShow = tour.category === 'shows';
  const rows = buildRows(product, isShow);
  if (rows.length < 3) return { ok: false, reason: 'too-few-facts', slug, rows: rows.length };

  const block = tableBlock(rows, isShow);
  const cleaned = stripExisting(tour.body || []);
  const newBody = insertAfterQuickAnswer(cleaned, block);

  const out = { ok: true, slug, code, rows, block, before: (tour.body || []).length, after: newBody.length };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody }).commit();
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const ONE_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null;
  const SLUGS = args.find(a => a.startsWith('--slugs='))?.split('=')[1]?.split(',').map(x => x.trim()).filter(Boolean) || null;
  const ALL = args.includes('--all');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);
  const DRY_RUN = !args.includes('--execute');
  const DONE_FILE = './inject-at-a-glance-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  if (!ONE_SLUG && !SLUGS && !ALL) { console.error('Usá --slug=<slug>, --slugs=a,b,c o --all. Sin --execute es DRY RUN.'); process.exit(1); }
  console.log(`\nAT A GLANCE  |  ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION (escribe Sanity)'}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : `  |  limit: ${LIMIT}`}\n`);

  const slugs = SLUGS ? SLUGS : (ONE_SLUG ? [ONE_SLUG] : await fetchSectionSlugs({ limit: LIMIT }));
  let preview = '', okCount = 0, skip = 0, errCount = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && !SLUGS && done.includes(slug)) { continue; }
    try {
      const r = await injectAtAGlanceForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); skip++; continue; }
      if (DRY_RUN) {
        const table = r.rows.map(([l, v]) => `   ${l.padEnd(16)} ${v}`).join('\n');
        preview += `\n======== ${slug} ========\n${table}\n\n[simpleTable block]\n${JSON.stringify(r.block, null, 2)}\n`;
        console.log(`preview: ${slug}  (${r.rows.length} filas)`);
      } else {
        done.push(slug); fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`inserted: ${slug}  (${r.rows.length} filas)`);
        await new Promise(res => setTimeout(res, 300));
      }
      okCount++;
    } catch (e) { console.error(`ERROR ${slug}: ${e.message}`); errCount++; }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-at-a-glance-preview.md', preview.trim() + '\n');
    console.log(`\nPreview -> inject-at-a-glance-preview.md  (ok: ${okCount}, skip: ${skip}, err: ${errCount})  - NADA escrito en Sanity`);
  } else {
    console.log(`\nDone. insertadas: ${okCount}, skip: ${skip}, err: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
