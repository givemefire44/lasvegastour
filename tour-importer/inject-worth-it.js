// inject-worth-it.js - CLI + modulo.
// CLI:    node inject-worth-it.js [--dry-run] [--limit=N] [--category=slug]
// Modulo: import { injectWorthItForSlug } from '../inject-worth-it.js'
//         await injectWorthItForSlug(slug)   // genera e inserta el bloque en UN tour
// Genera SOLO el bloque "Is It Worth It?" y lo inserta tras "What Makes This Tour
// Different". No re-scrapea, no toca imagenes, no regenera el resto del body.
// Idempotente: si el tour ya tiene el bloque, lo reemplaza.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VOICE_CORE_BODY } from './advisor-voice.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// --- Rotacion deterministica de la frase-pivote (por hash del slug) ---
const PIVOT_FRAMES = [
  "The appeal here isn't [one thing] - it's [another]",
  "The trade-off here is",
  "What you're really paying with here isn't money - it's",
  "The thing most listings won't tell you is",
  "What tips the decision is",
  "Where this wins, and where it doesn't, is",
  "The honest trade-off is",
  "Most people book this for the obvious reason; the real one is",
  "The catch worth knowing is",
  "Who should look elsewhere is",
  "What you give up here is",
  "What separates this from the packaged versions is",
  "What most travelers underestimate is",
  "The real question isn't whether to go - it's",
  "What this asks you to commit to is",
  "The part worth weighing is",
  "Where this quietly earns its place is",
  "The line between worth it and not, here, is",
  "What you're actually buying isn't [the obvious thing] - it's",
  "This tour makes sense when",
  "The real choice here is",
  "What this comes down to, once you cut the marketing, is",
  "The reason this works for some and not others is",
  "What changes the answer here is",
];
const SHOW_FRAMES = [
  "This is the show you choose when you want [mood/scale] - not [X], not [Y], but [what the title actually offers]",
  "This is the night for [audience] who'd rather have [one mood] than [the opposite]",
  "Book this when the night needs [a crowd-pleaser / a date / a spectacle] more than it needs [depth / novelty / intimacy]",
  "The crowd this is built for wants [one thing]; the crowd it isn't for wants [the other] - and that's the whole call",
  "This is a [date-night / family / big-group] pick first and a [genre] show second - [the mood that makes it work]",
  "What this really sells is the night, not the show - [the occasion and mood the title supports]",
  "This is what you reach for when your group spans [different tastes or ages] and still has to agree on one thing",
  "Save this for the night you want [energy or scale] over [intimacy or subtlety]",
  "The occasion this fits is [a kind of night]: [an audience] who want [a mood], not [the contrast]",
  "The reason to book this is the room it fills, not the runtime - [who's in it and why they're glad]",
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
const pickFrame = (slug, category) => {
  const pool = category === 'shows' ? SHOW_FRAMES : PIVOT_FRAMES;
  return pool[cyrb53(String(slug || '')) % pool.length];
};

// --- Prompt builders (bifurcacion lista para shows en el futuro) ---
function buildWorthItPromptTour(tour, alternatives, frame) {
  const altLines = alternatives.length
    ? alternatives.map(a => `- ${a.title} ($${a.price}, ${a.duration || 'N/A'}, ${a.rating || 'N/A'}/5)`).join('\n')
    : '(no same-type alternatives available - keep the comparison qualitative)';

  return `${VOICE_CORE_BODY}

The tone above is your voice. The JOB of THIS section follows.

You are an editor for lasvegastour.com writing the "Is It Worth It?" verdict for one tour. The promise is "Reviewed. Compared. Selected." - this block RECOMMENDS, it does not describe. The page already has a full "Experience" section that explains what the tour is, so do NOT re-explain the product or the itinerary here. Your one job is editorial JUDGEMENT: is this worth it, and for whom? Read like a human who took it telling a friend the truth, and stay citable for an AI answering "is [tour] worth it?".

THE CORE OF A GOOD VERDICT - read this before writing:
- THE AXIS IS THE BUYER, NOT THE BUDGET. Experience already explained how the tour works; Worth It explains WHO should choose it - the kind of traveler, how they behave, what they want from the day. Answer "who is this for, and who isn't", not "how much do you save".
- DESCRIBE A PERSON, AND HAVE AN OPINION. The best recommendations name a TYPE OF TRAVELER, not a feature: "this is for the informed undecided" is a verdict; "this tour is flexible" is a label. State it with conviction - it is often strongest to say what the appeal ISN'T before what it IS ("the appeal here isn't the canyon - every West Rim tour reaches the same viewpoints; the appeal is deciding at the rim, not at checkout"). A label classifies; a verdict takes a side.
- FIND THE REAL MOTIVE, NOT THE MOST VISIBLE FEATURE. If the obvious differentiator is a minor feature - an included meal, onboard WiFi - that is a CONSEQUENCE, not the reason. Nobody spends ten hours on a coach because breakfast is included. Dig for the behaviour the feature enables: "everything decided upfront" (not "meals handled"); "treating a long haul as productive time" (not "WiFi"). The thesis is the motive, never the feature.
- NEVER let "flexibility over savings" or "$X feels steep when others start at $Y" happen - that is a fare comparison, the exact failure we are avoiding. The contrast is always between PEOPLE and how they want to buy, not between prices.
- Find the REAL trade-off THIS tour turns on, and it is almost never the price. For this one it is flexibility: people book it because they don't want to decide everything at checkout, NOT because they want to save four dollars. The base ticket gets them to the rim; the rest can be decided once they're standing there. Name that behaviour, the way a friend who took it would.
- KEEP MONEY ALMOST OUT OF IT. One price anchor is the most you need. The verdict and the bullets must NOT revolve around save / cheaper / spend / markup / dollars - if the reader feels they're reading a fare comparison, you've missed it. The insight is flexibility and behaviour, not savings.
- SPEAK LIKE A TRAVELER, NOT AN ACCOUNTANT. "travelers who don't yet know how much Grand Canyon they want - the base ticket gets them to the rim, the rest can be decided once they're standing there" beats "budget-conscious visitors who don't mind spending more on upgrades than they'd save". One is emotional and behavioural; the other is financial.
- BULLETS SPEAK IN BEHAVIOUR, NOT CALCULATIONS - control, time, commitment, convenience, never percentages or arithmetic. "$21 more for 33% more adventure" reads like an Amazon review, not an advisor. A price appears in a bullet ONLY when scale itself is the decision ($99 vs $479); small gaps ($21, $56, $5) become a stated preference, not a figure.
- Do NOT open on "the cheapest" or on the rating. Worth It can be SHORT now - Experience did the explaining. Here you only answer whether it's worth it and for whom.

Output EXACTLY this structure in markdown, nothing else:

### 🤔 Is It Worth It?
**Our verdict:** [TWO or three sentences with real OPINION, not a classification. Name a TYPE OF PERSON ("this is for the informed undecided"), not a feature ("this tour is flexible"). Build your OPENING on the structure the ROTATION HINT gives you - adapt it to this exact tour and vary it; do NOT settle into one fixed opening like "the appeal isn't..." on every tour. Lead with your single sharpest insight. Bold exactly ONE decisive phrase. Behavioural and emotional, never financial; an observation, not a brochure line; do NOT re-describe the itinerary.]

**Worth it if:**
- [the buyer this fits, as behaviour - e.g. "you don't yet know how much Grand Canyon you want, and would rather decide at the rim than at checkout"]
- [another kind of traveler it suits - e.g. "you want to be driven to the West Rim but choose your own add-ons there rather than commit to a set package"]
- [another]

**Skip it if:**
- [a REAL criticism, not a soft one - a trade-off that genuinely helps someone decide against it. The sharpest skip exposes when the tour's main draw stops mattering for a given buyer: e.g. "if you already know you want the Skywalk, lunch and a flight, the low base price stops meaning much - you'll rebuild a premium package anyway, and a set bundle is simpler and often cheaper." Be CONCRETE about why a NAMED alternative suits THAT buyer - simpler, more predictable, sometimes cheaper if they'd buy it all anyway - NEVER the empty abstraction "it handles the decision-making for you". Compare ONLY against what a real buyer weighs (another tour, a set package), NEVER "rent a car and drive yourself".]
- [another]

**Choose this over [most relevant named alternative below] if:**
- [a sharp contrast that takes a side, not a description. "you dislike paying for meals and extras you may never use" or "flexibility matters more to you than having everything pre-arranged" beats "you'd rather customize your day". State the preference that tips the decision.]

ROTATION HINT - the OPENING STRUCTURE for this verdict. Build your first sentence on this shape, filled with THIS tour's specifics; adapt it naturally, fill any [bracketed] placeholder with the real thing, never quote it mechanically, and never let it steer toward price: "${frame}"

HARD RULES:
- BANNED phrases (never use - they sound auto-generated): "delivers solid value", "solid value", "great value", "good value", "value for money", "stellar", "must-see", "unforgettable", "breathtaking", "world-class".
- Avoid the verb "deliver/delivering" and the crutch "knock out". Vary verbs across tours.
- Do NOT invent operational facts not in the data below: exact pickup times ("3am"), flight minutes, mileage, departure hours, headcounts. If an early start matters, say it qualitatively ("a pre-dawn pickup", "an early start"). Use real numbers ONLY when given above.
- Every "Worth it if" / "Skip it if" line is a STRONG, real reason or pain - never a feature, never filler. GOOD: "you'd rather sit on a coach than drive 500 miles yourself", "you want to leave the casinos behind for a few hours", "getting fed during a 10+ hour day matters more than researching lunch stops". BAD: "coach tour socializing appeals to you", "you enjoy guided experiences".
- Price almost never belongs in a bullet. Cite a figure ONLY when the gap is large enough to BE the decision - a different category of purchase, like $99 vs $479. For small gaps ($5, $21, $56), do NOT cite the number; turn it into a preference ("you'd rather pay a little more for the flexibility"). When you do cite a gap, it must be the exact real figure against a NAMED alternative, never a vague range like "$50+ more".
- Be willing to reach an uncomfortable conclusion about FIT: if a different kind of traveler would clearly be better served by a NAMED alternative, say so plainly ("if you already know you want everything, a set package fits you better"). Frame it as who-it's-for, not as chasing the cheapest option.
- BUT independence must be EARNED by data, never speculative. You only have price, duration, rating and category - you do NOT know what each tour includes or its route. Say two tours look similar "on paper" or "by the numbers"; do NOT assert they are "essentially the same experience" as fact.
- Do NOT attribute inclusions to an alternative (breakfast, WiFi, meals, hotel pickup, guide) unless those exact words appear in that alternative's title above.
- Take a clear position. Do NOT hedge into "it depends on your preferences".
- BOLD FOR SCANNABILITY (do this - the block reads flat and washed-out without it): In "Our verdict", bold the single decisive figure or comparison (e.g. **$56 less**). In EACH "Worth it if" / "Skip it if" / "Choose this over" bullet that names a hard figure - a price ($94), a duration (10+ hours), a distance (500+ miles) - wrap THAT figure in **bold** (in a price contrast, bold both, e.g. **$94** vs **$150**). Bold the number or price ONLY, never an adjective or the whole line; a bullet with no hard figure stays plain. The "**" around the labels themselves stays.

THIS TOUR:
- Title: ${tour.title}
- Price: $${tour.price}
- Duration: ${tour.duration || 'not specified'}
- Rating: ${tour.rating || 'N/A'}/5 (${tour.reviewCount || 0} reviews)
- Category: ${tour.category || 'N/A'}

SAME-TYPE ALTERNATIVES (use these for the price gap and the "choose this over" line; pick the most relevant one):
${altLines}

Respond with ONLY the section.`;
}
// Prompt para SHOWS v2: eje EXPERIENCIA/OCASION, nunca precio. Endurecido contra
// invencion de escenario (la textura va en la NOCHE y el ESPECTADOR, no en el show).
function buildWorthItPromptShow(tour, alternatives, frame) {
  const altLines = alternatives.length
    ? alternatives.map(a => `- ${a.title} (${a.rating || 'N/A'}/5, ${a.duration || 'N/A'})`).join('\n')
    : '(no other shows available)';

  return `${VOICE_CORE_BODY}

The tone above is your voice. The JOB of THIS section follows.

You are an editor for lasvegastour.com writing the "Is It Worth It?" verdict for one Las Vegas SHOW (not a tour). The promise is "Reviewed. Compared. Selected." - this block RECOMMENDS, it does not describe. Write like someone deciding whether this show fits a friend's night. It must be citable by an AI answering "is [show] worth seeing?".

THE DECISION AXIS IS EXPERIENCE AND OCCASION, NEVER PRICE. A water spectacle and a magic show are not interchangeable, so NEVER frame the choice around cost, "cheaper", price gaps, or "similar value".

THE CORE OF A GOOD VERDICT:
- THE AXIS IS THE SPECTATOR AND THE OCCASION, NOT THE RATING. The decision a reader is making is "is this the right kind of night for me, and for whoever I'm bringing?" - not "is the score high enough?". A great verdict describes a PERSON or a NIGHT and takes a position on who it's for and who it isn't.
- THE RATING IS NOT THE STORY. The score and the runtime do NOT belong in the verdict at all - they already appear elsewhere on the page, and a high rating tells no one whether the occasion fits them. The verdict is pure mood, audience, and occasion. If you are tempted to anchor on a number, that is the tours instinct - resist it; here the night IS the anchor.
- HAVE AN OPINION. The label classifies (date night, big mixed group, first Vegas trip); the verdict takes a side. Say plainly who should book this and who will be sitting in the wrong room.

WHAT YOU ACTUALLY KNOW = the title, the rating, the review count, the duration. NOTHING ELSE.
- The TITLE is your ONLY source of fact about what the show is. You may use the words the title gives you (e.g. "magic", "family", "interactive", "dinner", "tribute", "revue", "comedy") and nothing more.
- Do NOT assume the STYLE inside a genre. "magic" does NOT imply close-up vs. large-scale illusion, does NOT imply audience participation, does NOT imply an intimate room - unless the title says so.
- Do NOT invent staging, acts, specific tricks, performer behavior, venue size, seating, intermissions, food/drink service, or any clock/runtime detail beyond the given duration.
- If you find yourself describing what happens ON STAGE or what the audience SEES or DOES during the show, stop - that is invention. Put the texture in the NIGHT and the SPECTATOR instead, which you CAN judge.
- Do NOT assert biographical facts, awards, credentials, opening dates, or how long a show has run - none of that is in your data (no "AGT winner", "Emmy winner", "running since 1993", "longest-running").

INVENTION CHECK (real failures from a prior run - never produce these):
- BAD: "watch sleight-of-hand unfold up close"  (title never said close-up)
- BAD: "conversation during intermission"  (you do not know there is one)
- BAD: "cheering while eating with your hands"  (you do not know the format)
- BAD: "the performer pulls spectators into tricks right in front of you"  (invented staging)
- GOOD (occasion/spectator, always safe): "the kind of night you want a mixed-age group to enjoy the same thing", "a date-night pick rather than a big-group spectacle", "a first-Vegas-trip crowd-pleaser".

ROTATION HINT - the OPENING STRUCTURE for this verdict. Build your first sentence on this shape, filled with THIS show's occasion and spectator; adapt it naturally, fill any [bracketed] placeholder with the real thing, never quote it mechanically, and never let it steer toward price, the rating, or invented staging: "${frame}"

Output EXACTLY this structure in markdown, nothing else:

### 🤔 Is It Worth It?
**Our verdict:** [TWO sentences built on the ROTATION HINT above, and pure occasion/mood/audience throughout - NO rating, NO review count, NO runtime, NO number anywhere. Sentence 1: open on the OCCASION and the SPECTATOR with a clear position - the kind of night this is and who it's really for. Sentence 2: pivot on an em dash to the honest draw or catch, framed by OCCASION or by the experience type the TITLE already named - NEVER by describing the staging. Bold EXACTLY ONE phrase here.]

**Worth it if:**
- [a real spectator profile or occasion + a human reason, never the budget, never invented stage detail]
- [another, different angle]
- [another]

**Skip it if:**
- [an honest profile that will not enjoy THIS kind of night]
- [another]

[OPTIONAL - include the "Choose this over" line ONLY if one of the shows listed below is a genuinely comparable type a real buyer would weigh against this one. If the only options are large Cirque spectacles and this is a smaller/different show (or vice versa), they are NOT real alternatives - OMIT this line entirely:]
**Choose this over [named comparable show below] if:**
- [the deciding factor, as a contrast of experience type, never price]

HARD RULES:
- BANNED phrases: "delivers solid value", "delivers", "great value", "value for money", "stellar", "must-see", "unforgettable", "breathtaking", "world-class", "a feast for the senses", "leaves you speechless".
- NEVER mention price, cost, "cheaper", or any price comparison.
- The verdict contains NO numbers at all - no rating, no review count, no runtime, no figure of any kind, in any sentence. The opening is the occasion and the spectator, built on the ROTATION HINT. If a number appears anywhere in "Our verdict", you have failed: rewrite it so the night and the person carry it. Numbers live in other sections of the page, not here.
- NO COLLECTIVE-SATISFACTION CLOSER. Large-scale shows lure you into the same lazy ending - "everyone walks out impressed", "all ages equally amazed", "something for everyone", "mixed groups will all be satisfied". That generic wrapper of shared awe is BANNED. Naming a group audience is allowed, but a SPECIFIC angle must carry it (the first-timer you're initiating, the visitor a local is showing off the city to, the relative who never does theatre, the couple marking something), never a catch-all coda. Self-check: if your closing line could end ANY big Vegas show, delete it and find the night THIS one owns.
- Every bullet is a STRONG occasion/spectator reason, never a feature, never filler, never invented stage detail.
- Take a clear position. Do NOT hedge into "it depends on your taste".
- Bold EXACTLY ONE phrase total (inside "Our verdict"). The "**" around the labels stays.

THIS SHOW:
- Title: ${tour.title}
- Duration: ${tour.duration || 'not specified'}
- Rating: ${tour.rating || 'N/A'}/5 (${tour.reviewCount || 0} reviews)

OTHER LAS VEGAS SHOWS (only for the optional "choose this over" line; ignore unless one is a genuinely comparable type):
${altLines}

Respond with ONLY the section.`;
}


// Selector de prompt segun categoria. Shows usan su propio prompt (eje experiencia,
// no precio); el resto usa el de tours.
function buildPrompt(tour, alternatives, frame) {
  if (tour.category === 'shows') return buildWorthItPromptShow(tour, alternatives, frame);
  return buildWorthItPromptTour(tour, alternatives, frame);
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

function removeExistingWorthIt(body) {
  const idx = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('is it worth it'));
  if (idx === -1) return body;
  let end = body.length;
  for (let i = idx + 1; i < body.length; i++) { if (isHeading(body[i])) { end = i; break; } }
  return [...body.slice(0, idx), ...body.slice(end)];
}

function findInsertIndex(body) {
  const anchor = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes('what makes this tour different'));
  if (anchor !== -1) {
    for (let i = anchor + 1; i < body.length; i++) { if (isHeading(body[i])) return i; }
    return body.length;
  }
  const wys = body.findIndex(b => isHeading(b) && headingText(b).toLowerCase().includes("what you'll see"));
  if (wys !== -1) return wys;
  return body.length;
}

