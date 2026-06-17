
// inject-practical-info.js - CLI + modulo.
// CLI:    node inject-practical-info.js [--dry-run] [--limit=N] [--slug=...]
// Modulo: import { injectPracticalInfoForSlug } from './inject-practical-info.js'
//
// Reemplaza la seccion "Practical Info" por una version label-value alimentada por el
// CORPUS enriquecido (pickup/meeting, edades y grupo, weight policy, drive time each-way,
// physical level, qué llevar, cancelación). Es la seccion mas citable por AI, asi que
// todo sale de los hechos: nada de marketing, nada de cifras inventadas. Mismo patron e
// idempotencia que inject-itinerary.js. Seccion de datos -> Sonnet 4.6 (swap a Opus en 1 linea).

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sourceForTour } from './factsheet-source.js';

const MODEL = 'claude-sonnet-4-6';          // seccion de datos; para Opus: 'claude-opus-4-8'
const REWRITE_MODEL = 'claude-sonnet-4-6';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// --- Prompt: lista label-value, todo desde los hechos del corpus ---
function buildPracticalInfoPrompt(tour, sourceText) {
  return `You are the lead travel advisor for lasvegastour.com ("Reviewed. Compared. Selected." - a FILTER, not a catalog). "Practical Info" is the single most important section for AI citation: a clean, scannable list of planning facts a traveler relies on. It must be accurate and sourced - never marketing, never invented numbers.

Write EXACTLY this, in markdown, and nothing else:

### 🛡️ Practical Info
[A list of label-value lines. Each line is a bullet "- **Label:** value" with the key value in **bold**. NO emojis in the bullets. Include the UNIVERSAL lines, then add ONLY the TYPE-SPECIFIC lines that the facts below actually support for THIS tour. 5-9 lines total.]

UNIVERSAL lines (always include):
- **Departure / Pickup:** [hotel pickup if the facts say so, otherwise the meeting-point arrangement from the facts]
- **Best Time to Visit:** [type-appropriate travel guidance, e.g. early departures for day trips, night for Strip helicopter flights]
- **What to Bring:** [type-appropriate essentials, plus anything the facts explicitly require]
- **Free Cancellation:** [state the cancellation policy from the facts]
- **Booking Tip:** [practical booking guidance, e.g. book ahead in peak periods]

TYPE-SPECIFIC lines - include a line ONLY when the facts support it:
- **Drive Time:** [if the facts give a one-way drive duration, state it "each way" using that figure; do NOT compute a round-trip total]
- **Physical Level:** [from the standardized traveler facts, e.g. suitable for all fitness levels]
- **Minimum Age / Ages:** [from the age bands]
- **Weight Policy:** [only if the facts mention a weight limit or weigh-in]
- **Accessibility:** [wheelchair / stroller facts if present]
- **Good to Know:** [a key operational restriction from the facts, e.g. luggage limits, minimum passengers, tickets not accepted]

NO DUPLICATION across lines:
- Each fact appears on EXACTLY ONE line. Never state the same restriction in two places - a luggage/bag limit goes on EITHER What to Bring OR Good to Know, never both. If a value is already on one line, do not echo it on another.

VOICE - advisor, not marketing:
- Plain and factual. DELETE-THE-ADJECTIVE TEST: if a line is still true after deleting an adjective, cut it.
- BANNED marketing register (never use): authentic, atmosphere, vibe, immersive, ultimate, unforgettable, breathtaking, stunning, magical, iconic, frontier, Old West, soak in/up, nestled, gateway, "full/complete experience".
- Do NOT compare to any other tour.
- Do NOT narrate the source: never write "the facts", "the data", "the source", "according to the information". Just state the fact plainly.

SOURCING - assert only what the facts support:
- Operational values (pickup, cancellation, ages, drive time, weight policy, accessibility, restrictions) MUST come from the facts below. The few advisory lines (Best Time to Visit, Booking Tip, generic What to Bring essentials) may use standard type-appropriate travel guidance.
- Do NOT invent times, durations, minutes, mileage, headcounts or fees that are not in the facts.

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source for operational values):
${sourceText}

Respond with ONLY the header and the label-value lines.`;
}

