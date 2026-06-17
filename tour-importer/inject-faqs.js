
// inject-faqs.js - CLI + modulo.
// CLI:    node inject-faqs.js [--dry-run] [--limit=N] [--slug=...]
// Modulo: import { injectFaqsForSlug } from '../inject-faqs.js'
//
// DISTINTO a los otros injectors: las FAQs NO viven en el body, viven en el field
// estructurado `faqs` (array {_type:'faq', question, answer}) que alimenta el schema
// FAQPage. Este injector MANTIENE las preguntas existentes y reescribe SOLO las
// respuestas en voz advisor, sourced del body, con guards de marketing + cifras.
// Patchea el field `faqs`, NO toca el body. Idempotente.

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

// --- Prompt: reescribe respuestas en voz advisor, mantiene preguntas ---
function buildFaqPrompt(tour, sourceText, questions, isShow = false) {
  const qList = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  const showLine = isShow ? `

SHOW VOCABULARY: this listing is a SHOW, not a tour. Refer to it as "the show" or "this listing"; NEVER write "the tour" or "the tour details". When a fact is missing, write "This is not stated in the listing details; confirm with the operator when booking." instead of anything with "the tour". Do NOT compare to any other show.` : '';
  return `You are the lead travel advisor for lasvegastour.com ("Reviewed. Compared. Selected." - a FILTER, not a catalog). Below are the FAQ questions for this tour and the established facts. Rewrite the ANSWER to each question in an honest advisor voice - never marketing - using only the facts. These answers feed the FAQ schema that AI engines quote, so they must be accurate and self-contained.

Keep EACH question exactly as written. Answer all of them, in the same order.

Output EXACTLY this format and nothing else, one block per question:
**Q: <the question, verbatim>**
A: <your answer>

QUESTIONS:
${qList}

VOICE - advisor, not marketing:
- Plain, direct, factual. Answer the question first, then one brief useful detail if the facts support it.
- DELETE-THE-ADJECTIVE TEST: cut any adjective that isn't carrying a fact.
- Prefer commas or short sentences over em-dashes.
- BANNED marketing register (never use or vary): authentic, atmosphere, vibe, immersive, ultimate, unforgettable, breathtaking, stunning, magical, iconic, frontier, Old West, adventure of a lifetime, soak in, soak up, nestled, gateway, "full [anything] experience", "the complete experience".

SOURCING - assert only what the facts support:
- Use ONLY the facts below. If the data does not state it, do not assert it.
- Do NOT invent operational details - times, durations, minutes, mileage, headcounts - not in the facts.
- If a question asks something the facts do not cover, answer honestly and briefly (e.g. "This isn't specified in the tour details; confirm with the operator when booking.") rather than inventing.
- Do NOT compare to any other tour.${showLine}

FACTS (your ONLY source):
${sourceText}

Respond with ONLY the Q/A blocks.`;
}

// --- Guard determinístico: marketing/comparacion + cifras inventadas ---
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

