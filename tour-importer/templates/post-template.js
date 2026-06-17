// templates/post-template.js - V2 TRANSACTIONAL + GEO OPTIMIZED (Las Vegas)

import { classifyCategory } from '../src/sanityUploader.js';

/**
 * Human-readable label per category slug (kept in sync with the 8 categories
 * defined in src/sanityUploader.js — classifyCategory is the single source of truth).
 */
const TYPE_LABEL = {
  'grand-canyon-tours': 'Grand Canyon tour',
  'hoover-dam-tours':   'Hoover Dam tour',
  'adventure-tours':    'Las Vegas adventure tour',
  'day-trips':          'Las Vegas day trip',
  'helicopter-tours':   'Las Vegas helicopter tour',
  'nightlife':          'Las Vegas nightlife experience',
  'shows':              'Las Vegas show',
  'strip-tours':        'Las Vegas Strip & city tour',
};

/**
 * LIGHT base context — applies to ANY Las Vegas tour, always injected.
 */
const VEGAS_BASE_CONTEXT = `LAS VEGAS BASE CONTEXT (reference knowledge — describes the destination, NOT this specific tour):
- Las Vegas, Nevada, is the hub for tours across the American Southwest. Most excursions depart from and return to Strip hotels.
- Hotel pickup/drop-off or a designated meeting point is common; whether it is included varies by tour and must come from the tour data.
- Desert climate: extreme summer heat (June-August routinely 38-43 C / 100-110 F), mild winters. Sun protection and water matter on outdoor tours.
- Currency is USD. Many full-day tours cross state lines into Arizona, Utah, or California.
- The legal age in Nevada for casinos, clubs, and alcohol is 21.`;

/**
 * TYPE-SPECIFIC context — only the detected category's block is injected per tour,
 * so the model never mixes a club's dress code into a Grand Canyon tour.
 */
const VEGAS_TYPE_CONTEXT = {
  'grand-canyon-tours': `GRAND CANYON CONTEXT:
- Two rims are reachable from Las Vegas. WEST RIM: ~2.5 hours by road, on Hualapai tribal land, home of the Skywalk (a glass walkway over the canyon). It is NOT inside Grand Canyon National Park. SOUTH RIM: ~4.5 hours by road, inside Grand Canyon National Park, with the classic panoramic viewpoints.
- The Skywalk is only at the West Rim (Grand Canyon West / Eagle Point). Do not place it at the South Rim.
- Air options live in this category by classifier priority: helicopter and fixed-wing flights to the canyon, some with a landing at the canyon floor plus champagne or a picnic. Air tours typically go to the West Rim.
- What visitors should bring: water, sun protection, a hat, layers (temperatures swing), and closed-toe shoes.
- Bus/SUV day tours run long (full-day); air tours can do it in a half-day.`,

  'hoover-dam-tours': `HOOVER DAM CONTEXT:
- About 45 minutes by road from the Strip, on the Nevada/Arizona border across the Colorado River.
- The Mike O'Callaghan-Pat Tillman Memorial Bridge offers a pedestrian walkway overlooking the dam.
- Formats range from a photo stop to a guided interior tour (Power Plant Tour or Dam Tour with access inside the structure).
- Lake Mead sits alongside the dam; combos with Valley of Fire or Lake Mead are common.
- Security and bag restrictions apply on the interior dam tour.`,

  'adventure-tours': `ADVENTURE & OUTDOOR CONTEXT:
- ATV/UTV and dune buggy rides in the Mojave Desert, Nellis Dunes, or Valley of Fire.
- Zip-line options: SlotZilla on Fremont Street (downtown) and Bootleg Canyon (Boulder City).
- Shooting ranges / machine-gun experiences require a minimum age, photo ID, and a signed waiver.
- Other activities: kayaking the Colorado River (Black Canyon), jet ski on Lake Mead, horseback riding.
- What to bring: clothes that can get dirty, closed-toe shoes, water, sun protection. Many activities require a basic physical level and a liability waiver.`,

  'day-trips': `DAY TRIPS & NATIONAL PARKS CONTEXT:
- Antelope Canyon (Upper/Lower) and Horseshoe Bend are in Page, Arizona (~4.5-5 hours by road; Antelope Canyon requires a Navajo guide).
- Zion National Park (Utah, ~2.5-3 hours), Bryce Canyon (~4 hours), Death Valley (California, ~2 hours to the boundary).
- Valley of Fire State Park (Nevada, ~1 hour), Red Rock Canyon (~30 minutes), plus Route 66, Seven Magic Mountains, and the Mojave.
- These are long days with early departures and significant time in a van or bus; meals are sometimes included.`,

  'helicopter-tours': `HELICOPTER CONTEXT:
- This category is mainly night flights over the illuminated Strip (~12-15 minutes), the classic Las Vegas helicopter experience. (Helicopter tours to the Grand Canyon are classified under Grand Canyon tours.)
- Flights depart from helipads or the executive airport; many include limo or hotel pickup.
- Weight policy: passengers are weighed at check-in for safety and seat balancing, and heavier passengers may incur a comfort-seat fee.
- Some helicopter tours are landing tours (e.g., Grand Canyon West) that include champagne.`,

  'nightlife': `NIGHTLIFE CONTEXT:
- Minimum age is 21 (Nevada legal age), strictly enforced. A government photo ID or passport is required.
- Nightclub dress code is upscale "club attire": no shorts, athletic wear, sandals, or hats, especially for men.
- Formats: club crawl, bar crawl, pub crawl, party bus, and general admission versus bottle/table service. Many include line skip, VIP entry, or open-bar packages.
- Pool parties (dayclubs) run seasonally in spring and summer.`,

  'shows': `SHOWS & ENTERTAINMENT CONTEXT:
- Types include Cirque du Soleil (O, Mystere, KA and others), music residencies, magic, comedy, burlesque, and dinner shows.
- Seats are assigned by ticket category and price tier.
- Minimum age varies; some shows are adults-only (18+). Doors close at start time and latecomers may not be admitted.
- Some shows include dinner. Typical run time is 60-90 minutes.`,

  'strip-tours': `STRIP & CITY CONTEXT:
- Strip and downtown sightseeing, including the Fremont Street Experience (the downtown LED canopy).
- Open-top double-decker bus tours, walking tours, and food tours along the Strip.
- Points of interest: the Neon Museum (sign boneyard), the "Welcome to Fabulous Las Vegas" sign, the Venetian gondolas, and the Bellagio fountains.
- This category also receives any tour that does not match the other seven types.`,
};

