// inject-experience.js - Genera "The Experience": el itinerario NARRADO en prosa rica.
// Reemplaza las dos secciones flacas - "The Itinerary" (una linea por renglon) y
// "What You'll See" (bullets) - por UN bloque de prosa con profundidad, corpus-grounded,
// con la voz del skill advisor-prose-system (embebida via advisor-voice.js).
//
// CLI: node inject-experience.js [--slug=...] [--dry-run] [--limit=N]
// Modulo: import { injectExperienceForSlug } from './inject-experience.js'

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sourceForTour } from './factsheet-source.js';
import { ADVISOR_PROSE, PROSE_SHAPE, BANNED_SUPERLATIVES, COMPARISON_CUES, SOURCE_NARRATION } from './advisor-voice.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const HEADING = '### 🗺️ The Experience';
const HEADING_SHOW = '### 🎭 The Experience';
const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 800;

// ============================================================================
//  MARCOS EDITORIALES (frames) - rotan el ANGULO de apertura y el cierre,
//  NUNCA la voz. Seleccion deterministica por hash del slug (reproducible),
//  filtrada por compatibilidad: los condicionales solo entran si el tour es
//  de ese tipo. Los cierres son DIRECTIVAS de angulo, NO frases a copiar.
// ============================================================================
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// applies() conservador sobre el factsheet: si dudamos, el condicional NO entra
// (solo universales) - nunca forzamos un marco que no calza.
const has = (src, words) => { const t = src.toLowerCase(); return words.some(w => t.includes(w)); };
const hasTiers = src => has(src, ['skywalk', 'helicopter', 'heli ', 'airplane', 'pontoon', 'zipline']);
const isAdventure = src => has(src, ['atv', 'kayak', 'raft', 'zipline', 'zip line', 'off-road', 'off road', 'jet ski', 'horseback', 'paddle', 'dune buggy', 'mountain bike']);
const isLongCoach = src => has(src, ['coach', 'air-conditioned', 'air conditioned', 'hotel pickup', 'sit-down']) && has(src, ['hour']);

const FRAMES = [
  // --- UNIVERSALES (entran siempre) ---
  { id: 'time', cond: null,
    open: 'TIME is the organizing fact. Open on how the day\'s hours actually split - how much is real time at the destination versus transit and setup - and let that proportion frame everything.',
    closes: [
      'the trade-off of time: the hours at the destination are what the long transit buys',
      'what the time on site is worth, set against the journey to reach it',
      'the plain trade - more hours moving, fewer to plan, someone else at the wheel',
    ] },
  { id: 'access', cond: null,
    open: 'ACCESS is the organizing fact. Open on what this tour lets you reach, enter or see that is hard or impossible on your own - the land, the interior, the permit, the vantage - and treat the transport as the means, not the point.',
    closes: [
      'the point is not the transport, it is the access',
      'you are paying for entry to something hard to recreate on your own',
      'the route matters less than what it unlocks',
    ] },
  { id: 'logistics', cond: null,
    open: 'LOGISTICS is the organizing fact. Open on how the day actually runs - the pickup, the timing, the transfers, the gates or rules that shape it - so the reader sees how the machine works before what it shows.',
    closes: [
      'what you are paying for is the operation handled, not the sights themselves',
      'the day runs on timing more than on scenery',
      'the value is in not having to arrange any of it yourself',
    ] },
  { id: 'value', cond: null,
    open: 'VALUE is the organizing fact. Open on the money - what the base price actually covers and what it does not - and read the day through what is included versus what costs extra.',
    closes: [
      'the base gets you there; the extras decide how deep you go',
      'the price covers the access; what you add shapes the experience',
      'what you are buying is convenience first, the experiences second',
    ] },
  { id: 'place', cond: null,
    open: 'PLACE is the organizing fact. Open on where you end up and what it is like to be there - the canyon, the slot, the skyline from above - and let the logistics serve the destination.',
    closes: [
      'the day is a frame around one place; everything else is how you get there and back',
      'you are buying the hours in that spot, not the miles to reach it',
      'the destination carries the day; the rest is just the toll',
    ] },
  { id: 'rhythm', cond: null,
    open: 'RHYTHM is the organizing fact. Open on the shape and pace of the day - a long contemplative haul or a short compressed burst - and how the time on site feels against the rest.',
    closes: [
      'know which half you are really booking: the short fixed window, or the long day around it',
      'the pace is the product, by design',
      'what you are buying is the shape of the day as much as the place',
    ] },
  // --- CONDICIONALES (solo si el tour es de ese tipo) ---
  { id: 'upgrade', cond: hasTiers,
    open: 'THE TIER DECISION is the organizing fact. Open on the fact that this is really one tour sold in several versions, and that what you choose - not whether you go - defines the day.',
    closes: [
      'one tour, several versions: the choice is how far in you go, not whether',
      'the base gets you there; the tier decides what the day becomes',
      'the decision is not whether to book, it is which version to book',
    ] },
  { id: 'adventure', cond: isAdventure,
    open: 'THE ACTIVITY is the organizing fact. Open on the physical thing you actually do - the ride, the climb, the water - what it demands, with the rest of the booking built around it.',
    closes: [
      'you are paying for the doing, not the seeing - weigh it on that',
      'the activity is short and fixed; the rest is getting you cleared to do it',
      'the real question is whether the time in motion is worth the half-day around it',
    ] },
  { id: 'comfort', cond: isLongCoach,
    open: 'COMFORT is the organizing fact. Open on what makes this an easy day - someone else driving, the air-conditioned coach, the meals handled - and what that convenience is worth against doing it yourself.',
    closes: [
      'what you are really buying is not having to drive, plan or queue',
      'the premium is the convenience; the sights you could reach yourself',
      'it is the easy version of a day you could do harder and cheaper',
    ] },
];

