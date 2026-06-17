// inject-why-book-this.js - CLI + modulo.
// CLI:    node inject-why-book-this.js [--dry-run] [--limit=N] [--slug=...]
// Modulo: import { injectWhyBookThisForSlug } from '../inject-why-book-this.js'
//         await injectWhyBookThisForSlug(slug)   // regenera e inserta el parrafo en UN tour
//
// Reemplaza SOLO el parrafo de la seccion "Why People Book This" por una version
// con voz ADVISOR (no marketing), generada por Opus 4.8 y alimentada UNICAMENTE
// con los hechos ya establecidos en el resto del body (sin re-scrapear, sin tocar
// el resto). Idempotente: pisa el parrafo anterior. Mismo patron que inject-worth-it.js.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sourceForTour } from './factsheet-source.js';
import { VOICE_CORE, BANNED_SUPERLATIVES, COMPARISON_CUES, SOURCE_NARRATION } from './advisor-voice.js';

const MODEL = 'claude-opus-4-8';            // <-- prosa redactada = el modelo mas fuerte
const REWRITE_MODEL = 'claude-opus-4-8';    // correctivo del guard

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// --- Rotacion deterministica del angulo de apertura (por hash del slug) ---
// Evita 400 parrafos con el mismo esqueleto. Todos intrinsecos, no comparativos.
const OPENING_ANGLES = [
  "At its core, this tour is about",
  "The main reason people book this is",
  "What this tour is built around is",
  "People choose this for",
  "What you're booking here is",
  "The draw of this one is",
  "This tour centers on",
  "What makes people pick this is",
  "The point of this trip is",
  "What you're signing up for is",
  "Travelers book this for",
  "The heart of this tour is",
  "What sits at the center of this tour is",
  "The appeal here comes down to",
  "What you actually get out of this is",
  "Where this tour spends its time is",
];
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const pickAngle = slug => OPENING_ANGLES[cyrb53(String(slug || '')) % OPENING_ANGLES.length];

// --- Prompt: VOICE_CORE (voz compartida) + el job de Why Book (la decision del usuario) ---
const LANE_TOUR = `LANE DISCIPLINE - this section owns MOTIVATION, not logistics:
- Other sections already own the mechanics: the Itinerary owns pickup time, drive durations, mileage and the stop-by-stop route; Practical Info owns what to bring, weight/luggage rules, age and access. Do NOT re-list any of that here.
- Name at most ONE defining feature as the reason to book; do not recap the route, the schedule, or the landmarks passed. If you find yourself listing what the tour does or where it goes step by step, stop - that belongs in another section.
- Frame the appeal as a DECISION: what the traveller is really paying for, the tradeoff they accept (e.g. broad coverage versus lingering at fewer stops), or who the tour fits. Review volume or rating counts as motivation only if the facts state it.
- Do NOT claim it is the only / the best / rare / what most travellers do, unless the facts say so.
- Close on the decision, not a flat fit line: the LAST sentence should land on the real tradeoff or what the traveller is actually choosing (flexibility, depth over a rushed stop, low commitment before they see it), not a limp "it fits anyone comfortable with...".

You MAY state the real shape of the tour honestly ("the return leg is by road", "it's a two-day commitment") - but leave the buy/skip verdict to the separate verdict section.`;