/**
 * Generate tour-type context based on title/description.
 * Category comes from classifyCategory (same logic as the uploader) so the
 * injected context can never diverge from the category the uploader assigns.
 */
function getQuickAnswerIntro(tourData) {
  const title = (tourData.title || '').toLowerCase();
  const desc = (tourData.description || '').toLowerCase();
  const combined = title + ' ' + desc;

  // --- Category (single source of truth) ---
  const categorySlug = classifyCategory(tourData.title || '');
  const tourType = TYPE_LABEL[categorySlug] || 'Las Vegas tour';

  // --- Access / booking ---
  const isSkipLine = combined.includes('skip the line') || combined.includes('skip-the-line')
    || combined.includes('line skip') || combined.includes('skip the lines')
    || combined.includes('fast track') || combined.includes('fast-track')
    || combined.includes('priority access') || combined.includes('priority entry')
    || combined.includes('express entry') || combined.includes('vip entry')
    || combined.includes('vip access');

  // --- Group format ---
  const isPrivate = title.includes('private');
  const isSmallGroup = title.includes('small group') || title.includes('small-group');
  const isSemiPrivate = title.includes('semi-private') || title.includes('semi private');

  // --- Logistics ---
  const isHotelPickup = combined.includes('hotel pickup') || combined.includes('hotel pick-up')
    || combined.includes('hotel pick up') || combined.includes('round-trip transport')
    || combined.includes('round trip transport') || combined.includes('transportation included')
    || combined.includes('pickup') || combined.includes('pick-up');

  // --- Audience / age ---
  const isFamily = combined.includes('family') || combined.includes('kids')
    || combined.includes('children') || combined.includes('kid-friendly');
  const is21Plus = categorySlug === 'nightlife' || combined.includes('21+')
    || combined.includes('ages 21') || combined.includes('adults only')
    || combined.includes('adults-only') || combined.includes('adult only');
  const isVIP = combined.includes('vip') || combined.includes('exclusive');

  // --- Air specifics ---
  const isHelicopter = combined.includes('helicopter') || combined.includes('heli ')
    || combined.includes('heli-') || combined.includes('chopper');
  const isAirplane = combined.includes('airplane') || combined.includes('fixed-wing')
    || combined.includes('fixed wing') || combined.includes('by plane') || combined.includes('air tour');
  const isLanding = combined.includes('landing') || combined.includes('land at')
    || combined.includes('land on') || combined.includes('canyon floor')
    || combined.includes('bottom of the canyon') || combined.includes('champagne');
  const isNightFlight = (isHelicopter && combined.includes('night'))
    || combined.includes('night flight') || combined.includes('strip flight');

  // --- Grand Canyon specifics ---
  const isWestRim = combined.includes('west rim');
  const isSouthRim = combined.includes('south rim');
  const isSkywalk = combined.includes('skywalk');

  // --- Day-trip / combo ---
  const isDayTrip = categorySlug === 'day-trips';
  const mentionsHoover = combined.includes('hoover dam');
  const mentionsLakeMead = combined.includes('lake mead');
  const isCombo = (mentionsHoover && categorySlug !== 'hoover-dam-tours')
    || (combined.includes('grand canyon') && mentionsHoover)
    || combined.includes('combo') || combined.includes('+ ') || combined.includes(' and ');

  // --- Guide / format ---
  const isSelfGuided = combined.includes('self-guided') || combined.includes('self guided')
    || combined.includes('audio guide') || combined.includes('audio-guide');
  const isTicketOnly = title.includes('ticket') && !title.includes('tour') && !title.includes('guided');

  // --- Extras ---
  const hasMeal = combined.includes('lunch') || combined.includes('meal')
    || combined.includes('breakfast') || combined.includes('dinner') || combined.includes('bbq')
    || combined.includes('barbecue') || combined.includes('picnic');
  const hasBottleService = combined.includes('bottle service') || combined.includes('table service');

  return {
    tourType,
    categorySlug,
    isPrivate,
    isSmallGroup,
    isSemiPrivate,
    isSkipLine,
    isHotelPickup,
    isFamily,
    is21Plus,
    isVIP,
    isHelicopter,
    isAirplane,
    isLanding,
    isNightFlight,
    isWestRim,
    isSouthRim,
    isSkywalk,
    isDayTrip,
    isCombo,
    mentionsHoover,
    mentionsLakeMead,
    isSelfGuided,
    isTicketOnly,
    hasMeal,
    hasBottleService,
  };
}