async function fetchAlternatives(tour) {
  return await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && category->slug.current == $cat && slug.current != $slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc) [0...4] {
      title, "price": tourInfo.price, "duration": tourInfo.duration, "rating": getYourGuideData.rating
    }
  `, { cat: tour.category, slug: tour.slug });
}

// ============================================================================
//  Guard deterministico de banned words (mismo patron que inject-experience.js).
//  Hace cumplir la UNION de las BANNED phrases de ambos prompts (tours + shows),
//  con el agregado clave de "delivers" suelto - la regex de Experience solo
//  capturaba "delivers value", por eso "delivers a hybrid night" se colaba.
//  Lista deliberadamente conservadora: NO incluye atmosphere/vibe/authentic/
//  iconic, que aparecen legitimamente en verdicts validados.
// ============================================================================
const WORTHIT_BANNED = [
  /\bdeliver(s|ed|ing)?\b/i,
  /\bsolid value\b/i, /\bgreat value\b/i, /\bgood value\b/i, /\bvalue for money\b/i,
  /\bstellar\b/i, /\bmust-?see\b/i, /\bunforgettable\b/i, /\bbreathtaking\b/i, /\bworld-?class\b/i,
  /\bfeast for the senses\b/i, /\bleaves you speechless\b/i,
];
function findWorthItViolations(text) {
  const hits = [];
  for (const re of WORTHIT_BANNED) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return [...new Set(hits.map(h => h.toLowerCase()))];
}
async function correctiveRewriteWorthIt(verdictMd, banned) {
  const prompt = `The markdown below is the "Is It Worth It?" verdict block of a Las Vegas tour/show page. It must read like a sharp editorial recommendation, never an auto-generated brochure.

