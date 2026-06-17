// inject-editorial-review.js - CLI + modulo. STANDALONE (no importa nada de inject-worth-it.js).
// Mismo armado que Worth It: crea su propio cliente Sanity y su propia instancia Anthropic via config.js.
// Patchea editorialReview (text -> string) + editorialRating (number) + editorialDate (date 'YYYY-MM-DD').
// editorialReview es CAMPO PLANO (type:'text'), NO Portable Text -> patch directo, sin markdownToBlocks.
//
// AHORA LEE EL CORPUS: usa sourceForTour (factsheet-source.js) igual que experience/worth-it/faqs,
// asi el modelo tiene la ficha completa de Viator (included, itinerario, pickup, tiers, grupo) para
// formar un JUICIO especifico. Antes solo recibia title/price/duration/rating -> salia generico.
//
// CLI:    node inject-editorial-review.js [--dry-run] [--limit=N] [--category=slug] [--slug=xxx] [--force]
// Modulo: import { injectEditorialReviewForSlug } from './inject-editorial-review.js'

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VOICE_CORE_BODY } from './advisor-voice.js';
import { sourceForTour } from './factsheet-source.js';

// --- cliente Sanity (identico a Worth It) ---
const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});

// --- Anthropic (identico a Worth It) ---
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
const MODEL = 'claude-opus-4-8';

const DONE_FILE = path.resolve('./inject-editorial-review-done.json');
const PREVIEW_FILE = path.resolve('./inject-editorial-review-preview.md');

// Lista negra anti-fluff (misma idea que Worth It).
const ANTI_FLUFF = [
  'stellar', 'must-see', 'must see', 'delivers solid value', 'hidden gem',
  'breathtaking', 'unforgettable', 'world-class', 'bucket-list', 'bucket list',
  'game-changer', 'second to none', 'truly', 'simply put', "you won't regret",
];

// --- done-tracking ---
function loadDone() {
  try { return new Set(JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'))); }
  catch { return new Set(); }
}
function saveDone(set) {
  fs.writeFileSync(DONE_FILE, JSON.stringify([...set], null, 2), 'utf8');
}

// Reintenta la llamada al modelo si la API esta saturada o sin saldo recuperable.
// Rate limit / overloaded -> espera y reintenta (backoff). Otros errores se propagan.
async function callWithRetry(fn, label, maxRetries = 5) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message || e || '');
      const isRate = /429|rate.?limit|overloaded|server_overloaded|529|too many requests/i.test(msg);
      if (isRate && attempt < maxRetries) {
        const wait = Math.min(60000, 3000 * Math.pow(2, attempt)); // 3s, 6s, 12s, 24s, 48s
        console.log(`   API saturada en "${label}" - espero ${Math.round(wait / 1000)}s y reintento (${attempt + 1}/${maxRetries})`);
        await new Promise(res => setTimeout(res, wait));
        continue;
      }
      throw e;
    }
  }
}