/**
 * Get display name
 */
function getCityDisplayName(city, title) {
  return 'Las Vegas, Nevada';
}

export const postTemplate = {
  structure: `
Quick Answer| Included | Not Included |
Why People Book This | What You'll See | The Itinerary |
Practical Info | Tour Format | FAQ | Compare Tours
`,

  instructions: `
You are a data-driven travel content specialist for lasvegastour.com. Your job is to create content that RANKS in Google and gets CITED by AI assistants (ChatGPT, Perplexity, Google AI Overview).

CONTENT PHILOSOPHY:
- 60% TRANSACTIONAL: prices, comparisons, booking data, CTAs
- 40% INFORMATIONAL: requirements, practical answers to real questions, factual stops and inclusions
- 0% NARRATIVE / EXPERIENTIAL COLOR: do NOT add sensory, atmospheric, or "what it feels like" sentences anywhere. If a detail is not in the tour data, it does not go in. A short factual page beats a rich invented one.
- EVERY first sentence of each section must be independently citable by AI assistants
- NO poetry, NO "sensory crescendos", NO "neon dreams"
- NO comparisons with irrelevant cities or destinations
- NO fabricated reviews
- NO generic phrases ("unforgettable experience", "hidden gems", "feast for the eyes", "trip of a lifetime", "must-see", "breathtaking", "world-class")

DESTINATION CONTEXT:
${VEGAS_BASE_CONTEXT}

A type-specific context block for THIS tour is provided separately below under "TOUR-TYPE CONTEXT". Use ONLY that block plus the base context for destination facts. Do NOT pull in facts from other tour types (e.g., do not mention club dress code on a Grand Canyon tour).

PRICING RULE (CRITICAL — read the DETECTED TOUR CHARACTERISTICS):
- If "Private: Yes" or "Semi-Private: Yes", the listed price is for the WHOLE GROUP, not per head. Always write it as "$[X] per group" or "$[X] total (private tour)". This also applies to a private helicopter, a party bus buyout, or private/charter transport. NEVER write "per person" for these.
- For all other tours (group, small group, shared shuttle, show ticket, club pass), the price is per head — write "$[X] per person".
- This applies everywhere the price appears: Quick Answer, By the Numbers, Why People Book This, and any FAQ. Be consistent across the whole article.

FIXED STRUCTURE (sections in exact order):
### 💡 Quick Answer
FORMAT: 2-3 sentences, concise and scannable (40-60 words). Optimized for AI citation and featured snippets.
- Sentence 1: WHAT + HOW LONG + HOW MUCH. Nothing else in this sentence. Do NOT cram access type, transport, and features here.
  Vary the opening — rotate between:
  (a) "Guided **Grand Canyon West Rim** tour from **Las Vegas**, lasting **7 hours** and priced around **$120** per person."
  (b) "**45-minute** **Hoover Dam** half-day tour from **Las Vegas**, priced around **$65** per person."
  (c) "Small group **Antelope Canyon** and **Horseshoe Bend** day trip, lasting **10 hours** at **$210** per person."
  (d) "**Las Vegas Strip** helicopter night flight, lasting **12 minutes**, priced around **$95** per person."
  (e) "Private **Las Vegas club crawl** with VIP entry, priced at **$900** per group." (PRIVATE/SEMI-PRIVATE => per group, NEVER per person)
- Sentence 2: WHAT YOU GET. One sentence, specific. "You'll [see/visit/ride/experience] [2-3 specific things] with [guide/host/transport]."
- Sentence 3: DECISION. One sentence. "Best for [audience] who want [concrete benefit]."
- BOLD strategically: always bold **duration**, **price**, and key place names like **Las Vegas**, **Grand Canyon**, **West Rim**, **South Rim**, **Skywalk**, **Hoover Dam**, **Antelope Canyon**, **the Strip**, **Fremont Street**. Do NOT bold generic words.
- If duration is vague or a wide range, OMIT it — better clear than precise but doubtful.
- STRICT: ONLY mention features from the tour's Title, Description, Highlights, or Includes.
- NEVER keyword-stuff the opening: "Las Vegas Grand Canyon skip line guided tour" sounds robotic.
- Avoid marketing speak: "comprehensive coverage" -> "covers both rims". "Iconic landmark" -> just name it.
- One idea per sentence — do NOT cram multiple concepts together.
- Example: "Guided **Grand Canyon West Rim** tour from **Las Vegas**, lasting **7 hours** and priced around **$120** per person. You'll visit Eagle Point and Guano Point with round-trip transport and an optional **Skywalk** upgrade. Best for first-time visitors who want the canyon without the longer South Rim drive."



### ✅ What's Included
- Use "- " format, NO emojis in bullets
- Be specific: "Round-trip transport from Strip hotels" not "Transport"
- Include ONLY items that appear in the Includes data. Do NOT add items inferred from Highlights, the Description, or the context blocks. If the Includes list is short, keep this section short — a missing item is better than an invented one.
- Common items by type: round-trip transport / hotel pickup, park or site entrance fees, Skywalk ticket (if included), meals or snacks, water, safety gear (ATV/zip-line), helmet, guide or driver-guide, show ticket / seat category, club entry / line skip, drinks (if included)

### ❌ Not Included
- Same format as Included, NO emojis in bullets
- Be specific about what costs extra
- Common exclusions: gratuities, meals (if not included), drinks/alcohol, hotel pickup (if not included), park entrance fees (if not included), Skywalk upgrade, helicopter weight surcharge

### 🎯 Why People Book This
This is the ONE humanized, advisor-voice paragraph in the whole article. Write it like a knowledgeable friend telling someone what this trip actually is and why they'd want it — not like a spec sheet. It is the single place in the body where the writing should sound like a person, not data.
LENGTH: 2-4 sentences. Conversational. NOT a list of stats.
GOAL: answer the real question a traveler types and an AI engine looks to answer — "why would I book this?" — using ONLY what THIS tour actually is. Write it as a self-contained answer block.
VOICE — this is the Intercoper advisor voice ("Reviewed. Compared. Selected."), NOT marketing copy:
- Write like an expert who has personally assessed this tour and gives the straight, measured read — knowledgeable and specific, not a brochure.
- Let the concrete substance be the appeal. Real, well-chosen details persuade more than adjectives. TEST: if you can delete an adjective and the sentence still says something true and specific, that adjective was marketing — cut it.
- BANNED marketing register (vague, evocative, promotional — it informs nothing): "authentic", "atmosphere", "vibe", "full experience", "ultimate", "unforgettable", "stunning", "breathtaking", "magical", "immersive", "iconic", "Old West culture", "frontier atmosphere", "adventure of a lifetime", "soak in", "nestled", "gateway". Name the concrete thing instead — what you do, see, eat, where you sleep.
- An advisor states the real shape of the trip plainly, including the unglamorous parts (the return leg is by road, it is a two-day commitment). That measured honesty is what separates an advisor from a seller. Keep the verdict ("worth it / best for") out — that lives in another section.
HOW TO WRITE IT:
- Convey the appeal by DESCRIBING WHAT YOU CONCRETELY DO AND GET, drawn straight from the real tour features (what's included, the main activity, the format). Let the experience speak for itself; never pitch it or claim it is special.
- Lead with the single most compelling REAL thing you actually do on this tour.
- Second person ("you"), warm and direct. Put ONE **bold** phrase on the heart of the appeal.
- ASSERT ONLY WHAT THE SOURCE SUPPORTS. If the tour data does not state it, do not write it — even if it might be true. The page's whole value is that every claim can be backed up.
- This rules out COMPARISONS (you have no data on other tours): no "other tours", "most tours", "typical day trips", "standard", "unlike", "versus", "compared to".
- It also rules out UNSUPPORTED DISTINCTIVENESS (the data does not establish these): no "only", "the only", "first", "unique", "one of a kind", "rare", "best", "no other", "most visitors", "few travelers", "that most people never see". Describe what the tour IS, not how special it is.
- Do NOT give a verdict or "worth it / best for" language — that lives in other sections.
- Do NOT use "combines", "offers", "includes both", "this tour features", or "this is a [duration] experience". Start from the experience itself.
- BAD (asserts more than the source supports — never write like this): "This is the only tour that...", "an experience most visitors never get", "a rare chance to fly..."
- GOOD (concrete, straight from the source — write like this): "[plain description of what you actually do and get on THIS tour, using only its real features, ending on the core appeal in **bold**]"

### 🏛️ What You'll See
LENGTH: 4-6 bullet points of specific sights, stops, or activities.
FORMAT: Each bullet = stop/feature name + one factual detail THAT APPEARS IN the Description, Highlights, or Includes.
- Be specific to THIS tour, drawn ONLY from the tour data (Title, Description, Highlights, Includes).
- If the source gives no detail for a stop, write just the stop name. Do NOT add scene/atmosphere/significance/measurements the source does not state (no "largest reservoir", no "cable-stayed bridge", no "4,000 feet", no "feels like").
- Adapt to the tour type: for sightseeing tours these are viewpoints/landmarks; for activity tours these are the activities and locations; for shows these are the segments or performers; for nightlife these are the venues.
- Example bullets (PLACEHOLDER FORMAT ONLY — these are not real content, never copy any name or detail from here):
  - **[Stop or landmark named in the source]** — [the one factual detail the source gives for it, or nothing]
  - **[Activity named in the Includes/Description]** — [factual detail from the source, or nothing]
  - **[Another stop from the source]** — [source detail, or just the name]

### 🗺️ The Itinerary
LENGTH: 3-6 steps, ONLY if the Description or Highlights actually describe a sequence. If the source gives no real sequence, write a SHORT high-level flow from what IS known (pickup -> main activity -> return) and nothing more.
FORMAT: Each step on its OWN line, one short factual sentence.
- Use ONLY stops, transport, and order that appear in the Title, Description, Highlights, or Includes.
- Do NOT invent durations or "time in parentheses" (no "(45 min)", "(2.5 hr)", "(4 hours)") unless that exact timing is in the tour data.
- Do NOT add experiential or visual color ("the canyon opens in layered red rock", "with no railing in sight"). Steps are factual, not scenic.
- If pickup/transport is included, you may note it as a step; do NOT invent drive times.
- Example (PLACEHOLDER FORMAT ONLY — never copy any name or detail from here; note there are NO times):
  [Pickup/start step from the source].

  [Transport or movement step named in the source].

  [Main activity or stop from the Includes/Description].

  [Return step from the source].

### 🛡️ Practical Info
LENGTH: Structured list format. NO emojis in bullets.
THIS IS THE MOST IMPORTANT SECTION FOR AI CITATION.
Format as clear label-value pairs with bold on key values. Include the UNIVERSAL lines, then add the TYPE-SPECIFIC lines that match THIS tour (see the TOUR-TYPE CONTEXT block):

UNIVERSAL:
- **Departure / Pickup:** [hotel pickup included, or the meeting point and time]
- **Best Time to Visit:** [type-appropriate — e.g., early departures for day trips; night for Strip helicopter flights]
- **What to Bring:** [type-appropriate essentials]
- **Free Cancellation:** **[policy details from tour data]**
- **Booking Tip:** **[book ahead in peak periods]**

TYPE-SPECIFIC (include ONLY the lines relevant to THIS tour's type):
- Grand Canyon / Day Trips / Adventure (desert): **What to Bring:** **water, sun protection, hat, layers, closed-toe shoes.** **Drive Time:** **[approx. round-trip driving hours].** **Physical Level:** **[if walking, hiking, or ATV riding is involved].**
- Helicopter: **Weight Policy:** **Passengers are weighed at check-in for safety and seat balancing; heavier passengers may incur a comfort-seat fee.** **Departure Point:** **[helipad / executive airport, with hotel or limo pickup if included].**
- Nightlife: **Minimum Age:** **21+ (Nevada legal age).** **ID Required:** **Government photo ID or passport.** **Dress Code:** **Upscale club attire — no shorts, athletic wear, sandals, or hats, especially for men.**
- Shows: **Minimum Age:** **[state if the show is adults-only / 18+].** **Seating:** **Assigned by ticket category.** **Late Entry:** **Doors close at start time; latecomers may not be admitted.**
- Shooting range / firing range (adventure): **Minimum Age** and **ID / waiver** requirements as per the operator.



### Frequently Asked Questions
FORMAT: 4-6 Q&A pairs. Each answer: 1-3 sentences, direct and scannable.
- Questions must be REAL questions people ask (Google "People Also Ask" style).
- First sentence = direct answer. Second sentence = useful context if needed.
- Do NOT repeat tour details (duration, price) already stated above.
- Answers must come from the tour data. If a specific figure (drive time, segment length, exact distance) is NOT in the data, do NOT invent it — answer qualitatively or say to confirm with the operator when booking.
- Pick the most relevant for THIS tour's type:
  - Grand Canyon: Is this the West Rim or the South Rim? Is the Skywalk included? How long is the drive each way?
  - Helicopter: Is there a weight limit? Does the price include hotel pickup? Is this a night flight over the Strip or a Grand Canyon landing tour?
  - Hoover Dam: Does the tour go inside the dam or is it a photo stop? How much time is spent at the dam?
  - Day Trips: How long is the day? Are meals included? Is the Navajo guide for Antelope Canyon included?
  - Adventure: What should I wear? Is there a minimum age? Do I need prior experience?
  - Nightlife: What is the dress code? What is the minimum age? Is bottle service included or is it general admission?
  - Shows: Is there an age minimum? Are seats assigned? What happens if I arrive late?
  - Strip / City: Where does the tour start? Is hotel pickup included? How much walking is involved?
  - Universal: Is hotel pickup included? What is the cancellation policy?
- BAD: "Is Las Vegas worth visiting?" (generic)
- GOOD: "Is this the West Rim or the South Rim?" (specific, actionable)

Example:
**Q: Is this tour to the West Rim or the South Rim?**
A: This tour goes to the West Rim, about 2.5 hours from Las Vegas and home to the Skywalk. The South Rim is farther, roughly 4.5 hours each way.

**Q: Is the Skywalk included in the price?**
A: The Skywalk is usually an optional add-on, not included in the base price. Check the inclusions before booking if it is a priority.

**Q: Does the price include hotel pickup?**
A: Round-trip transport from select Strip hotels is included on most West Rim coach tours. Confirm your hotel is on the pickup list when booking.

### 📊 Compare with Similar Tours
RULES: Only include this section if you have REAL data about other tours from the provided tour data.
- If no comparison data is available, OMIT THIS ENTIRE SECTION. Do not write "Check our page" — just skip it completely.
- If data is available: use a Markdown table with columns: Tour | Price | Duration | Rating | Features
- Only compare Las Vegas tours of the SAME type. NEVER invent tour names or prices.


---

FORMATTING RULES:
1. NO title/H1 — this is handled separately
2. Start with Quick Info line: ⭐ Rating/5 (reviews) | 💰 $PRICE | ⏱️ Duration | 👥 Max SIZE people
3. Use ### for all section headers
4. Lists: "- " format (dash + space), NEVER "*"
5. Bold labels in data sections: **Label:** value
6. EMOJIS: ONLY in section headers (### 📊, ### ✅, ### ❌, etc). NEVER in bullet items or prose.
7. Use **bold** strategically on key data: prices, durations, differentiators
8. In Quick Answer: bold the duration and price
9. In What Makes Different: bold the key benefit
10. In Practical Info: bold the most important value in each line

WRITING STANDARDS:
- Write as a knowledgeable travel analyst, not a marketer
- Every sentence must add factual value — zero filler
- Base all content on provided tour data — do NOT invent features not in the data
- PROPER-NOUN LOCKDOWN (critical): every place name, landmark, road, bridge, river, reservoir, vehicle, or brand you write MUST appear verbatim in the Title, Description, or Includes above. If a proper noun is NOT in that source text, you may NOT write it — even if you are certain it is accurate (no "Mercedes Sprinter", "Hoover Dam Bypass Bridge", "Joshua Tree Forest", "Nevada's largest reservoir" unless those exact words are in the source). When in doubt, name only what the source names.
- The DESTINATION CONTEXT and TOUR-TYPE CONTEXT are REFERENCE KNOWLEDGE — they describe the destination, NOT this specific tour
- If group size is "not specified", write "not specified" — do NOT guess a number
- If an inclusion (Skywalk, meals, hotel pickup) is not in the Includes list, do NOT state it as included. Highlights describe the experience and do NOT by themselves mean something is included (e.g., "lunch at the cafe" in a highlight is not the same as lunch being included).
- Do NOT present route landmarks (e.g., Hoover Dam, Lake Mead) as part of the tour unless the Title, Description, Highlights, or Includes name them. The context blocks are background only, not the tour's itinerary.
- Use correct place names: "West Rim" and "South Rim" (Grand Canyon), "the Strip", "Fremont Street", "Hoover Dam", "Antelope Canyon"

TONE: Authoritative, data-driven, helpful. Like a knowledgeable friend who researches everything before recommending, not a marketing copywriter.
`
};