These banned phrases appear and MUST be removed - rewrite each so the meaning survives in plain, specific language with NO marketing filler: ${banned.join(', ')}.

Keep EVERYTHING else exactly intact: the "### 🤔 Is It Worth It?" header, the **Our verdict:** / **Worth it if:** / **Skip it if:** / **Choose this over** structure and their bold labels, the single bolded phrase inside the verdict, every concrete fact, and the bullets themselves. Change ONLY what is needed to remove the banned wording. Introduce no new facts and no numbers.

BLOCK:
${verdictMd}

Respond with ONLY the corrected markdown.`;
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text.trim();
}

// ============================================================================
//  API del modulo: procesa UN tour por slug (published). Reusado por el CLI
//  y por el importer (index.js) tras crear un tour nuevo.
// ============================================================================
export async function injectWorthItForSlug(slug, { dryRun = false } = {}) {
  const tour = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(tourInfo.price) && defined(getYourGuideData.rating) && defined(body)][0] {
      _id, title, "slug": slug.current,
      "price": tourInfo.price, "duration": tourInfo.duration,
      "rating": getYourGuideData.rating, "reviewCount": getYourGuideData.reviewCount,
      "category": category->slug.current, body
    }
  `, { slug });
  if (!tour?._id) return { ok: false, reason: 'not-found-or-missing-data', slug };

  const frame = pickFrame(tour.slug, tour.category);
  const alternatives = await fetchAlternatives(tour);
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 600,
    messages: [{ role: 'user', content: buildPrompt(tour, alternatives, frame) }],
  });
  let verdictMd = msg.content[0].text.trim();
  let banned = findWorthItViolations(verdictMd);
  const bannedBefore = banned;
  if (banned.length) {
    verdictMd = await correctiveRewriteWorthIt(verdictMd, banned);
    banned = findWorthItViolations(verdictMd);
  }
  const newBlocks = markdownToBlocks(verdictMd);
  const cleaned = removeExistingWorthIt(tour.body || []);
  const idx = findInsertIndex(cleaned);
  const newBody = [...cleaned.slice(0, idx), ...newBlocks, ...cleaned.slice(idx)];

  const out = {
    ok: true, slug, frame, alts: alternatives.length,
    before: (tour.body || []).length, after: newBody.length,
    nextHeading: cleaned[idx] ? headingText(cleaned[idx]) : '(end)',
    bannedBefore, bannedAfter: banned,
    verdictMd,
  };
  if (dryRun) { out.dryRun = true; return out; }
  await sanity.patch(tour._id).set({ body: newBody }).commit();
  return out;
}