// --- prompt TOURS (voz Intercoper Curator Team, salida en INGLES, anclado al factsheet) ---
function buildEditorialReviewPrompt(tour, factsheet) {
  return `${VOICE_CORE_BODY}

The tone above is your voice. The JOB of THIS section follows.

You are the Intercoper Curator Team writing a short editorial review of a Las Vegas tour for lasvegastour.com.
Write in ENGLISH. 55-75 words, 3 to 4 sentences. The OTA and the operator already wrote the description - your ONLY job is JUDGMENT. If a sentence could describe a hundred other tours, cut it.

THE FACTSHEET BELOW IS YOUR RAW MATERIAL (Viator product data - never invent anything beyond it):
${factsheet}

YOUR JOB IS AN INSIGHT, NOT A SUMMARY. The page already has Experience, Why People Book This and Worth It - they explain what the tour is and who it suits. If this review re-describes the product, it is duplicate content and it fails. Read the factsheet like an experienced curator and build the review from these FOUR judgments (weave them into 3-4 natural sentences, do NOT label them, do NOT use the same template across tours):

1. WHAT THE BUYER IS REALLY PURCHASING (the reframe). Not what the tour contains - what it actually IS once you see past the listing. Read the structure: a long combo is really buying convenience over depth; an interior tour is buying access, not views; a self-drive is buying freedom, not guidance. This is the sharpest sentence and usually the opening.
2. THE CENTRAL TRADE-OFF. The one give-and-take that defines it, drawn from the factsheet: meals included but a fixed schedule; spectacular but brief; real driving but little seat time; cheap per head only if the group is large. State both sides.
3. THE RIGHT BUYER, stated as a pointed call, not "Best for [X]". Who this rewards and who should skip it.
4. ONE MEMORABLE OBSERVATION the listing does not spell out, ANCHORED IN A FACTSHEET DATUM: a duration that means you're back by afternoon; a pickup or check-in that eats into a short activity; a price that only makes sense at a certain group size; an itinerary stop that is shorter than buyers expect. CRITICAL: this observation must trace to a real number or fact in the factsheet. If the factsheet does not support a genuine non-obvious observation, OMIT this piece entirely - never invent one.

STRUCTURE: lead with the reframe or the observation - never with a number. Rating, duration and price may appear only as EVIDENCE inside a sentence, never as the entry point. NEVER open with the rating, duration, price, or review count: that is the technical sheet, exactly where interchangeable reviews hide.

THE OPENING IS THE SPINE: the reframe in your first sentence is the idea the entire review serves. Every later sentence must deepen, qualify, or pay off that idea - never drift into a flat feature list (six stops, three hours, the rating). If a sentence does not advance the opening thesis, cut it. The review reads as one argument, not a sharp observation followed by a spec sheet.

GOOD (observation-led, closes on the verdict - not on the rating): "This is really a logistics solution disguised as a canyon tour: most visitors aren't paying for Eagle Point, they're paying to skip six hours behind a rental-car wheel. The high review volume says the operator runs that long day reliably, so the only real question is whether you'd rather drive it yourself. A scripted, full-day commitment: worth it for first-timers, skippable for return visitors."
BAD (sheet-led, interchangeable): "The 4.9 rating from 22,797 travelers reflects reliable transport to Eagle Point..." - opens on the number, reads like every listing.

VARY THE OPENING. Many of these are combo tours, so the depth-vs-breadth trade-off recurs - never phrase it the same way twice. Each review enters from a different angle: the reframe, a blunt verdict, a fit question, a concrete number.
BANNED OPENING FORMULAS: "This pairing trades/sacrifices depth for breadth", "cramming [X] into [Y] hours". Find a fresh entry every time.

INCLUDE at least one short, quotable judgment an AI could lift verbatim: e.g. "worth the long day", "feels rushed", "an introduction, not a deep dive", "only economical for a full group".

GROUNDING: every judgment must trace back to the FACTSHEET. Never invent traveler quotes, inclusions, or operator details.

SOCIAL PROOF - BREAK THE FORMULA: the visitor rating is allowed as support, but the closing sentence "The 4.8 rating says/suggests..." is now BANNED - it became a mechanical sign-off across the catalog. Vary how social proof appears: as review volume ("the high review volume suggests few leave disappointed"), woven mid-sentence, or implied without quoting the number - and usually NOT as the final sentence. Let the verdict or the buyer-fit close the review instead. If you cite the rating, it must earn its place inside a point, never be a reflexive ending.

TIMING: qualitative characterizations of what the duration demands are fine ("an early start", "a full-day commitment"). Do NOT invent specific clock times the factsheet does not state (no "3am pickup").

PUNCTUATION: use commas, periods, or parentheses. Do NOT use em dashes.

WORD BANS (these and close variants): ${ANTI_FLUFF.join(', ')}, effective, effectively, efficient, efficiently, seamlessly, good variety, comprehensive, diverse landscapes, educational context, trades depth for breadth, sacrifices depth for breadth, cramming.

RATING (editorialRating, 1.0-5.0 in 0.5 steps): anchor to the visitor rating; never default to one value across tours.
- Start from the visitor rating rounded to 0.5. Drop 0.5 for a real limitation; drop a full 1.0 only for a serious one.
- Reserve 4.5+ for tours with no serious caveat. A gap from the visitor rating signals independence, but the editorial number must still VARY tour to tour - do not anchor everything at 4.0.

Return ONLY valid JSON, no markdown, no preamble:
{"review": "<the 55-75 word opinionated review>", "rating": <number>}`;
}