const LANE_SHOW = `LANE DISCIPLINE - this section owns POSITIONING, not the show itself:
- ALWAYS call it a show (or name its format - an aquatic show, a mentalism show, a tribute show); NEVER call it a "tour". The opening angle may use the word "tour" - if it does, adapt it to "show".
- This is a show: there is no itinerary, pickup or route, so do not reach for any of that. Other sections own the rest - The Experience owns what happens on stage, Is It Worth It owns the price verdict, Practical Info owns showtimes, age policy and seating. Do NOT give a buy/skip verdict here.
- Why someone books a SHOW is about WHERE IT SITS and WHO IT IS FOR: what this show is in the crowded Vegas landscape that others are not (the format no one else has, the scale or production budget, the resident pedigree, the price point), and the audience it suits (families, couples, fans of a name, adults after a late night). Name at most ONE defining position - do not list features.
- The Experience section already paints what happens on stage. Do NOT describe the staging here: do not enumerate the performers (acrobats, divers, swimmers), how they move, or the architecture of the room. Name the FORMAT in just a few words to POSITION it ("its water stage", "a one-man mentalism act", "a Michael Jackson production") and go straight to who it is for and what they are choosing it over. If you find yourself painting the scene, stop - that is the Experience's job, not this one.
- Anchor it in the facts: only call it the only / the longest-running / the biggest if the facts say so. If the facts do not support a superlative, position it by FIT instead ("the family-safe option among adult Strip shows", "the budget end of the mentalism category") without claiming a rank.
- Close on the decision: the LAST sentence lands on who is really choosing this show and what they are choosing it over, not a limp "great for anyone who likes magic".`;

function buildWhyBookPrompt(tour, sourceText, angle) {
  const showLine = tour.category === 'shows' ? `

SHOW DISCIPLINE (this is a show): the facts are your ONLY authority on what happens on stage. Do NOT describe staging, acts, performers, scenes, or what the audience sees or does beyond what the facts explicitly state - do not fill the gap from what you happen to know about the show. You MAY use the format word the title or facts give (aquatic, magic, tribute, revue, comedy), but do not invent the scene around it. The reason to book a show lives in the OCCASION and what the format promises, not in invented stage detail.` : '';
  return `${VOICE_CORE}

THE JOB OF THIS SECTION - "Why People Book This": name the DECISION the traveller is making by booking this. Short prose in your voice: an expert who assessed this tour telling a traveller, plainly, what it is and why someone books it.

Write EXACTLY this, in markdown, and nothing else:

### 🎯 Why People Book This
[ONE paragraph, 3-4 sentences (~60-90 words). Open from the ANGLE below, adapted naturally. Give the DECISION RATIONALE: why this tour is worth someone's time or money, what tradeoff it represents, and who it suits - not a recap of the route. Bold EXACTLY TWO phrases: (1) the key figure (the price, or the defining duration) and (2) the tight clause that captures the core DECISION or tradeoff the reader is weighing - the thesis of the section, not a second data point. Never bold an adjective, and never bold a whole sentence - bold only the clause that carries the meaning.]

OPENING ANGLE (use this entry point, adapt grammar; do not default to "You get"): "${angle}"

${tour.category === 'shows' ? LANE_SHOW : LANE_TOUR}${showLine}

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source):
${sourceText}

Respond with ONLY the header and the paragraph.`;
}

// --- Guard determinístico: marketing / comparacion / narracion-de-fuente. Vocabulario centralizado en advisor-voice.js ---
function findViolations(text) {
  const hits = [];
  for (const re of [...BANNED_SUPERLATIVES, ...COMPARISON_CUES, ...SOURCE_NARRATION]) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}

