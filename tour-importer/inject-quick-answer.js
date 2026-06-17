
// inject-quick-answer.js - CLI + modulo.
// CLI:    node inject-quick-answer.js [--dry-run] [--limit=N] [--slug=...]
// Modulo: import { injectQuickAnswerForSlug } from '../inject-quick-answer.js'
//         await injectQuickAnswerForSlug(slug)
//
// Reemplaza la seccion "Quick Answer" (el answer-block que citan los motores de IA)
// por una version PLANA y FACTUAL con voz advisor, generada por Opus 4.8 y alimentada
// UNICAMENTE con los hechos del resto del body. A diferencia de why-book NO usa
// rotacion de angulos (el answer-block quiere forma estable y citable) y tiene un
// guard de longitud <=500 caracteres. Idempotente. Mismo patron que inject-worth-it.js.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sourceForTour } from './factsheet-source.js';

const MODEL = 'claude-opus-4-8';            // prosa redactada = el modelo mas fuerte
const REWRITE_MODEL = 'claude-opus-4-8';    // correctivo del guard
const MAX_CHARS = 500;                      // tope del answer-block

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// --- Prompt: answer-block plano y factual, voz advisor, todo desde la fuente ---
function buildQuickAnswerPrompt(tour, sourceText) {
  return `You are the lead travel advisor for lasvegastour.com. The site's promise is "Reviewed. Compared. Selected." - it is a FILTER, not a catalog. The "Quick Answer" is the most important block on the page: the self-contained question-and-answer that search and AI engines quote, and the first thing a reader sees. Getting the QUESTION to match how real travelers search, and the FIRST sentence to answer it head-on, is what makes an engine quote THIS page instead of a competitor's.

Output EXACTLY this, in markdown, and nothing else:

QUESTION: <the question - see rules below>
### 💡 Quick Answer
[ONE paragraph, exactly 3 sentences, UNDER 500 characters total. Structure:
 (1) OPEN by answering the QUESTION head-on and self-containedly, then fold in the key numbers - duration, the tour type, the departure city, and the price per person. Bold the duration, the price, and the city.
 (2) What you actually do on it, in plain order, drawn only from the facts.
 (3) Who it is best for - an honest, concrete profile, not a sales pitch.]

THE QUESTION - the single biggest lever for getting THIS page cited. Build it in TWO steps, IN ORDER:
 1) FILTER by answerability: discard every question the facts below cannot answer in full. This is a hard gate, not a ranking - if the facts don't settle it, it's out.
 2) RANK the survivors by SEARCH INTENT and pick the highest. This is the question a traveler who is close to booking THIS tour actually types into Google or asks an AI. Do NOT fall back to the easiest or most generic question just because it is simple to answer. A distinctive, high-intent question this tour can answer - an included star feature, the hook that makes someone pick THIS one over the rest, a decisive logistic - beats a generic "how long", UNLESS for this specific tour the generic one truly is what people most search. In particular, "does it include hotel pickup?" and generic logistics are the LOWEST-value questions - a near-last resort. Only ask about hotel pickup when the tour has no star feature, no distinctive "what you see", and no notable duration or inclusion worth asking about, OR when getting there is genuinely the decisive concern (a remote, far-from-Vegas tour). If the tour has ANY distinctive hook, ask about that instead. A high-intent question is still worth asking when the honest answer is "no" or "only as a paid add-on" - that honesty is exactly what gets cited.

How people actually ask about tours (a map of common phrasings - pick what fits THIS tour, never a checklist):
 - duration:     "How long is {tour}?"
 - inclusions:   "What's included in {tour}?"
 - star feature: "Does {tour} include the Skywalk?", "Does the helicopter tour land at the bottom?"
 - logistics (LOW priority - last resort only, see note in step 2): "Does {tour} include hotel pickup?", "Where does {tour} start?"
 - definition (ONLY proper-noun names people search - shows, named attractions): "What is {name} about?"

Hard rules for the question:
 - Use the NATURAL short name of the tour, not the raw title. Condense "Grand Canyon West Eagle Point Bus Tour Optional Upgrades" to "the Grand Canyon West bus tour".
 - Correct grammar and articles. Proper-noun names (shows, "The Sphere") take NO leading "the": "What is Cirque du Soleil 'O' about?"
 - NEVER ask "is it worth it" (another block owns that). NEVER compare to other tours.
 - Under ~12 words. Sound like a real typed search, not a marketing headline.
 - Ask ONLY what the facts below answer.

VOICE - advisor, not marketing:
- Plain and factual, like an expert summarizing the tour for someone deciding. Let the facts carry it.
- DELETE-THE-ADJECTIVE TEST: if a sentence still says something true after deleting an adjective, cut the adjective. "rustic cabins" survives (a fact); "authentic ranch accommodation" does not.
- Prefer commas or short sentences over em-dashes.
- BANNED marketing register (never use these or close variants): authentic, atmosphere, vibe, immersive, ultimate, unforgettable, breathtaking, stunning, magical, iconic, frontier, Old West, adventure of a lifetime, soak in, soak up, nestled, gateway, "full [anything] experience", "extended [anything] experience", "the complete experience".

SOURCING - assert only what the facts support:
- Use ONLY the facts under "Facts established" below. If the data does not state it, do not write it - even if it might be true.
- Do NOT invent operational details (exact times, minutes, mileage, headcounts) not present below.
- Do NOT compare to any other tour, and do NOT claim it is the only / best / rare option unless the facts say so.

THIS TOUR:
Title: ${tour.title}

Facts established for this tour (your ONLY source):
${sourceText}

Output the QUESTION line first, then the Quick Answer block. Nothing else. Keep the paragraph under 500 characters.`;
}