// Lista de slugs candidatos (published, con datos) para el CLI/backfill.
export async function fetchTourSlugs({ category = null, limit = 500 } = {}) {
  const catFilter = category ? `&& category->slug.current == "${category}"` : '';
  const rows = await sanity.fetch(`
    *[_type == "post" && !(_id in path("drafts.**")) && defined(tourInfo.price) && defined(getYourGuideData.rating) && defined(body) ${catFilter}] | order(getYourGuideData.reviewCount desc) [0...${limit}]{ "slug": slug.current }
  `);
  return (rows || []).map(r => r.slug);
}

// ============================================================================
//  CLI (solo corre si se ejecuta el archivo directamente, no al importarlo)
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = args.includes('--dry-run');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
  const CATEGORY = args.find(a => a.startsWith('--category='))?.split('=')[1] || null;
  const SLUGS = (args.find(a => a.startsWith('--slugs='))?.split('=')[1] || '').split(',').map(s => s.trim()).filter(Boolean);
  const FORCE = args.includes('--force'); 
  const DONE_FILE = './inject-worth-it-done.json';
  const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];
  

  console.log(`\nINJECT "Is It Worth It?"  |  mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}  |  limit: ${LIMIT}${CATEGORY ? `  |  category: ${CATEGORY}` : ''}${SLUGS.length ? `  |  slugs: ${SLUGS.length}` : ''}${FORCE ? '  |  FORCE' : ''}`);
  console.log(`Already done: ${done.length}\n`);

  const slugs = SLUGS.length ? SLUGS : await fetchTourSlugs({ category: CATEGORY, limit: LIMIT });
  if (!slugs.length) { console.error('No tours found'); process.exit(1); }

  let preview = '', okCount = 0, errCount = 0;
  for (const slug of slugs) {
    if (done.includes(slug) && !FORCE && !SLUGS.length) { console.log(`skip (done): ${slug}`); continue; }
    try {
      const r = await injectWorthItForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); continue; }
      if (DRY_RUN) {
        const guardLine = r.bannedBefore && r.bannedBefore.length
          ? `\nGUARD: caught [${r.bannedBefore.join(', ')}] -> rewrote${r.bannedAfter.length ? ` | STILL PRESENT: [${r.bannedAfter.join(', ')}]` : ' | clean'}`
          : '';
        preview += `\n========================================\n${slug}  | frame: "${r.frame}" | alts: ${r.alts}${guardLine}\nINSERT before: "${r.nextHeading}"  | blocks ${r.before} -> ${r.after}\n---- block ----\n${r.verdictMd}\n`;
        console.log(`preview: ${slug}  (${r.before} -> ${r.after})`);
      } else {
        done.push(slug);
        fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));
        console.log(`patched: ${slug}  (${r.before} -> ${r.after})`);
        await new Promise(res => setTimeout(res, 1200));
      }
      okCount++;
    } catch (err) {
      console.error(`ERROR ${slug}: ${err.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./inject-preview.md', preview);
    console.log(`\nPreview written to inject-preview.md  (ok: ${okCount}, err: ${errCount})  - NOTHING written to Sanity`);
  } else {
    console.log(`\nDone. patched: ${okCount}, errors: ${errCount}, total done: ${done.length}`);
  }
}


// Auto-ejecucion solo si se corre directo (Windows-safe). Al importar, NO corre.
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