// Cifras de viaje (horas/minutos/millas/km) que NO esten respaldadas por la fuente.
// Exige que el numero aparezca PEGADO a una unidad de viaje en la fuente (ej "48 hours"),
// no el numero suelto en cualquier lado (si no, el rating "4.8" daria "four" por valido).
// "two-day"/"$999"/"one night" NO se chequean (no son unidades de viaje).
const NUM = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)';
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
  if (marketing.length) fixes.push(`Remove these marketing/comparison phrases and their tone: ${marketing.join(', ')}.`);
  if (figures.length) fixes.push(`These travel times/distances are NOT supported by the facts - remove each figure: state it qualitatively ("the drive back", "an early start") or omit it. Never invent or keep an unsupported number: ${figures.join(', ')}.`);
  const prompt = `The markdown below is a travel site's "Why People Book This" section. It must read as an honest expert advisor - never marketing - must NOT compare this tour to any other, and must NOT state numbers the facts don't support.

Apply these fixes, keeping every supported FACT intact and the same approximate length. Introduce no new facts. Keep the exact "### 🎯 Why People Book This" header, bold exactly two phrases (the key figure and the decision/tradeoff clause), and prefer commas or short sentences over em-dashes.

${fixes.map(f => '- ' + f).join('\n')}

SECTION:
${sectionMd}

Respond with ONLY the corrected markdown.`;
  const msg = await anthropic.messages.create({
    model: REWRITE_MODEL, max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

// --- Portable Text helpers (mismos que inject-worth-it) ---
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

// Fuente de hechos: via factsheet-source (corpus -> origen Viator; fallback al body).

// Reemplaza la seccion "Why People Book This" (header + parrafo) por newBlocks.
// Si no existe, la inserta antes de "What You'll See".
function replaceWhyBookSection(body, newBlocks) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('why people book this'));
  if (idx === -1) {
    const wys = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes("what you'll see"));
    const at = wys !== -1 ? wys : body.length;
    return { body: [...body.slice(0, at), ...newBlocks, ...body.slice(at)], existed: false };
  }
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return { body: [...body.slice(0, idx), ...newBlocks, ...body.slice(end)], existed: true };
}

// ============================================================================
//  API del modulo: procesa UN tour por slug (published).
// ============================================================================
export async function injectWhyBookThisForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0] {
      _id, title, "slug": slug.current, body, getYourGuideUrl,
      "category": category->slug.current
    }
  `, { slug });
  if (!tour?._id) return { ok: false, reason: 'not-found-or-no-body', slug };

  const src = sourceForTour(tour);
  const sourceText = src.text;
  if (sourceText.replace(/\s/g, '').length < 80) {
    return { ok: false, reason: 'source-too-thin', slug };
  }

  const angle = pickAngle(tour.slug);
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: buildWhyBookPrompt(tour, sourceText, angle) }],
  });
  let sectionMd = msg.content[0].text.trim();

  // Guard: marketing/comparacion + cifras de viaje inventadas. Una pasada correctiva.
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
  const { body: newBody, existed } = replaceWhyBookSection(tour.body || [], newBlocks);

  const out = {
    ok: true, slug, angle, existed, rewritten,
    origin: src.origin,
    figuresCaught, marketingCaught,
    residualViolations: residual,
    before: (tour.body || []).length, after: newBody.length,
    sectionMd,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody }).commit();
  return out;
}

export async function fetchWhyBookSlugs({ limit = 500 } = {}) {
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
  const SLUGS = args.find(a => a.startsWith('--slugs='))?.split('=')[1]?.split(',').filter(Boolean) || null;
  const DONE_FILE = './inject-why-book-this-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  console.log(`\nINJECT "Why People Book This"  |  model: ${MODEL}  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = SLUGS ? SLUGS : (ONE_SLUG ? [ONE_SLUG] : await fetchWhyBookSlugs({ limit: LIMIT }));
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0, flagged = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && !SLUGS && done.includes(slug)) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectWhyBookThisForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      const flag = r.residualViolations.length ? `  ⚠ RESIDUAL: ${r.residualViolations.join(', ')}` : '';
      if (r.residualViolations.length) flagged++;
      const caught = [...(r.figuresCaught || []), ...(r.marketingCaught || [])];
      const guardLine = caught.length ? `\nGUARD caught: [${caught.join(', ')}] -> rewrote${r.residualViolations.length ? '' : ' | clean'}` : '';
      if (DRY_RUN) {
        preview += `\n========================================\n${slug}  | origin: ${r.origin} | angle: "${r.angle}" | existed: ${r.existed} | rewritten: ${r.rewritten}${flag}${guardLine}\n---- section ----\n${r.sectionMd}\n`;
        console.log(`preview: ${slug}  (${r.origin})${flag}`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (rewritten: ${r.rewritten})${flag}`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-why-book-preview.md', preview);
    console.log(`\nPreview -> inject-why-book-preview.md  (ok: ${okCount}, flagged: ${flagged}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, flagged: ${flagged}, errors: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
