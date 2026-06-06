import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  useCdn: false,
  apiVersion: '2024-01-01',
  token: config.sanity.token,
});

const claude = new Anthropic({ apiKey: config.anthropic.apiKey });

// ─── Convertir texto con **bold** a PortableText children ───────────────────
function textToPortableTextChildren(text) {
  const children = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      children.push({
        _type: 'span',
        _key: `span${keyIndex++}`,
        text: text.slice(lastIndex, match.index),
        marks: [],
      });
    }
    children.push({
      _type: 'span',
      _key: `span${keyIndex++}`,
      text: match[1],
      marks: ['strong'],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    children.push({
      _type: 'span',
      _key: `span${keyIndex++}`,
      text: text.slice(lastIndex),
      marks: [],
    });
  }

  return children;
}

// ─── Encontrar el bloque Quick Answer en el body ─────────────────────────────
function findQuickAnswerBlock(body) {
  if (!body || !Array.isArray(body)) return null;

  for (let i = 0; i < body.length; i++) {
    const block = body[i];
    if (block._type === 'block' && block.style === 'h3') {
      const text = block.children?.map(c => c.text || '').join('') || '';
      if (text.includes('Quick Answer')) {
        const next = body[i + 1];
        if (next && next._type === 'block' && next.style === 'normal') {
          return { index: i + 1, block: next };
        }
      }
    }
  }
  return null;
}

// ─── Extraer texto plano del bloque ─────────────────────────────────────────
function blockToPlainText(block) {
  return block.children?.map(c => c.text || '').join('') || '';
}

// ─── Deterministic rotation for verbs and openers ───────────────────────────
const SENTENCE2_VERBS = [
  'Covers',
  'Includes access to',
  'Explores',
  'Takes you through',
  'Focuses on',
  'Visits',
];

const SENTENCE3_OPENERS = [
  'Best for',
  'Ideal for',
  'Suited to',
  'A strong option for',
  'Geared toward',
  'Well matched to',
];

const VARIATION_HINTS = [
  'Vary by leading with the access type right after duration: "**3-hour** skip-the-line Colosseum tour with expert guide..."',
  'Vary by leading with the restricted area after duration: "**3-hour** Colosseum Underground tour with arena floor access and skip-the-line entry..."',
  'Vary by leading with group format after duration: "**2-hour** small-group Colosseum tour (max 15) with skip-the-line access..."',
  'For combo tours: lead with duration + what is combined: "**7-hour** Colosseum and Vatican combo tour with skip-the-line access at both sites..."',
  'Vary by leading with timing/special access: "**2-hour** Colosseum night tour with underground and arena floor access..."',
];

let rotationIndex = 0;

function getRotation() {
  const verb = SENTENCE2_VERBS[rotationIndex % SENTENCE2_VERBS.length];
  const opener = SENTENCE3_OPENERS[rotationIndex % SENTENCE3_OPENERS.length];
  const variation = VARIATION_HINTS[rotationIndex % VARIATION_HINTS.length];
  rotationIndex++;
  return { verb, opener, variation };
}

