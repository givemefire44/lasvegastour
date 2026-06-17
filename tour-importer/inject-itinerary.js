
// inject-itinerary.js - CLI + modulo.
// CLI:    node inject-itinerary.js [--dry-run] [--limit=N] [--slug=...]
// Modulo: import { injectItineraryForSlug } from '../inject-itinerary.js'
//
// Reemplaza la seccion "The Itinerary" por una version PLANA y CRONOLOGICA con voz
// advisor, generada por Opus 4.8 y alimentada UNICAMENTE con los hechos del body
// (incluido el orden del itinerario actual y los stops/inclusiones). El guard de
// cifras es clave aca: los itinerarios tienden a inventar horarios/duraciones, y solo
// pasan los que esten en la fuente. Idempotente. Mismo patron que inject-worth-it.js.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sourceForTour } from './factsheet-source.js';

const MODEL = 'claude-opus-4-8';
const REWRITE_MODEL = 'claude-opus-4-8';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// --- Prompt: pasos cronologicos, planos, todo desde la fuente ---
function buildItineraryPrompt(tour, sourceText) {
  return `You are the lead travel advisor for lasvegastour.com ("Reviewed. Compared. Selected." - a FILTER, not a catalog). "The Itinerary" is a plain, factual, step-by-step account of how the day or trip actually unfolds, in order. It is reference content a traveler relies on, so it must be honest and sourced - never marketing, never invented timings.

Write EXACTLY this, in markdown, and nothing else:

### 🗺️ The Itinerary
[A chronological sequence of steps, one short sentence per line (no bullets, no numbers), in the real order they happen, from start to finish: pickup or start, each stop or activity, and the end. 5-9 lines depending on the tour. Each line plainly states what happens at that point.]

VOICE - advisor, not marketing:
- Plain and factual, like an expert walking someone through the day. Let the steps speak.
- DELETE-THE-ADJECTIVE TEST: if a line still says something true after deleting an adjective, cut the adjective.
- Prefer commas or short sentences over em-dashes.
- BANNED marketing register (never use or vary): authentic, atmosphere, vibe, immersive, ultimate, unforgettable, breathtaking, stunning, magical, iconic, frontier, Old West, adventure of a lifetime, soak in, soak up, nestled, gateway, "full [anything] experience", "the complete experience".

SOURCING - assert only what the facts support:
- Use ONLY the facts under "Facts established" below (they include the current itinerary order and the stops/inclusions). Keep the real order.
- Do NOT invent operational details - especially times, durations, minutes, mileage or headcounts - that are not stated in the facts. If the facts give a duration for a step you may use it; if they do not, describe the step without a number.
- Do NOT compare to any other tour.

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source):
${sourceText}

Respond with ONLY the header and the chronological steps.`;
}