// Hash del slug -> marco compatible; segundo hash -> uno de sus angulos de cierre.
function pickFrame(slug, src) {
  const pool = FRAMES.filter(f => !f.cond || f.cond(src));
  const frame = pool[cyrb53(slug, 1) % pool.length];
  const close = frame.closes[cyrb53(slug, 2) % frame.closes.length];
  return { frame, close };
}

function buildPrompt(tour, src, frame, close) {
  return `You are the Intercoper Curator Team writing for lasvegastour.com ("Reviewed. Compared. Selected." - a specialist publication, not a catalog). "The Experience" is the HEART of the page. Write it as if answering one question: what am I actually buying with this day?

Write EXACTLY this, in markdown, and nothing else:

${HEADING}
[A CITABLE opening sentence: factually, on its own, what the day is - the format, the main place, the duration, the base price, from the facts.

THEN three short flowing paragraphs (about 190-210 words total) built around THIS ANGLE:
${frame.open}

Across them, still COVER the following - in whatever order the angle above makes natural, NOT a fixed sequence: how the day goes and how the time splits between destination and transit; what the visitor sees and does, with real place names ANCHORED to their function (e.g. "Eagle Point, built around the glass Skywalk over the drop"), never a bare list of proper nouns and never function with the name stripped out; and how the product is built - what the base price includes and what, if anything, sits on top as paid tiers, and the decision that leaves the buyer.

CLOSE in the spirit of THIS reading - write your OWN closing line, fitted to this exact tour, growing out of the prose. Do NOT copy the example wording; it only shows the ANGLE to land: "${close}".

About 70% explanation-and-reading, ~30% raw figures. Continuous prose, never bullets. Bold 1-2 load-bearing figures or readings.]

${ADVISOR_PROSE}

${PROSE_SHAPE}

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source):
${src}

Respond with ONLY the header and the prose.`;
}

// === RAMA SHOW: un show no es una salida con itinerario, es lo que pasa en escena. ===
const isShowPerformer = src => has(src, ['starring', 'mentalist', 'magician', 'magic show', 'illusionist', 'hypnotist', 'comedian', 'stand-up', 'stand up', 'ventriloquist', 'impersonat', 'tribute', 'mind reading', 'mind-reading']);