// ─── Prompt del experto ──────────────────────────────────────────────────────
function buildPrompt(tour, currentText) {
  const duration = tour.tourInfo?.duration || '';
  const price = tour.tourInfo?.price ? `from $${tour.tourInfo.price}` : '';
  const rating = tour.getYourGuideData?.rating ? `${tour.getYourGuideData.rating}/5` : '';
  const reviews = tour.getYourGuideData?.reviewCount ? `${tour.getYourGuideData.reviewCount} reviews` : '';
  const skipTheLine = tour.tourFeatures?.skipTheLine ? 'skip-the-line access' : '';
  const isPrivate = tour.tourFeatures?.privateAvailable ? 'private tour option' : '';
  const isSmallGroup = tour.tourFeatures?.smallGroupAvailable ? 'small group' : '';
  const freeCancellation = tour.tourFeatures?.freeCancellation ? 'free cancellation' : '';

  const extras = [skipTheLine, isPrivate, isSmallGroup, freeCancellation].filter(Boolean).join(', ');

  // Detect if price is per group
  const refLower = currentText.toLowerCase();
  const titleLower = (tour.title || '').toLowerCase();
  const isPerGroup = refLower.includes('per group') || refLower.includes('per party')
    || (titleLower.includes('private') && tour.tourInfo?.price >= 300);
  const priceLabel = isPerGroup ? 'per group' : 'per person';

  const { verb, opener, variation } = getRotation();

  return `You are a conversion-focused travel copywriter. Write a Quick Answer for a Rome/Colosseum tour page.

═══ WHAT A QUICK ANSWER IS ═══
A Quick Answer is NOT a description — it is a PURCHASE FILTER.
It informs, simplifies, and pushes a decision. Every word must help the user decide YES or NO in 5 seconds.
If a word doesn't help them decide → delete it.

═══ NON-NEGOTIABLE RULES (break any = failed output) ═══
1. FIRST SENTENCE = FACTS, NOT STORY. Always lead with: duration + tour type + key feature + price. No narrative, no scene-setting.
2. IF IT DOESN'T HELP DECIDE → IT DOESN'T GO. Every word earns its place.
3. CLARITY > DETAIL. Short and clear beats complete and heavy.
4. ONE QUICK = ONE CORE IDEA. Don't cram everything — pick the #1 differentiator.
5. DATA > ADJECTIVES. Duration and price sell more than any adjective. Zero adjectives allowed.

═══ IMPORTANT CONTEXT ═══
- The Colosseum is an amphitheater, not a "museum" or "stadium"
- Underground = hypogeum (where gladiators and animals were held before combat)
- Arena Floor = reconstructed wooden platform at ground level of the amphitheater
- Roman Forum = ancient civic center adjacent to the Colosseum
- Palatine Hill = one of Rome's seven hills, overlooking the Forum
- Standard tickets do NOT include Underground or Arena Floor — these require special access
- Vatican combo tours typically include: Vatican Museums, Sistine Chapel, St. Peter's Basilica/Square
- Night tours offer after-hours access with fewer crowds and special lighting

═══ TOUR DATA ═══
- Title: ${tour.title}
- Duration: ${duration}
- Price: ${price}
- Rating: ${rating} (${reviews})
- Features: ${extras || 'guided tour'}
- Reference text (context only, DO NOT copy): ${currentText}

═══ FORMAT ═══
Exactly 3 sentences, 45–65 words total. Rewrite from scratch.

═══ MANDATORY 3-SENTENCE TEMPLATE ═══

SENTENCE 1 — THE SPEC (facts only):
[Duration] [tour type] with [key feature], priced from $X ${priceLabel}.
→ Always starts with the bolded duration. Then tour type, then #1 differentiator (bolded), then price (bolded).
→ Do NOT cram all site names here — save them for sentence 2.
→ Price format is ALWAYS: "priced from $X ${priceLabel}" — never "at from $X", never missing "${priceLabel}"
→ For combo tours, name the main combo in sentence 1: "Colosseum and Vatican combo tour"
→ For multi-element tours, use natural phrasing: "Colosseum tour with underground and arena floor access" NOT "underground arena floor Colosseum tour"

SENTENCE 2 — THE COVERAGE (what makes it valuable):
What specific sites/areas are included + what gives this tour its value.
→ You MUST start this sentence with: "${verb}"
→ Name 2–3 real sites/areas: Colosseum interior, Underground hypogeum, Arena Floor, Roman Forum, Palatine Hill, Vatican Museums, Sistine Chapel, St. Peter's Basilica, Arch of Constantine, etc.
→ Add a thin layer of value: what makes visiting those sites with THIS tour worthwhile (e.g. "with expert commentary on gladiatorial combat history", "with an archaeologist explaining the engineering of the hypogeum")
→ For Vatican combos: mention what you see at EACH site
→ Do NOT just list sites — connect them to what the guide/access adds

SENTENCE 3 — THE DECISION (who + why):
→ You MUST start this sentence with: "${opener}"
→ Then [specific audience] + [positive reason / what they gain]
→ Uses POSITIVE framing only: "who want restricted-area access", "seeking the full ancient Rome experience"
→ NEVER use negative comparisons: no "rather than", no "instead of", no "not surface-level"
→ For combo tours, the decision driver is logistics + combined value
→ For underground/arena tours, the decision driver is exclusive access standard tickets don't include
→ For night tours, the decision driver is atmosphere + smaller crowds

═══ VARIATION HINT ═══
${variation}

═══ ANTI-REPETITION (hard rules) ═══
- Sentence 1 ALWAYS starts with the bolded duration: "**X-hour**..."
- NEVER start sentence 1 with "This", "From", "Covering", "Walking", "With", "Led", "Designed"
- Sentence 2 MUST start with the exact verb assigned above: "${verb}" — no substitutions allowed
- Sentence 3 MUST start with the exact opener assigned above: "${opener}" — no substitutions allowed
- NEVER use "rather than" or "instead of" or compare negatively to other tours
- NEVER use "step back in time" or "ancient whispers" or "walk where gladiators walked"

═══ WORD RULES ═══
- Include "Colosseum" exactly once, naturally (sentence 1 preferred)
- For Vatican combos, "Vatican" can appear once too
- Price: ALWAYS "priced from $X ${priceLabel}" — no other format accepted
- BANNED adjectives: perfect, unforgettable, amazing, incredible, unique, wonderful, breathtaking, comprehensive, iconic, immersive, stunning, remarkable, extraordinary, exceptional, legendary, majestic
- BANNED phrases: "step back in time", "ancient whispers", "walk where gladiators walked", "hidden gems", "feast for the eyes"
- BANNED openings: "This is a", "This tour", "From the", "Covering the", "Experience the", "Discover the", "Explore the", "Walking the"
- Bold EXACTLY 3 things — no more, no less:
  1. Duration (e.g. **3-hour**)
  2. Price (e.g. **$57 ${priceLabel}**)
  3. The #1 key differentiator (e.g. **skip-the-line access**, **underground access**, **arena floor entry**, **night access**, **small group (max 15)**, **Vatican combo**, **private guide**)
- Do NOT bold site names, area names, or generic words

═══ GOOD EXAMPLES (notice: 3 sentences, 3 bolds, varied verbs, positive framing) ═══
"**3-hour** guided Colosseum tour with **underground and arena floor access**, priced from **$78 per person**. Covers the hypogeum chambers where gladiators prepared for combat, the reconstructed arena floor, and Roman Forum ruins with expert historical commentary. Best for history enthusiasts who want restricted-area access that standard tickets don't include."

"**7-hour** Colosseum and Vatican combo tour with **skip-the-line access** at both sites, priced from **$125 per person**. Includes access to the Colosseum interior, Roman Forum, Vatican Museums, and Sistine Chapel with guided commentary on both ancient and Renaissance Rome. Ideal for first-time visitors who want both landmarks in one day with transport included."

"**2-hour** Colosseum night tour with **after-hours access** to the underground and arena floor, priced from **$85 per person**. Explores the hypogeum and arena floor under evening lighting with a specialist guide and a group capped at 20. Suited to visitors who want a different perspective with significantly fewer crowds."

"**2.5-hour** private Colosseum tour with **dedicated guide** and skip-the-line entry, priced from **$350 per group**. Takes you through the Colosseum interior, Roman Forum, and Palatine Hill at your own pace with personalized historical commentary. A strong option for families or small groups who want flexibility and direct Q&A with their guide."

═══ BAD EXAMPLES ═══
"Step back in time with this 3-hour tour..." ← banned phrase + narrative opening
"This is a 2-hour guided tour of the Colosseum..." ← banned "This is a" opening
"...rather than a basic audio guide" ← negative comparison, banned
"...at from $78" ← wrong price format
"...priced from $78." ← missing "${priceLabel}"
"This incredible tour through the legendary amphitheater..." ← banned adjectives + narrative
"covering the Colosseum... covering the Forum... covering the hill" ← same verb repeated

═══ SELF-CHECK BEFORE OUTPUT ═══
1. Does sentence 1 START with the bolded duration? If no → rewrite.
2. Does it say "priced from **$X ${priceLabel}**"? If no → fix.
3. Are there EXACTLY 3 bold phrases total (duration + differentiator + price)? If more or fewer → fix.
4. Does sentence 2 START with "${verb}"? If no → rewrite. This is mandatory.
5. Does sentence 2 name 2–3 real sites/areas AND add a value layer? If no → add it.
6. Does sentence 3 START with "${opener}"? If no → rewrite. This is mandatory.
7. Does sentence 3 use positive framing only? If no → rewrite.
8. Did I avoid "step back in time" and all banned phrases? If no → fix.
9. Can a user decide in 5 seconds? If no → simplify.

OUTPUT: The 3 sentences only. No labels, no quotes, no explanation.`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const SLUGS = args.find(a => a.startsWith('--slug='))?.split('=')[1]?.split(',') || null;

console.log(`\n🚀 Quick Answer Regenerator v2 — ColosseumRoman`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} tours`);
if (SLUGS) console.log(`Target: ${SLUGS.length} specific slug(s): ${SLUGS.join(', ')}`);
console.log('');

const tours = await sanity.fetch(`
  *[_type == "post" && !(_id in path("drafts.**"))] | order(_createdAt asc) [0...500] {
    _id,
    title,
    "slug": slug.current,
    "body": coalesce(content, body),
    tourInfo { duration, price, currency, groupSize, maxGroupSize },
    tourFeatures { freeCancellation, skipTheLine, smallGroupAvailable, privateAvailable },
    getYourGuideData { rating, reviewCount }
  }
`);

let toProcess = tours.filter(t => findQuickAnswerBlock(t.body));

// Filter by specific slugs if provided
if (SLUGS) {
  toProcess = toProcess.filter(t => SLUGS.includes(t.slug));
  const found = toProcess.map(t => t.slug);
  const missing = SLUGS.filter(s => !found.includes(s));
  if (missing.length) console.log(`⚠️  Slugs not found or no Quick Answer block: ${missing.join(', ')}\n`);
}

if (LIMIT) toProcess = toProcess.slice(0, parseInt(LIMIT));

console.log(`Found ${tours.length} tours total, ${toProcess.length} to process\n`);

let updated = 0;
let skipped = 0;
let errors = 0;
const DELAY_MS = 1200;

for (const tour of toProcess) {
  const found = findQuickAnswerBlock(tour.body);
  const currentText = blockToPlainText(found.block);

  if (!currentText.trim()) {
    console.log(`⏭️  ${tour.slug} — empty block, skipping`);
    skipped++;
    continue;
  }

  try {
    // Peek at current rotation before buildPrompt increments it
    const currentVerb = SENTENCE2_VERBS[rotationIndex % SENTENCE2_VERBS.length];
    const currentOpener = SENTENCE3_OPENERS[rotationIndex % SENTENCE3_OPENERS.length];

    // Detect price type for logging
    const refLower = currentText.toLowerCase();
    const titleLower = (tour.title || '').toLowerCase();
    const detectedPriceType = (refLower.includes('per group') || refLower.includes('per party')
      || (titleLower.includes('private') && tour.tourInfo?.price >= 300)) ? 'per group' : 'per person';

    const prompt = buildPrompt(tour, currentText);
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    });

    const newText = response.content[0].text.trim();
    const newChildren = textToPortableTextChildren(newText);

    if (DRY_RUN) {
      console.log(`📋 ${tour.slug}`);
      console.log(`   🔄 Verb: "${currentVerb}" | Opener: "${currentOpener}" | 💰 ${detectedPriceType}`);
      console.log(`   OLD: ${currentText.slice(0, 100)}...`);
      console.log(`   NEW: ${newText}`);
      console.log(`   WORDS: ${newText.split(' ').length}`);
      console.log('');
      updated++;
    } else {
      const fieldName = tour.body === tour.content ? 'content' : 'body';
      const blockKey = found.block._key;

      await sanity
        .patch(tour._id)
        .set({
          [`${fieldName}[_key=="${blockKey}"].children`]: newChildren,
        })
        .commit();

      console.log(`✅ ${tour.slug}`);
      updated++;
    }

    await new Promise(r => setTimeout(r, DELAY_MS));

  } catch (err) {
    console.error(`❌ ${tour.slug}: ${err.message}`);
    errors++;
  }
}

console.log(`\n═══════════════════════`);
console.log(`✅ ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated}`);
console.log(`⏭️  Skipped: ${skipped}`);
console.log(`❌ Errors:  ${errors}`);