// --- Guard determinístico: marketing/comparacion + cifras de viaje inventadas ---
const BANNED_TOKENS = [
  /\bauthentic\b/i, /\batmosphere\b/i, /\bvibe\b/i, /\bimmersive\b/i, /\bultimate\b/i,
  /\bunforgettable\b/i, /\bbreathtaking\b/i, /\bstunning\b/i, /\bmagical\b/i, /\biconic\b/i,
  /\bfrontier\b/i, /\bold west\b/i, /\bsoak (up|in)\b/i, /\bnestled\b/i, /\bgateway\b/i,
  /\badventure of a lifetime\b/i, /full [\w\s]{0,18}experience/i, /extended [\w\s]{0,18}experience/i,
  /\bcomplete experience\b/i,
];
const COMPARISON_CUES = [
  /\bmost (tours|day trips|travelers do)\b/i, /\bunlike\b/i, /\bcompared to\b/i,
  /\bother (tours|day trips)\b/i, /\btypical (tour|day trip)/i, /\bcan'?t offer\b/i,
  /\bmore than (most|other)\b/i, /\bthan (most|other) (tours|day trips)\b/i,
];
function findViolations(text) {
  const hits = [];
  for (const re of [...BANNED_TOKENS, ...COMPARISON_CUES]) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

// Cifras de viaje (horas/minutos/millas/km) que NO esten respaldadas por la fuente.
const NUM = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|\\d+(?:\\.\\d+)?)';
const TRAVEL_FIGURE = new RegExp(
  `\\b(?:roughly |about |around |approximately |nearly |over |under )?(${NUM})[\\s-]?(hour|hours|hr|hrs|minute|minutes|min|mins|mile|miles|km|kilometer|kilometers)\\b`,
  'ig'
);
const WORD2DIGIT = { one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7', eight:'8', nine:'9', ten:'10', eleven:'11', twelve:'12' };
const DIGIT2WORD = Object.fromEntries(Object.entries(WORD2DIGIT).map(([w, d]) => [d, w]));
const UNIT_FAMILY = {
  hour: ['hour','hours','hr','hrs'], minute: ['minute','minutes','min','mins'],
  mile: ['mile','miles'], km: ['km','kilometer','kilometers'],
};
function unitFamily(u) {
  u = u.toLowerCase();
  if (['hour','hours','hr','hrs'].includes(u)) return UNIT_FAMILY.hour;
  if (['minute','minutes','min','mins'].includes(u)) return UNIT_FAMILY.minute;
  if (['mile','miles'].includes(u)) return UNIT_FAMILY.mile;
  return UNIT_FAMILY.km;
}
function figureInSource(numTok, unit, src) {
  const t = numTok.toLowerCase();
  const nums = new Set([t]);
  if (/^\d/.test(t)) { if (DIGIT2WORD[t]) nums.add(DIGIT2WORD[t]); }
  else if (WORD2DIGIT[t]) nums.add(WORD2DIGIT[t]);
  const numAlt = [...nums].map(n => n.replace('.', '\\.')).join('|');
  const unitAlt = unitFamily(unit).join('|');
  return new RegExp(`\\b(?:${numAlt})[\\s-]?(?:${unitAlt})\\b`, 'i').test(src);
}
function findUnsourcedFigures(text, sourceText) {
  const src = sourceText.toLowerCase();
  const out = [];
  for (const m of text.matchAll(TRAVEL_FIGURE)) {
    if (!figureInSource(m[1], m[2], src)) out.push(m[0].trim());
  }
  return [...new Set(out.map(s => s.toLowerCase()))];
}

async function correctiveRewrite(sectionMd, { marketing = [], figures = [] }) {
  const fixes = [];
  if (marketing.length) fixes.push(`Remove these marketing/comparison phrases and their tone: ${marketing.join(', ')}.`);
  if (figures.length) fixes.push(`These travel times/distances are NOT supported by the facts - remove each figure: state the step without the number, never keep an unsupported one: ${figures.join(', ')}.`);
  const prompt = `The markdown below is a travel site's "The Itinerary" section - a plain chronological list of what happens, in order. It must be factual, never marketing, must not compare to any other tour, and must not state times or distances the facts don't support.

Apply these fixes, keeping every supported FACT and the real order intact. Introduce no new facts. Keep the exact "### 🗺️ The Itinerary" header and one short sentence per line.

${fixes.map(f => '- ' + f).join('\n')}

SECTION:
${sectionMd}

Respond with ONLY the corrected markdown.`;
  const msg = await anthropic.messages.create({
    model: REWRITE_MODEL, max_tokens: 700,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

// --- Portable Text helpers (mismos que worth-it / why-book / quick-answer) ---
const key = () => Math.random().toString(36).slice(2, 12);
const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');
const blockText = b => (b.children || []).map(c => c.text || '').join('');

function inlineToSpans(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(s => s !== '');
  const spans = parts.map(p =>
    (p.startsWith('**') && p.endsWith('**'))
      ? { _type: 'span', _key: key(), marks: ['strong'], text: p.slice(2, -2) }
      : { _type: 'span', _key: key(), marks: [], text: p }
  );
  return spans.length ? spans : [{ _type: 'span', _key: key(), marks: [], text }];
}
function markdownToBlocks(md) {
  const blocks = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('### ')) {
      blocks.push({ _type: 'block', _key: key(), style: 'h3', markDefs: [], children: [{ _type: 'span', _key: key(), marks: [], text: line.slice(4).trim() }] });
    } else if (line.startsWith('- ')) {
      blocks.push({ _type: 'block', _key: key(), style: 'normal', listItem: 'bullet', markDefs: [], children: inlineToSpans(line.slice(2).trim()) });
    } else {
      blocks.push({ _type: 'block', _key: key(), style: 'normal', markDefs: [], children: inlineToSpans(line) });
    }
  }
  return blocks;
}

// El itinerario se nutre del CORPUS (origen) via factsheet-source; fallback al body.

// Reemplaza la seccion "The Itinerary" por newBlocks. Si no existe, la inserta antes de Practical Info.
function replaceItinerarySection(body, newBlocks) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('itinerary'));
  if (idx === -1) {
    const pi = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('practical'));
    const at = pi !== -1 ? pi : body.length;
    return { body: [...body.slice(0, at), ...newBlocks, ...body.slice(at)], existed: false };
  }
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return { body: [...body.slice(0, idx), ...newBlocks, ...body.slice(end)], existed: true };
}