const FRAMES_SHOW = [
  { id: 'stage', cond: null,
    open: 'THE SCENES are the organizing fact. Open on the actual acts and moments you watch unfold on stage - the specific set pieces, in the order or shape they take - so the reader sees the show itself, not a description of one.',
    closes: [
      'what you are buying is the time in that room, scene by scene',
      'the show is the moments on stage, nothing more and nothing less',
      'you are paying for what happens in front of you, act by act',
    ] },
  { id: 'spectacle', cond: null,
    open: 'THE PRODUCTION is the organizing fact. Open on the scale of the staging - the theater built for it, the water, the rigging, the effects - the physical machine that makes the show possible.',
    closes: [
      'the spectacle is the point, and it does not tour',
      'what you are paying for is a scale of production fixed to this room',
      'the machinery is as much the show as the performers',
    ] },
  { id: 'arc', cond: null,
    open: 'THE ARC is the organizing fact. Open on how the show moves from its first minutes to its last - what it builds toward - so the reader feels the shape of the night, not a flat list of acts.',
    closes: [
      'you are buying a built arc, not a variety bill',
      'the show is shaped to land somewhere, and that shape is the product',
      'what carries the night is where it goes, not just what is in it',
    ] },
  { id: 'craft', cond: isShowPerformer,
    open: 'THE PERFORMER is the organizing fact. Open on who is on that stage and what they actually do - the act itself, the skill on display - with the room built around them.',
    closes: [
      'you are paying to watch one performer work, up close',
      'the act is the product, the venue just frames it',
      'what you are buying is the person on that stage doing the thing',
    ] },
];

function pickFrameShow(slug, src) {
  const pool = FRAMES_SHOW.filter(f => !f.cond || f.cond(src));
  const frame = pool[cyrb53(slug, 1) % pool.length];
  const close = frame.closes[cyrb53(slug, 2) % frame.closes.length];
  return { frame, close };
}

function buildPromptShow(tour, src, frame, close) {
  return `You are the Intercoper Curator Team writing for lasvegastour.com ("Reviewed. Compared. Selected." - a specialist publication, not a catalog). "The Experience" for a SHOW is short and concentrated: a show is not a day out with an itinerary, it is what happens on stage. Do NOT pad it to tour length.

Write EXACTLY this, in markdown, and nothing else:

${HEADING_SHOW}
[A CITABLE opening sentence: factually, on its own, what the show is - the format, the venue, the running time, the base ticket price, from the facts.

THEN ONE dense, flowing paragraph (about 90-120 words; the opening citable sentence above is separate and NOT counted) built around THIS ANGLE:
${frame.open}

In that paragraph, COVER only what belongs to a show - in whatever order the angle makes natural: what actually happens ON STAGE, with real elements ANCHORED (e.g. "an indoor drone sequence", "synchronized divers above and below the water"), never a bare list of adjectives and never vague praise; the FORMAT and scale of the production and the theater it plays in; and the running time. Do NOT cover transit, hotel pickup, or paid upgrade tiers - those belong to other sections, leave them out entirely. A simpler show (a single performer, a tribute or small-room act) should run to the SHORTER end - stop once the stage is described, and never pad a thin show with credentials, ratings or repetition to fill the count.

CLOSE in the spirit of THIS reading - write your OWN closing line, fitted to this exact show, growing out of the prose. Do NOT copy the example wording, it only shows the ANGLE to land: "${close}".

About 70% description-and-reading, ~30% raw figures. Continuous prose, never bullets. Bold 1-2 load-bearing figures or readings.]

${ADVISOR_PROSE}

${PROSE_SHAPE}

THIS SHOW:
Title: ${tour.title}

Facts established for this show (your ONLY source):
${src}

Respond with ONLY the header and the prose.`;
}