async function correctiveRewrite(blob, { marketing = [], figures = [] }) {
  const fixes = [];
  if (marketing.length) fixes.push(`Remove these marketing/comparison phrases and their tone: ${marketing.join(', ')}.`);
  if (figures.length) fixes.push(`These travel times/distances are NOT supported by the facts - remove each figure (answer without the number, or say to confirm when booking), never keep an unsupported one: ${figures.join(', ')}.`);
  const prompt = `The markdown below is a set of FAQ answers for a travel tour, in "**Q: ...?**" / "A: ..." format. The answers must be factual advisor voice, never marketing, must not compare to other tours, and must not state numbers the facts don't support.

Apply these fixes, keeping every question verbatim and every supported FACT intact. Introduce no new facts. Keep the exact "**Q: ...?**" / "A: ..." format and the same questions in the same order.

${fixes.map(f => '- ' + f).join('\n')}

FAQ BLOCKS:
${blob}

Respond with ONLY the corrected Q/A blocks.`;
  const msg = await anthropic.messages.create({
    model: REWRITE_MODEL, max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

// --- Parse de Q/A (mismo criterio que parseFaqsFromContent del pipeline) ---
function parseQA(blob) {
  const out = [];
  let q = null;
  for (const raw of blob.split('\n')) {
    const t = raw.trim();
    const qm = t.match(/\*?\*?Q:\s*(.+?\?)\*?\*?$/);
    if (qm) { q = qm[1].trim(); continue; }
    const am = t.match(/^A:\s*(.+)/);
    if (am && q) { out.push({ question: q, answer: am[1].trim() }); q = null; }
  }
  return out;
}

// --- Source: hechos del body, sin las secciones de opinion ---
const key = () => Math.random().toString(36).slice(2, 11);
const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');
const blockText = b => (b.children || []).map(c => c.text || '').join('');
// Fuente de hechos: via factsheet-source (corpus -> origen Viator; fallback al body).

// ============================================================================
//  API del modulo: procesa UN tour por slug (published).
// ============================================================================
export async function injectFaqsForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug][0] {
      _id, title, "slug": slug.current, body, getYourGuideUrl, "category": category->slug.current, faqs[]{question, answer}
    }
  `, { slug });
  if (!tour?._id) return { ok: false, reason: 'not-found', slug };

  const questions = (tour.faqs || []).map(f => f.question).filter(Boolean);
  if (!questions.length) return { ok: false, reason: 'no-existing-faqs', slug };

  const isShow = tour.category === 'shows';
  const src = sourceForTour(tour);
  const sourceText = src.text;
  if (sourceText.replace(/\s/g, '').length < 80) return { ok: false, reason: 'source-too-thin', slug };

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: buildFaqPrompt(tour, sourceText, questions, isShow) }],
  });
  let blob = msg.content[0].text.trim();

  // Guard: marketing/comparacion + cifras inventadas. Una pasada correctiva.
  let marketing = findViolations(blob);
  let figures = findUnsourcedFigures(blob, sourceText);
  let rewritten = false;
  if (marketing.length || figures.length) {
    blob = await correctiveRewrite(blob, { marketing, figures });
    rewritten = true;
    marketing = findViolations(blob);
    figures = findUnsourcedFigures(blob, sourceText);
  }
  const residual = [...marketing, ...figures];

  const parsed = parseQA(blob);
  if (!parsed.length) return { ok: false, reason: 'parse-failed', slug };
  if (parsed.length !== questions.length) residual.push(`faq-count ${parsed.length}/${questions.length}`);

  const newFaqs = parsed.map(f => ({ _type: 'faq', _key: key(), question: f.question, answer: f.answer }));

  const out = {
    ok: true, slug, rewritten,
    origin: src.origin,
    before: questions.length, after: newFaqs.length,
    residualViolations: residual,
    blob,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ faqs: newFaqs }).commit();
  return out;
}

export async function fetchFaqSlugs({ limit = 500 } = {}) {
  const rows = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && defined(body) && count(faqs) > 0] | order(getYourGuideData.reviewCount desc) [0...${limit}]{ "slug": slug.current }
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
  const DONE_FILE = './inject-faqs-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

  console.log(`\nINJECT "FAQs"  |  model: ${MODEL}  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${ONE_SLUG ? `  |  slug: ${ONE_SLUG}` : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = ONE_SLUG ? [ONE_SLUG] : await fetchFaqSlugs({ limit: LIMIT });
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0, flagged = 0;
  for (const slug of slugs) {
    if (!ONE_SLUG && done.includes(slug)) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectFaqsForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      const flag = r.residualViolations.length ? `  ⚠ RESIDUAL: ${r.residualViolations.join(', ')}` : '';
      if (r.residualViolations.length) flagged++;
      if (DRY_RUN) {
        preview += `\n========================================\n${slug}  | origin: ${r.origin} | faqs: ${r.after}/${r.before} | rewritten: ${r.rewritten}${flag}\n---- faqs ----\n${r.blob}\n`;
        console.log(`preview: ${slug}  (${r.origin}, ${r.after} faqs)${flag}`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (${r.after} faqs, rewritten: ${r.rewritten})${flag}`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-faqs-preview.md', preview);
    console.log(`\nPreview -> inject-faqs-preview.md  (ok: ${okCount}, flagged: ${flagged}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, flagged: ${flagged}, errors: ${errCount}, total done: ${done.length}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