// ============================================================================
//  API del modulo: procesa UN tour por slug (published).
// ============================================================================
export async function injectItineraryForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0] {
      _id, title, "slug": slug.current, body, getYourGuideUrl
    }
  `, { slug });
  if (!tour?._id) return { ok: false, reason: 'not-found-or-no-body', slug };

  const src = sourceForTour(tour);
  const sourceText = src.text;
  if (sourceText.replace(/\s/g, '').length < 80) {
    return { ok: false, reason: 'source-too-thin', slug };
  }

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 900,
    messages: [{ role: 'user', content: buildItineraryPrompt(tour, sourceText) }],
  });
  let sectionMd = msg.content[0].text.trim();

  // Guard: marketing/comparacion + cifras inventadas. Una pasada correctiva.
  let marketing = findViolations(sectionMd);
  let figures = findUnsourcedFigures(sectionMd, sourceText);
  let rewritten = false;
  if (marketing.length || figures.length) {
    sectionMd = await correctiveRewrite(sectionMd, { marketing, figures });
    rewritten = true;
    marketing = findViolations(sectionMd);
    figures = findUnsourcedFigures(sectionMd, sourceText);
  }
  const residual = [...marketing, ...figures];

  const newBlocks = markdownToBlocks(sectionMd);
  const { body: newBody, existed } = replaceItinerarySection(tour.body || [], newBlocks);

  const out = {
    ok: true, slug, existed, rewritten,
    origin: src.origin,
    steps: newBlocks.filter(b => b.style === 'normal').length,
    residualViolations: residual,
    before: (tour.body || []).length, after: newBody.length,
    sectionMd,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody }).commit();
  return out;
}

export async function fetchItinerarySlugs({ limit = 500 } = {}) {
  const rows = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && defined(body)] | order(getYourGuideData.reviewCount desc) [0...${limit}]{ "slug": slug.current }
  `);
  return (rows || []).map(r => r.slug);
}

// ============================================================================
//  CLI
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = args.includes('--dry-run');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
  const ONE_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null;
  const DONE_FILE = './inject-itinerary-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  console.log(`\nINJECT "The Itinerary"  |  model: ${MODEL}  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = ONE_SLUG ? [ONE_SLUG] : await fetchItinerarySlugs({ limit: LIMIT });
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0, flagged = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && done.includes(slug)) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectItineraryForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      const flag = r.residualViolations.length ? `  ⚠ RESIDUAL: ${r.residualViolations.join(', ')}` : '';
      if (r.residualViolations.length) flagged++;
      if (DRY_RUN) {
        preview += `\n========================================\n${slug}  | origin: ${r.origin} | existed: ${r.existed} | rewritten: ${r.rewritten} | ${r.steps} steps${flag}\n---- section ----\n${r.sectionMd}\n`;
        console.log(`preview: ${slug}  (${r.origin}, ${r.steps} steps)${flag}`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (${r.steps} steps, rewritten: ${r.rewritten})${flag}`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-itinerary-preview.md', preview);
    console.log(`\nPreview -> inject-itinerary-preview.md  (ok: ${okCount}, flagged: ${flagged}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, flagged: ${flagged}, errors: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