// --- Guard: empty superlatives + comparacion + narracion-de-fuente + cifras inventadas ---
function findViolations(text) {
  const hits = [];
  for (const re of [...BANNED_SUPERLATIVES, ...COMPARISON_CUES, ...SOURCE_NARRATION]) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

const NUM = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
const TRAVEL_FIGURE = new RegExp(
  `\\b(?:roughly |about |around |approximately |nearly |over |under )?(${NUM})[\\s-]?(hour|hours|hr|hrs|minute|minutes|min|mins|mile|miles|km|kilometer|kilometers|foot|feet|ft)\\b`,
  'ig'
);
const WORD2DIGIT = { one:'1', two:'2', three:'3', four:'4', five:'5', six:'6', seven:'7', eight:'8', nine:'9', ten:'10', eleven:'11', twelve:'12' };
const DIGIT2WORD = Object.fromEntries(Object.entries(WORD2DIGIT).map(([w, d]) => [d, w]));
const UNIT_FAMILY = {
  hour: ['hour','hours','hr','hrs'], minute: ['minute','minutes','min','mins'],
  mile: ['mile','miles'], km: ['km','kilometer','kilometers'], foot: ['foot','feet','ft'],
};
function unitFamily(u) {
  u = u.toLowerCase();
  if (['hour','hours','hr','hrs'].includes(u)) return UNIT_FAMILY.hour;
  if (['minute','minutes','min','mins'].includes(u)) return UNIT_FAMILY.minute;
  if (['mile','miles'].includes(u)) return UNIT_FAMILY.mile;
  if (['foot','feet','ft'].includes(u)) return UNIT_FAMILY.foot;
  return UNIT_FAMILY.km;
}
function figureInSource(numTok, unit, src) {
  const t = numTok.toLowerCase().replace(/,/g, '');   // normaliza miles: "4,000" -> "4000"
  const nums = new Set([t]);
  if (/^\d/.test(t)) { if (DIGIT2WORD[t]) nums.add(DIGIT2WORD[t]); }
  else if (WORD2DIGIT[t]) nums.add(WORD2DIGIT[t]);
  const numAlt = [...nums].map(n => n.replace('.', '\\.')).join('|');
  const unitAlt = unitFamily(unit).join('|');
  const srcN = src.replace(/(\d),(?=\d{3}\b)/g, '$1'); // quita comas de miles en el source
  return new RegExp(`\\b(?:${numAlt})[\\s-]?(?:${unitAlt})\\b`, 'i').test(srcN);
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
  if (marketing.length) fixes.push(`Remove these empty-superlative / comparison / source-narration phrases and their tone: ${marketing.join(', ')}.`);
  if (figures.length) fixes.push(`These figures are NOT supported by the facts - remove each or restate without the number: ${figures.join(', ')}.`);
  const prompt = `The markdown below is the "The Experience" narrative of a travel page. It must be rich flowing prose grounded only in real facts, never an empty-superlative brochure, must not compare to any unnamed tour, must not narrate its own source, and must state no number the facts don't support.

Apply these fixes, keeping every supported FACT intact, the citable opening sentence, the flowing narrative form, and the 1-2 strategic **bold** phrases. Introduce no new facts. Keep the exact "${HEADING}" header.

${fixes.map(f => '- ' + f).join('\n')}

SECTION:
${sectionMd}

Respond with ONLY the corrected markdown.`;
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

// --- Portable Text helpers ---
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

// Quita una seccion por nombre (heading hasta el proximo heading). Devuelve si removio.
function removeSectionByName(body, nameIncludes) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes(nameIncludes));
  if (idx === -1) return { body, removed: false };
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return { body: [...body.slice(0, idx), ...body.slice(end)], removed: true };
}

// Consolida: elimina The Experience (idempotente) + The Itinerary + What You'll See,
// e inserta el nuevo bloque donde estaban (antes de la primera ancla estable).
function consolidate(body, newBlocks) {
  let b = body;
  for (const name of ['the experience', 'the itinerary', 'what you']) {
    let r; do { r = removeSectionByName(b, name); b = r.body; } while (r.removed);
  }
  let at = -1;
  for (const f of ['practical info', 'best for', 'insider tip', 'faq', 'compare']) {
    at = b.findIndex(x => isHeading(x) && headingText(x).toLowerCase().includes(f));
    if (at !== -1) break;
  }
  if (at === -1) at = b.length;
  return { body: [...b.slice(0, at), ...newBlocks, ...b.slice(at)], at };
}