// --- Guard determinístico: marketing/comparacion + cifras inventadas + longitud ---
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
// Exige numero PEGADO a unidad de viaje en la fuente (ej "48 hours"), no el numero suelto.
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

// Longitud del parrafo (sin el header, sin los ** de bold).
function paragraphLen(sectionMd) {
  return sectionMd.replace(/^###.*$/m, '').replace(/\*\*/g, '').trim().length;
}

async function correctiveRewrite(sectionMd, { marketing = [], figures = [], tooLong = false }) {
  const fixes = [];
  if (marketing.length) fixes.push(`Remove these marketing/comparison phrases and their tone: ${marketing.join(', ')}.`);
  if (figures.length) fixes.push(`These travel times/distances are NOT supported by the facts - remove each figure: state it qualitatively or omit it, never keep an unsupported number: ${figures.join(', ')}.`);
  if (tooLong) fixes.push(`The paragraph is over ${MAX_CHARS} characters - tighten it to under ${MAX_CHARS}, keeping the lead facts (duration, price, city) and the "best for" profile.`);
  const prompt = `The markdown below is a travel site's "Quick Answer" block - the self-contained, citable answer to "what is this tour?". It must be plain and factual, never marketing, must not compare this tour to any other, must not state numbers the facts don't support, and must stay under ${MAX_CHARS} characters.

Apply these fixes, keeping every supported FACT intact. Introduce no new facts. Keep the exact "### 💡 Quick Answer" header, bold the duration, price and city, and keep it to 3 sentences.

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

// --- Portable Text helpers (mismos que inject-worth-it / why-book) ---
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

// Reemplaza la seccion "Quick Answer" (header + parrafo) por newBlocks.
// Si no existe, la inserta antes de "By the Numbers" (o antes del primer header).
function replaceQuickAnswerSection(body, newBlocks) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('quick answer'));
  if (idx === -1) {
    const bn = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('by the numbers'));
    const firstH = body.findIndex(isHeading);
    const at = bn !== -1 ? bn : (firstH !== -1 ? firstH : body.length);
    return { body: [...body.slice(0, at), ...newBlocks, ...body.slice(at)], existed: false };
  }
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return { body: [...body.slice(0, idx), ...newBlocks, ...body.slice(end)], existed: true };
}

// ============================================================================
//  API del modulo: procesa UN tour por slug (published).
// ============================================================================
export async function injectQuickAnswerForSlug(slug, { dryRun = false } = {}) {
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
    max_tokens: 500,
    messages: [{ role: 'user', content: buildQuickAnswerPrompt(tour, sourceText) }],
  });
  let sectionMd = msg.content[0].text.trim();

  // Separar la QUESTION (linea-llave que va a un campo Sanity aparte) del answer-block.
  // Se extrae ANTES del guard para que longitud/figuras operen solo sobre el parrafo.
  let question = '';
  const qMatch = sectionMd.match(/^\s*QUESTION:\s*(.+?)\s*$/im);
  if (qMatch) {
    question = qMatch[1].replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '').trim();
  }
  const hIdx = sectionMd.indexOf('###');
  if (hIdx > 0) sectionMd = sectionMd.slice(hIdx).trim();

  // Guard: marketing/comparacion + cifras inventadas + longitud. Una pasada correctiva.
  let marketing = findViolations(sectionMd);
  let figures = findUnsourcedFigures(sectionMd, sourceText);
  let tooLong = paragraphLen(sectionMd) > MAX_CHARS;
  let rewritten = false;
  if (marketing.length || figures.length || tooLong) {
    sectionMd = await correctiveRewrite(sectionMd, { marketing, figures, tooLong });
    rewritten = true;
    marketing = findViolations(sectionMd);
    figures = findUnsourcedFigures(sectionMd, sourceText);
    tooLong = paragraphLen(sectionMd) > MAX_CHARS;
  }
  const residual = [...marketing, ...figures, ...(tooLong ? [`>${MAX_CHARS} chars`] : [])];

  const newBlocks = markdownToBlocks(sectionMd);
  const { body: newBody, existed } = replaceQuickAnswerSection(tour.body || [], newBlocks);

  const out = {
    ok: true, slug, existed, rewritten, question,
    origin: src.origin,
    chars: paragraphLen(sectionMd),
    residualViolations: residual,
    before: (tour.body || []).length, after: newBody.length,
    sectionMd,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody, ...(question ? { quickAnswerQuestion: question } : {}) }).commit();
  return out;
}

export async function fetchQuickAnswerSlugs({ limit = 500 } = {}) {
  const rows = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && defined(body)] | order(getYourGuideData.reviewCount desc) [0...${limit}]{ "slug": slug.current }
  `);
  return (rows || []).map(r => r.slug);
}