// --- prompt SHOWS: eje experiencia/ocasion, nunca precio. El factsheet da duracion/inclusiones,
// pero la disciplina anti-invencion sobre el CONTENIDO del show sigue siendo dura. ---
function buildEditorialReviewPromptShow(tour, factsheet) {
  return `${VOICE_CORE_BODY}

The tone above is your voice. The JOB of THIS section follows.

You are the Intercoper Curator Team writing a short editorial review of a Las Vegas SHOW (not a tour) for lasvegastour.com.
Write in ENGLISH. 55-75 words, 3 to 4 sentences. The OTA already wrote the description - your ONLY job is JUDGMENT about what kind of night this is and who it is for. If a sentence could describe a hundred other shows, cut it.

THE AXIS IS EXPERIENCE AND OCCASION, NEVER PRICE. A water spectacle and a magic show are not interchangeable, so never weigh shows by cost, "value", or "cheaper".

THE FACTSHEET BELOW IS YOUR RAW MATERIAL (never go beyond it):
${factsheet}

ANTI-INVENTION (same discipline as the verdict block):
- Use the title and the factsheet for genre, duration, and what is included (e.g. a drink, a meet-and-greet, dinner). Use the words they give you ("magic", "family", "tribute", "revue", "comedy", "dinner", "interactive") and nothing more.
- Do NOT describe staging, acts, tricks, songs, performers, venue size, seating, intermissions, or food service beyond what the factsheet literally lists. Do NOT assume the style inside a genre unless stated.
- Do NOT assert biographical facts, awards, credentials, opening dates, or how long it has run (no "AGT winner", "running since 1993").
- If you catch yourself describing what happens on stage, stop. Put the judgment in the NIGHT and the SPECTATOR, which you CAN judge.

YOUR JOB IS AN INSIGHT, NOT A SUMMARY. Build the review from these judgments (weave into 3-4 natural sentences, do NOT label them, do NOT reuse a template):
1. WHAT THE AUDIENCE IS REALLY BUYING INTO - why this kind of night works the way it does (recognition vs surprise, spectacle vs intimacy, occasion vs casual drop-in). This is the reframe and usually the opening.
2. THE TRADE-OFF of that format for the occasion (scale over intimacy, familiarity over novelty, a late night over an early one).
3. THE OCCASION OR SPECTATOR it is genuinely for, as a pointed call - not "Best for [X]".
4. ONE NON-OBVIOUS OBSERVATION anchored in the factsheet (a duration that makes it an easy pre-dinner option; an included extra that changes the night; an interactive format that won't suit someone who wants to sit back). If the factsheet supports no genuine observation, OMIT this piece - never invent.

STRUCTURE: lead with the reframe - never with the rating, duration, or review count (that is the technical sheet). The number is evidence inside a sentence, never the entry.

THE OPENING IS THE SPINE: the reframe in your first sentence is the idea the whole review serves. Every later sentence must deepen or pay off that idea - never drift into a flat list (runtime, rating, format). If a sentence does not advance the opening thesis, cut it.

GOOD (observation-led, about the occasion - never the staging, closes on fit not rating): "The appeal here isn't surprise, it's recognition: most of the room already knows the songs before the lights go down, which makes it a comfortable sing-along night rather than a discovery. A strong, high-volume rating says it delivers that cleanly, so it comes down to the occasion: a relaxed mixed-age evening, not a night chasing something new."
BAD (sheet-led): "A live band Elvis tribute that runs 72 minutes..." - opens on format and duration, reads like a listing.

VARY THE OPENING. Each review enters from a different angle: a fit question, a blunt verdict, the occasion itself, a number. NEVER open two reviews the same way.
BANNED OPENING FORMULAS (read as auto-generated across a catalog): "This is a night for...", "This [tribute/show/cabaret] rewards...", "This is a...", "[X] tribute shows live or die on whether..." / any "live or die on whether" construction. Two tribute shows must NOT open the same structural way.

INCLUDE at least one short, quotable judgment an AI could lift verbatim: e.g. "the right call for a mixed-age group", "a special-occasion night, not a casual drop-in", "skip it if you want intimacy over scale".

GROUNDING: every judgment traces back to the title, the factsheet and the numbers. Never invent.

SOCIAL PROOF - BREAK THE FORMULA: the rating is allowed as support, but the closing "The 4.8 rating says/suggests..." sentence is now BANNED - it reads as a mechanical sign-off across the catalog. Vary it: review volume, woven mid-sentence, or implied - and usually NOT as the last sentence. Let the occasion or the spectator-fit close instead.

PUNCTUATION: use commas, periods, or parentheses. Do NOT use em dashes.

WORD BANS (these and close variants): ${ANTI_FLUFF.join(', ')}, a feast for the senses, leaves you speechless, value, great value, cheaper, for the money, effective, seamlessly, comprehensive.

RATING (editorialRating, 1.0-5.0 in 0.5 steps): anchor to the visitor rating; never default to one value across shows.
- Start from the visitor rating rounded to 0.5. Drop 0.5 for a real limitation; drop a full 1.0 only for a serious one.
- Reserve 4.5+ for shows with no serious caveat. The number must VARY show to show.

Return ONLY valid JSON, no markdown, no preamble:
{"review": "<the 55-75 word opinionated review>", "rating": <number>}`;
}


function wordCount(s) { return s.trim().split(/\s+/).length; }