// ============================================================================
//  API del modulo
// ============================================================================
export async function injectExperienceForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0] {
      _id, title, "slug": slug.current, body, getYourGuideUrl, "categorySlug": category->slug.current
    }
  `, { slug });
  if (!tour?._id) return { ok: false, reason: 'not-found-or-no-body', slug };

  const src = sourceForTour(tour);
  const sourceText = src.text;
  if (sourceText.replace(/\s/g, '').length < 80) return { ok: false, reason: 'source-too-thin', slug };

  const isShow = tour.categorySlug === 'shows';
  const { frame, close } = isShow ? pickFrameShow(slug, sourceText) : pickFrame(slug, sourceText);
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: isShow ? buildPromptShow(tour, sourceText, frame, close) : buildPrompt(tour, sourceText, frame, close) }],
  });
  let sectionMd = msg.content[0].text.trim();

  let marketing = findViolations(sectionMd);
  let figures = findUnsourcedFigures(sectionMd, sourceText);
  const figuresCaught = figures;
  const marketingCaught = marketing;
  let rewritten = false;
  if (marketing.length || figures.length) {
    sectionMd = await correctiveRewrite(sectionMd, { marketing, figures });
    rewritten = true;
    marketing = findViolations(sectionMd);
    figures = findUnsourcedFigures(sectionMd, sourceText);
  }
  const residual = [...marketing, ...figures];

  const newBlocks = markdownToBlocks(sectionMd);
  const { body: newBody, at } = consolidate(tour.body || [], newBlocks);
  const words = sectionMd.replace(/[#*]/g, '').split(/\s+/).filter(Boolean).length;

  const out = {
    ok: true, slug, rewritten, origin: src.origin,
    frame: frame.id, close,
    figuresCaught, marketingCaught,
    residualViolations: residual, existed: true,
    words,
    before: (tour.body || []).length, after: newBody.length,
    nextHeading: newBody[at + newBlocks.length] ? headingText(newBody[at + newBlocks.length]) : '(end)',
    sectionMd,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody }).commit();
  return out;
}

export async function fetchExperienceSlugs({ limit = 500 } = {}) {
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
  const SLUGS_LIST = args.find(a => a.startsWith('--slugs='))?.split('=')[1]?.split(',').map(s => s.trim()).filter(Boolean) || null;
  const DONE_FILE = './inject-experience-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  console.log(`\nINJECT "The Experience"  |  model: ${MODEL}  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = SLUGS_LIST ? SLUGS_LIST : (ONE_SLUG ? [ONE_SLUG] : await fetchExperienceSlugs({ limit: LIMIT }));
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0, flagged = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && !SLUGS_LIST && done.includes(slug)) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectExperienceForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      const flag = r.residualViolations.length ? `  ⚠ RESIDUAL: ${r.residualViolations.join(', ')}` : '';
      if (r.residualViolations.length) flagged++;
      const caught = [...(r.figuresCaught || []), ...(r.marketingCaught || [])];
      const guardLine = caught.length ? `\nGUARD caught: [${caught.join(', ')}] -> rewrote${r.residualViolations.length ? '' : ' | clean'}` : '';
      if (DRY_RUN) {
        preview += `\n========================================\n${slug}  | frame: ${r.frame} | origin: ${r.origin} | words: ${r.words} | rewritten: ${r.rewritten}${flag}${guardLine}\nINSERT before: "${r.nextHeading}"\n---- section ----\n${r.sectionMd}\n`;
        console.log(`preview: ${slug}  [${r.frame}]  (${r.words} words, ${r.origin})${flag}`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (${r.words} words, rewritten: ${r.rewritten})${flag}`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-experience-preview.md', preview);
    console.log(`\nPreview -> inject-experience-preview.md  (ok: ${okCount}, flagged: ${flagged}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, flagged: ${flagged}, errors: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