// Muestra VARIADA: N tours (los mejores por reviewCount) de CADA categoria.
export async function fetchVariedSample(perCat = 3) {
  const n = Math.max(1, parseInt(perCat, 10) || 3);
  const cats = await sanity.fetch(`*[_type == "category"]{ "slug": slug.current }`);
  const out = [];
  for (const c of (cats || [])) {
    if (!c?.slug) continue;
    const rows = await sanity.fetch(
      `*[_type == "post" && !(_id in path("drafts.**")) && defined(body) && category->slug.current == $c] | order(getYourGuideData.reviewCount desc) [0...${n}]{ "slug": slug.current }`,
      { c: c.slug }
    );
    out.push(...(rows || []).map(r => r.slug));
  }
  return out;
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
  const SAMPLE = (() => {
    const a = args.find(x => x.startsWith('--sample'));
    if (!a) return null;
    const v = a.includes('=') ? parseInt(a.split('=')[1], 10) : 3;
    return Number.isFinite(v) && v > 0 ? v : 3;
  })();
  const DONE_FILE = './inject-quick-answer-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  console.log(`\nINJECT "Quick Answer"  |  model: ${MODEL}  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = SAMPLE ? await fetchVariedSample(SAMPLE) : (SLUGS ? SLUGS : (ONE_SLUG ? [ONE_SLUG] : await fetchQuickAnswerSlugs({ limit: LIMIT })));
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0, flagged = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && !SLUGS && !SAMPLE && done.includes(slug)) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectQuickAnswerForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      const flag = r.residualViolations.length ? `  ⚠ RESIDUAL: ${r.residualViolations.join(', ')}` : '';
      if (r.residualViolations.length) flagged++;
      if (DRY_RUN) {
        preview += `\n========================================\n${slug}  | origin: ${r.origin} | existed: ${r.existed} | rewritten: ${r.rewritten} | ${r.chars} chars${flag}\n---- QUESTION ----\n${r.question || "(none)"}\n---- section ----\n${r.sectionMd}\n`;
        console.log(`preview: ${slug}  Q: ${r.question || "(none)"}  (${r.chars} chars)${flag}`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (${r.chars} chars, rewritten: ${r.rewritten})${flag}`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-quick-answer-preview.md', preview);
    console.log(`\nPreview -> inject-quick-answer-preview.md  (ok: ${okCount}, flagged: ${flagged}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, flagged: ${flagged}, errors: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();