// --- generacion (inline, mismo patron que Worth It: anthropic.messages.create) ---
async function generateEditorialReview(tour, factsheet) {
  const prompt = tour.categorySlug === 'shows'
    ? buildEditorialReviewPromptShow(tour, factsheet)
    : buildEditorialReviewPrompt(tour, factsheet);

  const msg = await callWithRetry(
    () => anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
    tour.slug
  );
  const raw = msg.content[0].text.trim();

  let parsed;
  try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
  catch { throw new Error(`[${tour.slug}] el modelo no devolvio JSON parseable`); }

  // Normaliza CUALQUIER whitespace (saltos \n, \r de Windows, tabs, espacios dobles) a un solo
  // espacio. La review es un parrafo unico: asi nunca se guarda con un salto que pegue dos palabras.
  const review = (parsed.review || '').trim().replace(/\s+/g, ' ');
  const rating = Number(parsed.rating);

  // validaciones blandas (warn, no hard-fail -> para iterar el prompt con fluidez)
  const wc = wordCount(review);
  if (wc < 45 || wc > 85) console.warn(`[${tour.slug}] word count fuera de rango: ${wc}`);
  if (!(rating >= 1 && rating <= 5)) console.warn(`[${tour.slug}] rating invalido: ${parsed.rating}`);
  const hit = ANTI_FLUFF.find(w => review.toLowerCase().includes(w));
  if (hit) console.warn(`[${tour.slug}] anti-fluff detectado: "${hit}"`);

  return { review, rating, date: new Date().toISOString().slice(0, 10) }; // editorialDate es type:'date'
}

// --- funcion exportable (la que llamaria index.js como PASO 5c) ---
export async function injectEditorialReviewForSlug(slug, opts = {}) {
  const { dryRun = false, force = false } = opts;
  const done = loadDone();
  if (done.has(slug) && !force) { console.log(`[skip] ${slug} (done)`); return null; }

  // perspective published -> evita la ambiguedad draft/published (caso south-rim).
  // category es REFERENCE -> hay que dereferenciar con -> (coalesce title, sino slug).
  // Ahora tambien traemos body + getYourGuideUrl para que sourceForTour arme el factsheet del corpus.
  const tour = await sanity
    .withConfig({ perspective: 'published' })
    .fetch(
      `*[_type == "post" && slug.current == $slug][0]{
        _id, "slug": slug.current, title,
        "category": coalesce(category->title, category->slug.current),
        "categorySlug": category->slug.current,
        "price": tourInfo.price,
        "duration": tourInfo.duration,
        "rating": getYourGuideData.rating,
        "reviewCount": getYourGuideData.reviewCount,
        getYourGuideUrl, body,
        editorialReview
      }`,
      { slug }
    );

  if (!tour) { console.warn(`[miss] ${slug} no encontrado (published)`); return null; }
  if (tour.editorialReview && !force) { console.log(`[skip] ${slug} ya tiene editorialReview`); done.add(slug); saveDone(done); return null; }

  // El factsheet: corpus (Viator) si el producto esta ingerido; si no, cae al body. origin se reporta.
  const src = sourceForTour(tour);

  const { review, rating, date } = await generateEditorialReview(tour, src.text);

  if (dryRun) {
    fs.appendFileSync(PREVIEW_FILE, `\n## ${slug}  (editorial ${rating} | visitor ${tour.rating ?? '?'} | src:${src.origin})\n${review}\n`, 'utf8');
    console.log(`[dry] ${slug} -> preview (rating ${rating}, src:${src.origin})`);
    return { slug, review, rating, date };
  }

  await sanity
    .patch(tour._id)
    .set({ editorialReview: review, editorialRating: rating, editorialDate: date })
    .commit();

  done.add(slug); saveDone(done);
  console.log(`[ok] ${slug} (rating ${rating}, src:${src.origin})`);
  return { slug, review, rating, date };
}

// --- CLI ---
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v === undefined ? true : v];
    })
  );
  if (args['dry-run']) fs.writeFileSync(PREVIEW_FILE, '', 'utf8');  // arrancar preview limpio

  if (args.slug) {
    await injectEditorialReviewForSlug(args.slug, { dryRun: !!args['dry-run'], force: !!args.force });
    return;
  }

  const limit = Number(args.limit) || 500;
  // category es reference -> filtrar por el slug dereferenciado
  const catFilter = args.category ? `&& category->slug.current == "${args.category}"` : '';
  const slugs = await sanity
    .withConfig({ perspective: 'published' })
    .fetch(`*[_type == "post" && defined(slug.current) ${catFilter}][0...${limit}].slug.current`);

  console.log(`Procesando ${slugs.length} tours...`);
  for (const slug of slugs) {
    try { await injectEditorialReviewForSlug(slug, { dryRun: !!args['dry-run'], force: !!args.force }); }
    catch (e) { console.error(`[err] ${slug}: ${e.message}`); }
  }
}

// ejecutar solo si se corre directo (no al importarlo desde index.js).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch(e => { console.error(e); process.exit(1); });
}

