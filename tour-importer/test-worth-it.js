// test-worth-it.js - Prueba AISLADA de la seccion "Is It Worth It?" (v3)
// Read-only: lee tours de Sanity, genera solo el veredicto con Claude.
// NO scrapea, NO toca imagenes, NO escribe en Sanity.
// Uso:  node test-worth-it.js            (3 tours top por reviews)
//       node test-worth-it.js --limit=5  (5 tours)

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});
const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const args = process.argv.slice(2);
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '3', 10);

// Rotacion deterministica de la frase-pivote del verdict (por hash del slug).
// Garantiza distribucion pareja entre los 300+ tours, sin repetir plantilla.
const PIVOT_FRAMES = [
  "The real advantage isn't",
  "What you're really paying for is",
  "The biggest reason travelers choose this is",
  "The hidden benefit here is",
  "What makes this one stand out isn't",
  "What actually sets this apart is",
  "The part worth paying for is",
  "What you won't find in the listing is",
  "The honest draw here is",
  "What tips the decision is",
  "The thing most reviews gloss over is",
  "What separates this from the cheaper options is",
  "The real reason to book this is",
  "What you're trading up for is",
  "The catch worth knowing is",
  "What makes the price make sense is",
  "Where this earns its price is",
  "What you're actually getting for the money is",
  "The genuine upside here is",
  "What justifies the extra cost is",
  "What this one gets right is",
  "What this does better than the alternatives is",
  "The reason this holds its rating is",
  "What most travelers underestimate here is",
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

function pickFrame(slug) {
  return PIVOT_FRAMES[cyrb53(String(slug || '')) % PIVOT_FRAMES.length];
}

function buildWorthItPrompt(tour, alternatives, frame) {
  const altLines = alternatives.length
    ? alternatives.map(a => `- ${a.title} ($${a.price}, ${a.duration || 'N/A'}, ${a.rating || 'N/A'}/5)`).join('\n')
    : '(no same-type alternatives available - keep the comparison qualitative)';

  return `You are an editor for lasvegastour.com writing the "Is It Worth It?" verdict for one tour. The site's promise is "Reviewed. Compared. Selected." - this block is where you RECOMMEND, not describe. It must read like a human who took the tour telling a friend the truth, and it must be citable by AI assistants answering "is [tour] worth it?".

Output EXACTLY this structure in markdown, nothing else:

### 🤔 Is It Worth It?
**Our verdict:** [TWO sentences. Sentence 1: anchor a specific claim using the real numbers below - e.g. "At $94, this is one of the cheapest ways to see both Hoover Dam and the Grand Canyon West Rim in a single day." Sentence 2: open with the PIVOT FRAME provided below (adapt the grammar naturally), then pivot on an em dash to the REAL advantage or the REAL catch - the thing a friend who took it would actually tell you. e.g. with frame "The real advantage isn't": "The real advantage isn't the price - it's the flexibility to decide later whether the Skywalk is worth paying for."]

**Worth it if:**
- [a concrete visitor profile + a real human reason, not a feature]
- [another, from a different angle]
- [another]

**Skip it if:**
- [an honest profile that should pass; if a named alternative below suits them better, send them there]
- [another]

**Choose this over [most relevant named alternative below] if:**
- [the deciding factor, in plain language]

PIVOT FRAME for the second verdict sentence (use THIS angle, adapt grammar; do not default to "The real advantage isn't" unless it is the frame): "${frame}"

HARD RULES:
- BANNED phrases (never use - they sound auto-generated): "delivers solid value", "solid value", "great value", "good value", "value for money", "must-see", "unforgettable", "breathtaking", "world-class".
- Do NOT invent operational facts that are not in the data below: exact pickup times ("3am"), flight minutes, mileage, departure hours, headcounts. If an early start matters, say it qualitatively ("a pre-dawn pickup", "an early start", "a long pre-sunrise day"). Use real numbers ONLY when given above.
- Every "Worth it if" / "Skip it if" line is a STRONG, real reason or pain - never a feature, never filler nobody books on. GOOD: "you'd rather sit on a coach than drive 500 miles yourself", "you want to leave the casinos behind for a few hours", "getting fed during a 10+ hour day matters more than researching lunch stops", "a tour-group schedule stresses you out more than planning your own drive". BAD: "coach tour socializing appeals to you", "you enjoy guided experiences", "you want optional upgrades".
- When you compare price, cite the EXACT gap versus a NAMED alternative (e.g. "$56 less than the VIP Coach tour"). Never invent a vague range like "$50+ more".
- Take a clear position. Do NOT hedge into "it depends on your preferences" with no guidance.
- Vary the wording, including verbs. This runs across 300+ tours; nothing should feel templated. Do not lean on one verb like "knock out".
- Be willing to reach an uncomfortable conclusion when the numbers support it. If this tour costs clearly more than a NAMED same-type alternative with a similar rating and duration, it is fair and valuable to say most travelers will be just as happy with the cheaper one - word it like an editor: "Unless [a specific reason] matters to you, most travelers get similar value from the cheaper [named alternative]."
- BUT that independence must be EARNED by the data, never speculative. You only have price, duration, rating and category - you do NOT know what each tour includes or its exact route. You may say two tours look similar "on paper" or "by the numbers", but do NOT assert they are "essentially the same experience" as established fact. Hedge any equivalence to what the numbers actually show.
- Do NOT attribute inclusions to an alternative (breakfast, WiFi, meals, hotel pickup, guide) unless those exact words appear in that alternative's title above. You know alternatives only by title, price, duration and rating.

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

async function main() {
  console.log(`\nTesting "Is It Worth It?" v3 on ${LIMIT} tours (read-only, no Sanity writes)...\n`);

  const tours = await sanity.fetch(`
    *[_type == "post" && defined(tourInfo.price) && defined(getYourGuideData.rating)] | order(getYourGuideData.reviewCount desc) [0...${LIMIT}] {
      title,
      "slug": slug.current,
      "price": tourInfo.price,
      "duration": tourInfo.duration,
      "rating": getYourGuideData.rating,
      "reviewCount": getYourGuideData.reviewCount,
      "category": category->slug.current
    }
  `);

  if (!tours.length) { console.error('No tours found'); process.exit(1); }

  let out = '';
  for (const tour of tours) {
    const alternatives = await sanity.fetch(`
      *[_type == "post" && category->slug.current == $cat && slug.current != $slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc) [0...4] {
        title, "price": tourInfo.price, "duration": tourInfo.duration, "rating": getYourGuideData.rating
      }
    `, { cat: tour.category, slug: tour.slug });

    const frame = pickFrame(tour.slug);
    const prompt = buildWorthItPrompt(tour, alternatives, frame);
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      temperature: 0.5,
      messages: [{ role: 'user', content: prompt }],
    });
    const verdict = msg.content[0].text.trim();

    const block = `\n========================================\nTOUR: ${tour.title}\n$${tour.price} | ${tour.duration} | ${tour.rating}/5 (${tour.reviewCount} reviews) | ${tour.category}\nFrame: "${frame}" | Alternatives fed: ${alternatives.length}\n----------------------------------------\n${verdict}\n`;
    console.log(block);
    out += block;
    await new Promise(r => setTimeout(r, 1500));
  }

  fs.writeFileSync('./worth-it-preview.md', out);
  console.log('\n----------------------------------------');
  console.log('Saved to: worth-it-preview.md');
}

main();