export const promptBuilder = (tourData) => {
  const tourContext = getQuickAnswerIntro(tourData);
  const typeContext = VEGAS_TYPE_CONTEXT[tourContext.categorySlug] || VEGAS_TYPE_CONTEXT['strip-tours'];

  // Deterministic meal check: only treat a meal as included if it appears in the Includes list.
  const includesText = (tourData.includes || []).join(' ').toLowerCase();
  const mealInIncludes = /\b(lunch|meal|meals|breakfast|dinner|brunch|bbq|barbecue|buffet|food)\b/.test(includesText);
  const mealRule = mealInIncludes
    ? ''
    : `\n- MEALS: No meal appears in the Includes list for this tour. Do NOT state or imply that any meal (lunch, breakfast, dinner) is included anywhere — not in Quick Answer, By the Numbers, What's Included, Not Included, The Itinerary, or FAQ. A highlight mentioning food (e.g. "have lunch at the cafe") only means a meal stop exists on the route; phrase it as optional / at own expense, never as included.`;

  // Deterministic group-size check: only use a size descriptor when it is actually known.
  const hasExplicitGroupSize = !!(tourData.groupSize || tourData.features?.groupSize);
  const groupSizeRule = (tourContext.isPrivate || tourContext.isSemiPrivate)
    ? `\n- TOUR FORMAT SIZE: this tour is private/semi-private — use "Private" (or "Semi-private") as the size word in the Tour Format sentence.`
    : (tourContext.isSmallGroup || hasExplicitGroupSize)
      ? `\n- TOUR FORMAT SIZE: a group size is known for this tour — only use "small-group" if the data actually supports it.`
      : `\n- TOUR FORMAT SIZE: group size is NOT specified for this tour. Do NOT use any size descriptor ("small group", "intimate group", "group", "small-group") in the Tour Format sentence or anywhere else; start the Tour Format with the duration instead (e.g. "2-hour pilot-flown Las Vegas helicopter night flight covering ...").`;

  // Deterministic provider line: respect the role GetYourGuide shows ("Distributor:" for GYG-exclusive products vs a real operator).
  const rawProvider = (tourData.provider || '').trim();
  const isDistributor = /^distributor\s*:/i.test(rawProvider);
  const providerName = rawProvider.replace(/^distributor\s*:\s*/i, '').trim();
  const operatorRule = isDistributor
    ? `\n- OPERATOR/DISTRIBUTOR: GetYourGuide lists this activity as "Distributor: ${providerName}" (it is a GYG-exclusive product; this company does NOT operate the tour). In By the Numbers use EXACTLY the line "- **Distributor:** ${providerName}". Do NOT label it "Operator", do NOT write "Operator: Distributor: ...", and do NOT state that any company "operates", "runs", or "hosts" the tour anywhere in the content.`
    : (providerName
      ? `\n- OPERATOR/DISTRIBUTOR: In By the Numbers use EXACTLY the line "- **Operator:** ${providerName}".`
      : `\n- OPERATOR/DISTRIBUTOR: No operator or distributor is specified for this tour. OMIT the provider line from By the Numbers entirely and do NOT name or invent any operator anywhere.`);

  return `${postTemplate.instructions}

TOUR-TYPE CONTEXT (this specific tour is a ${tourContext.tourType} — use ONLY this block plus the base context for destination facts):
${typeContext}

TOUR DATA:
- Location: Las Vegas, Nevada
- Title: ${tourData.title}
- Duration: ${tourData.duration || 'Not specified'}
- Group Size: ${tourData.groupSize || tourData.features?.groupSize || (tourContext.isSmallGroup ? 'Small group (exact number not specified)' : 'Not specified')}
- Price: ${tourData.price || 'Not specified'}
- Rating: ${tourData.rating || 'Not specified'}
- Review Count: ${tourData.reviewCount || 'Not specified'}
- Provider: ${tourData.provider || 'Not specified'}
- Description: ${tourData.description || 'None provided'}
- Highlights: ${tourData.highlights?.join(', ') || 'None provided'}
- Includes: ${tourData.includes?.join(', ') || 'None provided'}
- Languages: ${tourData.languages || 'English'}
- Features: ${JSON.stringify(tourData.features || {})}
- URL: ${tourData.url || ''}

DETECTED TOUR CHARACTERISTICS:
- Tour Type: ${tourContext.tourType}
- Category: ${tourContext.categorySlug}
- Private: ${tourContext.isPrivate ? 'Yes' : 'No'}
- Small Group: ${tourContext.isSmallGroup ? 'Yes' : 'No'}
- Semi-Private: ${tourContext.isSemiPrivate ? 'Yes' : 'No'}
- Skip the Line / VIP Entry: ${tourContext.isSkipLine ? 'Yes' : 'No'}
- Hotel Pickup / Transport: ${tourContext.isHotelPickup ? 'Yes' : 'No'}
- Family/Kids: ${tourContext.isFamily ? 'Yes' : 'No'}
- 21+ / Adults Only: ${tourContext.is21Plus ? 'Yes' : 'No'}
- VIP: ${tourContext.isVIP ? 'Yes' : 'No'}
- Helicopter: ${tourContext.isHelicopter ? 'Yes' : 'No'}
- Airplane / Air Tour: ${tourContext.isAirplane ? 'Yes' : 'No'}
- Landing Tour: ${tourContext.isLanding ? 'Yes' : 'No'}
- Night Flight: ${tourContext.isNightFlight ? 'Yes' : 'No'}
- West Rim: ${tourContext.isWestRim ? 'Yes' : 'No'}
- South Rim: ${tourContext.isSouthRim ? 'Yes' : 'No'}
- Skywalk: ${tourContext.isSkywalk ? 'Yes' : 'No'}
- Day Trip: ${tourContext.isDayTrip ? 'Yes' : 'No'}
- Combo: ${tourContext.isCombo ? 'Yes' : 'No'}
- Mentions Hoover Dam: ${tourContext.mentionsHoover ? 'Yes' : 'No'}
- Mentions Lake Mead: ${tourContext.mentionsLakeMead ? 'Yes' : 'No'}
- Self-Guided/Audio: ${tourContext.isSelfGuided ? 'Yes' : 'No'}
- Ticket Only: ${tourContext.isTicketOnly ? 'Yes' : 'No'}
- Includes Meal: ${tourContext.hasMeal ? 'Yes' : 'No'}
- Bottle/Table Service: ${tourContext.hasBottleService ? 'Yes' : 'No'}

DESTINATION: Las Vegas, Nevada
(ONLY compare with other Las Vegas tours of the same type. NEVER mention unrelated cities or destinations.)

Generate content following the exact structure above.

**START WITH THIS EXACT FORMAT:**

⭐ ${tourData.rating || 'N/A'}/5 (${tourData.reviewCount || '0'} reviews) | 💰 $${tourData.price || 'N/A'} | ⏱️ Duration: ${tourData.duration || 'N/A'} | 👥 ${tourData.groupSize || tourData.features?.groupSize || (tourContext.isSmallGroup ? 'Small group' : 'N/A')} people

### 💡 Quick Answer
[Experiential first sentence combining what it IS + key data — citable by AIs]





[Continue with ALL remaining sections in order...]

*CRITICAL RULES:**${mealRule}${groupSizeRule}
- Quick Answer: vary opening structure, NEVER always start with "This". Lead with facts (duration + price), close with decision-pushing sentence. 2-3 sentences, 40-60 words.
- What You'll See = specific stops, activities, or segments THIS tour covers, drawn ONLY from the tour data
- The Itinerary = pickup/start, transport, stops in source order — NO invented times, NO experiential color
- Practical Info = type-appropriate (pickup, what to bring, drive time, weight policy, dress code/age, late entry) — use ONLY the lines that fit this tour's type
- FAQ = real questions with direct answers, specific to THIS tour's type
- Compare Tours = Las Vegas tours of the SAME type ONLY (if no data, OMIT entirely)
- Every section's first sentence must work as a standalone answer
- DESTINATION CONTEXT and TOUR-TYPE CONTEXT are reference knowledge ONLY — do NOT assume Skywalk, meals, or hotel pickup unless tour data says so. Included = only what is in the Includes list; Highlights are NOT inclusions; do NOT present route landmarks (Hoover Dam, Lake Mead) as tour stops unless the tour data names them
- Do NOT mix facts from other tour types (no club dress code on a canyon tour, no weight policy on a show)
- If a data field says "not specified", write "not specified" — NEVER invent numbers
- PRICING: private/semi-private/private helicopter/party bus buyout/private transport => price is "per group" / "total (private tour)", NEVER "per person". Group/small-group/shared/ticket/club pass => "per person". Stay consistent everywhere the price appears.
- Use correct place names: West Rim, South Rim, the Strip, Fremont Street, Hoover Dam, Antelope Canyon
- NO poetry or flowery language
- NO comparisons with other cities or destinations
- NO fabricated reviews
- NO "unforgettable", "hidden gems", "trip of a lifetime", "must-see", "breathtaking", "world-class"
- NO inventing data that is not in the tour information
- PROPER NOUNS: every place, landmark, bridge, road, reservoir, vehicle or brand MUST appear verbatim in the Title/Description/Includes. If it is not in the source text, do NOT write it, even if you know it is true.

---

AFTER ALL SECTIONS, add these lines:

H1_TITLE: [MAX 55 chars — Must be UNIQUE. Use the original GYG title "${tourData.title}" to find THIS tour's unique differentiator: rim choice, duration (${tourData.duration}), flight type, combo, group size, or audience. Rotate vocabulary to avoid repeating patterns across tours:
- "tour" can also be: "day trip" / "excursion" / "experience" / "adventure"
- "skip the line" can also be: "VIP entry" / "line skip" / "express entry" / "priority access"
- "small group" can also be: "intimate group" / "semi-private" / "max-12 tour"
- "private" can also be: "exclusive" / "personal" / "dedicated"
- "helicopter" can also be: "heli flight" / "aerial tour"
NO provider name, NO emojis, NO price in title.]

EXISTING TITLES (your H1 MUST be different from ALL of these):
${tourData.existingTitles?.length > 0 ? tourData.existingTitles.map(t => '- ' + t).join('\n') : '- None yet'}

H2_TITLE: [Slightly different from H1 — can be more descriptive, mention a specific stop like the West Rim, Skywalk, Hoover Dam, or the venue]

SEO_DESCRIPTION: [150-160 chars — include price, duration, key feature, "Las Vegas" — factual hook for search results]

KEYWORDS: [5-7 keywords comma-separated based on actual tour content]
`;
};

export { getQuickAnswerIntro, getCityDisplayName };
// vegas-operator-fix