function buildPracticalInfoPromptShow(tour, sourceText) {
  return `You are the lead advisor for lasvegastour.com ("Reviewed. Compared. Selected." - a FILTER, not a catalog). "Practical Info" is the single most important section for AI citation: a clean, scannable list of planning facts. This is a SHOW, not a tour - there is no pickup, no route, nothing to pack. It must be accurate and sourced - never marketing, never invented numbers or times.

Write EXACTLY this, in markdown, and nothing else:

### 🛡️ Practical Info
[A list of label-value lines. Each line is a bullet "- **Label:** value" with the key value in **bold**. NO emojis in the bullets. Include the UNIVERSAL show lines the facts support, then add ONLY the type-specific lines the facts below support. 4-8 lines total.]

UNIVERSAL show lines (include when supported):
- **Venue:** [the theater or showroom where it plays, taken ONLY from the title or description - e.g. "Bellagio", "V Theater at Planet Hollywood". Omit this line if the venue is not named in the facts.]
- **Showtimes:** [the days/times the show runs, ONLY if the facts state them. Do NOT invent times or days. If the facts give no schedule, omit this line entirely.]
- **Ages:** [the minimum age from the age bands, e.g. "Ages 5+"]
- **Free Cancellation:** [the cancellation policy from the facts]
- **Booking Tip:** [practical booking guidance - book ahead for weekends and holidays; choose your seating category at checkout]

TYPE-SPECIFIC show lines (include ONLY when the facts support it):
- **Seating:** [the ticket or seating categories offered, BY NAME, taken from the OPTIONS in the facts - e.g. "Category 1, Category 2 and VIP, by location in the theater". Do NOT state a price per category - per-seat prices are NOT in the facts. Omit this line if the facts list no options.]
- **Dress Code:** [only if the facts mention one]
- **Accessibility:** [wheelchair / access facts if present]
- **Good to Know:** [a key operational note from the facts - e.g. no latecomer admission, photography rules, an age restriction beyond the minimum]

DO NOT INCLUDE (these are tour lines, not show lines): Departure/Pickup, Best Time to Visit, What to Bring, Drive Time, Physical Level, Weight Policy. A show has no pickup and nothing to pack.

NO DUPLICATION: each fact on EXACTLY ONE line. Do NOT repeat the running time here (it is in the table); do not echo a value already on another line.

VOICE - advisor, not marketing:
- Plain and factual. DELETE-THE-ADJECTIVE TEST: if a line is still true after deleting an adjective, cut it.
- BANNED register (never use): authentic, atmosphere, vibe, immersive, ultimate, unforgettable, breathtaking, stunning, magical, iconic, spectacular, world-class, "full/complete experience".
- Do NOT compare to any other show. Do NOT narrate the source ("the facts", "the data", "according to"). NEVER call this a "tour" - it is a show.

SOURCING - assert only what the facts support:
- Operational values (venue, showtimes, ages, cancellation, seating categories, accessibility) MUST come from the facts below. The advisory line (Booking Tip) may use standard guidance.
- Do NOT invent times, dates, prices, seat prices or restrictions not in the facts.

THIS SHOW:
Title: ${tour.title}

Facts established for this show (your ONLY source for operational values):
${sourceText}

Respond with ONLY the header and the label-value lines.`;
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
// Tic de andamiaje: nombrar la fuente.
const SOURCE_NARRATION = [
  /\bthe facts\b/i, /\bthe source\b/i, /\bthe data\b/i, /\baccording to the (facts|information|data)\b/i,
];
function findViolations(text) {
  const hits = [];
  for (const re of [...BANNED_TOKENS, ...COMPARISON_CUES, ...SOURCE_NARRATION]) {
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
  if (marketing.length) fixes.push(`Remove these marketing/comparison/source-narration phrases and their tone: ${marketing.join(', ')}.`);
  if (figures.length) fixes.push(`These travel times/distances are NOT supported by the facts - remove each figure or restate the line without the number: ${figures.join(', ')}.`);
  const prompt = `The markdown below is a travel site's "Practical Info" section - a scannable list of label-value planning facts. It must be factual, never marketing, must not compare to any other tour, must not narrate its own source ("the facts"/"the data"), and must not state times or distances the facts don't support.

Apply these fixes, keeping every supported FACT intact. Introduce no new facts. Keep the exact "### 🛡️ Practical Info" header and the "- **Label:** value" line format.

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

// --- Portable Text helpers (mismos que itinerary / worth-it / why-book) ---
const key = () => Math.random().toString(36).slice(2, 12);
const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');

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

// Practical Info se nutre del CORPUS (origen) via factsheet-source; fallback al body.

// Reemplaza la seccion "Practical Info". Si no existe, la inserta antes de "Tour Format" (o FAQ, o al final).
function replacePracticalInfoSection(body, newBlocks) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('practical'));
  if (idx === -1) {
    let at = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('tour format'));
    if (at === -1) at = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('faq'));
    if (at === -1) at = body.length;
    return { body: [...body.slice(0, at), ...newBlocks, ...body.slice(at)], existed: false };
  }
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return { body: [...body.slice(0, idx), ...newBlocks, ...body.slice(end)], existed: true };
}

// ============================================================================
//  API del modulo: procesa UN tour por slug (published).
// ============================================================================
export async function injectPracticalInfoForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0] {
      _id, title, "slug": slug.current, body, getYourGuideUrl, "category": category->slug.current
    }
  `, { slug });
  if (!tour?._id) return { ok: false, reason: 'not-found-or-no-body', slug };

  const src = sourceForTour(tour);
  const sourceText = src.text;
  if (sourceText.replace(/\s/g, '').length < 80) {
    return { ok: false, reason: 'source-too-thin', slug };
  }

  const isShow = tour.category === 'shows';
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 900,
    messages: [{ role: 'user', content: isShow ? buildPracticalInfoPromptShow(tour, sourceText) : buildPracticalInfoPrompt(tour, sourceText) }],
  });
  let sectionMd = msg.content[0].text.trim();

  // Guard: marketing/comparacion/narracion-de-fuente + cifras inventadas. Una pasada correctiva.
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
  const { body: newBody, existed } = replacePracticalInfoSection(tour.body || [], newBlocks);

  const out = {
    ok: true, slug, existed, rewritten,
    origin: src.origin,
    lines: newBlocks.filter(b => b.listItem === 'bullet').length,
    residualViolations: residual,
    before: (tour.body || []).length, after: newBody.length,
    sectionMd,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody }).commit();
  return out;
}

export async function fetchPracticalInfoSlugs({ limit = 500 } = {}) {
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
  const SLUGS = args.find(a => a.startsWith('--slugs='))?.split('=')[1]?.split(',').map(x => x.trim()).filter(Boolean) || null;
  const DONE_FILE = './inject-practical-info-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  console.log(`\nINJECT "Practical Info"  |  model: ${MODEL}  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = SLUGS ? SLUGS : (ONE_SLUG ? [ONE_SLUG] : await fetchPracticalInfoSlugs({ limit: LIMIT }));
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0, flagged = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && !SLUGS && done.includes(slug)) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectPracticalInfoForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      const flag = r.residualViolations.length ? `  ⚠ RESIDUAL: ${r.residualViolations.join(', ')}` : '';
      if (r.residualViolations.length) flagged++;
      if (DRY_RUN) {
        preview += `\n========================================\n${slug}  | origin: ${r.origin} | existed: ${r.existed} | rewritten: ${r.rewritten} | ${r.lines} lines${flag}\n---- section ----\n${r.sectionMd}\n`;
        console.log(`preview: ${slug}  (${r.origin}, ${r.lines} lines)${flag}`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (${r.lines} lines, rewritten: ${r.rewritten})${flag}`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-practical-info-preview.md', preview);
    console.log(`\nPreview -> inject-practical-info-preview.md  (ok: ${okCount}, flagged: ${flagged}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, flagged: ${flagged}, errors: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
