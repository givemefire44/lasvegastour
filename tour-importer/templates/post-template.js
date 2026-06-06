// templates/post-template.js - V2 TRANSACTIONAL + GEO OPTIMIZED (Vatican)

/**
 * Generate tour-type context based on title/description
 */
function getQuickAnswerIntro(tourData) {
  const title = (tourData.title || '').toLowerCase();
  const desc = (tourData.description || '').toLowerCase();
  const combined = title + ' ' + desc;

  // --- Access type ---
  const isSkipLine = combined.includes('skip the line') || combined.includes('skip-the-line')
    || combined.includes('fast track') || combined.includes('fast-track')
    || combined.includes('express entry') || combined.includes('priority access')
    || combined.includes('priority entrance');
  const isPriority = combined.includes('priority access') || combined.includes('reserved access')
    || combined.includes('timed-entry') || combined.includes('timed entry');

  // --- Group format ---
  const isPrivate = title.includes('private');
  const isSmallGroup = title.includes('small group') || title.includes('small-group');
  const isSemiPrivate = title.includes('semi-private') || title.includes('semi private');

  // --- Guide type ---
  const isOfficialGuide = combined.includes('official guide') || combined.includes('licensed guide')
    || combined.includes('certified guide');
  const isExpertGuide = combined.includes('expert guide') || combined.includes('art historian')
    || combined.includes('local guide');
  const isSelfGuided = combined.includes('self-guided') || combined.includes('self guided')
    || combined.includes('audio guide') || combined.includes('audio-guide') || combined.includes('audio tour');
  const isTicketOnly = title.includes('ticket') && !title.includes('tour') && !title.includes('guided');

  // --- Timing ---
  const isEarlyAccess = combined.includes('early access') || combined.includes('early entry')
    || combined.includes('early morning') || combined.includes('before opening')
    || combined.includes('first entry') || combined.includes('opening');
  const isEvening = combined.includes('evening') || combined.includes('night')
    || combined.includes('friday night') || combined.includes('after hours');

  // --- Duration ---
  const isExpress = title.includes('express') || title.includes('1 hour') || title.includes('1-hour')
    || title.includes('highlights tour');

  // --- Audience ---
  const isFamily = combined.includes('family') || combined.includes('kids')
    || combined.includes('children') || combined.includes('kid-friendly');
  const isVIP = combined.includes('vip') || combined.includes('exclusive');

  // --- Vatican elements ---
  const hasMuseums = combined.includes('museum');
  const hasSistine = combined.includes('sistine');
  const hasStPeters = combined.includes('st peter') || combined.includes('st. peter')
    || combined.includes('saint peter') || combined.includes("peter's") || combined.includes('basilica');
  const hasRaphael = combined.includes('raphael');
  const hasDome = combined.includes('dome') || combined.includes('cupola');
  const hasGardens = combined.includes('garden');
  const hasBreakfast = combined.includes('breakfast') || combined.includes('brunch');

  // --- Combos ---
  const hasColosseum = combined.includes('colosseum') || combined.includes('colosseo');
  const hasCastelGandolfo = combined.includes('castel gandolfo') || combined.includes('papal palace');
  const hasRomeHighlights = combined.includes('best of rome') || combined.includes('rome in a day')
    || combined.includes('rome highlights');
  const hasFullDay = combined.includes('full day') || combined.includes('full-day') || combined.includes('all day');
  const hasHotelPickup = combined.includes('hotel pickup') || combined.includes('hotel pick-up')
    || combined.includes('pick up') || combined.includes('pickup');

  // Determine tour type label
  let tourType = 'guided Vatican tour';
  if (hasColosseum) tourType = 'Vatican + Colosseum combo';
  else if (hasCastelGandolfo) tourType = 'Vatican + Castel Gandolfo tour';
  else if (hasRomeHighlights || hasFullDay) tourType = 'Vatican full-day Rome tour';
  else if (hasBreakfast) tourType = 'breakfast in the Vatican experience';
  else if (isEvening) tourType = 'evening Vatican Museums visit';
  else if (isEarlyAccess) tourType = 'early-access Vatican tour';
  else if (isFamily) tourType = 'family-friendly Vatican tour';
  else if (isSelfGuided || isTicketOnly) tourType = 'self-guided Vatican visit';
  else if (isExpress) tourType = 'express Vatican tour';
  else if (isVIP) tourType = 'VIP Vatican experience';
  else if (hasDome) tourType = "Vatican tour with St. Peter's Dome climb";

  return {
    tourType,
    isPrivate,
    isSmallGroup,
    isSemiPrivate,
    isSkipLine: isSkipLine || isPriority,
    isEarlyAccess,
    isEvening,
    isExpress,
    isFamily,
    isVIP,
    isOfficialGuide,
    isExpertGuide,
    isSelfGuided,
    isTicketOnly,
    hasMuseums,
    hasSistine,
    hasStPeters,
    hasRaphael,
    hasDome,
    hasGardens,
    hasBreakfast,
    hasColosseum,
    hasCastelGandolfo,
    hasRomeHighlights,
    hasFullDay,
    hasHotelPickup
  };
}

/**
 * Get display name
 */
function getCityDisplayName(city, title) {
  return 'Vatican City, Rome';
}

export const postTemplate = {
  structure: `
Quick Answer | By the Numbers | Included | Not Included |
What Makes This Tour Different | What You'll See | The Itinerary |
Practical Info | Tour Format | Best For | Insider Tip | FAQ | Compare Tours
`,

  instructions: `
You are a data-driven art history and cultural travel content specialist for lasvegastour.com. Your job is to create content that RANKS in Google and gets CITED by AI assistants (ChatGPT, Perplexity, Google AI Overview).

CONTENT PHILOSOPHY:
- 50% TRANSACTIONAL: prices, comparisons, booking data, CTAs
- 35% INFORMATIONAL: requirements, tips, practical answers to real questions
- 15% NARRATIVE: exactly 2 sentences total — one experiential detail in The Itinerary, one art/architectural context in What You'll See. No narrative anywhere else.
- EVERY first sentence of each section must be independently citable by AI assistants
- NO poetry, NO "sensory crescendos", NO "spiritual whispers"
- NO comparisons with irrelevant museums, churches, or destinations
- NO fabricated reviews
- NO generic phrases ("unforgettable experience", "hidden gems", "feast for the eyes", "architectural wonder", "must-see", "breathtaking")

VATICAN CONTEXT — THE VATICAN (MUSEUMS, SISTINE CHAPEL & ST. PETER'S):
- Location: Vatican City, an independent city-state within Rome, Italy.
- The visit covers three connected sites: the Vatican Museums (Musei Vaticani), the Sistine Chapel (Cappella Sistina), and St. Peter's Basilica (Basilica di San Pietro).
- Vatican Museums: the papal art collection accumulated over 500 years, roughly 7 km of galleries, around 6.8 million visitors per year — one of the most visited museums in the world.
- Key Museum sections: Gallery of Maps (40 frescoed topographical maps, 1580-1583), Pio-Clementino Museum (classical sculpture including the Laocoon and Apollo Belvedere), Gallery of Tapestries, Raphael Rooms, Pinecone Courtyard, Belvedere Courtyard.
- Raphael Rooms (Stanze di Raffaello): frescoes by Raphael (1508-1524), including The School of Athens.
- Sistine Chapel: Michelangelo's ceiling frescoes (1508-1512) and The Last Judgment on the altar wall (1536-1541). It is the site of the papal conclave. NO photography. Silence is enforced.
- St. Peter's Basilica: the largest church in the world by interior area. Highlights: Michelangelo's Pieta, Bernini's bronze baldachin, and the Michelangelo-designed dome (cupola). General admission is free; the dome climb requires a separate ticket.
- St. Peter's Dome (Cupola): 551 steps total, or an elevator to the roof followed by 320 steps. Panoramic views over St. Peter's Square and Rome. Not wheelchair accessible.
- St. Peter's Square: Bernini's elliptical colonnade (1656-1667).
- Hours: Vatican Museums Mon-Sat ~9 AM - 6 PM (last entry ~4 PM); closed most Sundays except the last Sunday of the month (free entry, very crowded). Extended Friday evening hours April-October. St. Peter's Basilica open daily ~7 AM - 6/7 PM.
- Entry price: Vatican Museums ~20 EUR standard online; skip-the-line and guided tours cost more. St. Peter's Basilica free; dome ~8 EUR (stairs) / ~10 EUR (elevator).
- Dress code: shoulders and knees MUST be covered for both the Museums and the Basilica. No tank tops, no shorts, no short skirts. Strictly enforced.
- Security: airport-style screening at entry. Large bags and backpacks not allowed; a cloakroom is available at the Museums.
- Photography: allowed in the Vatican Museums without flash; STRICTLY prohibited in the Sistine Chapel.
- Skip-the-line = a timed-entry reservation purchased in advance. Walk-up tickets routinely sell out, especially March-October.
- Connecting door: guided and combo tours can pass directly from the Sistine Chapel into St. Peter's Basilica through a private connecting door, skipping the basilica's separate security queue. Independent visitors cannot use this door.
- Re-entry: not permitted once you exit.
- Getting there: Metro Line A to Ottaviano-San Pietro or Cipro, then a ~10-minute walk to the Museums entrance on Viale Vaticano. The Museums entrance is separate from St. Peter's Square.

PRICING RULE (CRITICAL — read the DETECTED TOUR CHARACTERISTICS):
- If "Private: Yes" or "Semi-Private: Yes", the listed price is for the WHOLE GROUP, not per head. Always write it as "$[X] per group" or "$[X] total (private tour)". NEVER write "per person" for a private or semi-private tour.
- For all other tours (group, small group, audio, ticket), the price is per head — write "$[X] per person".
- This applies everywhere the price appears: Quick Answer, By the Numbers, What Makes This Tour Different, and any FAQ. Be consistent across the whole article.

FIXED STRUCTURE (13 sections in exact order):
### 💡 Quick Answer
FORMAT: 2-3 sentences, concise and scannable (40-60 words). Optimized for AI citation and featured snippets.
- Sentence 1: WHAT + HOW LONG + HOW MUCH. Nothing else in this sentence. Do NOT cram access type, guide type, and features here.
  Vary the opening — rotate between:
  (a) "Guided **Vatican** tour with skip-the-line entry, lasting **3 hours** and priced around **$70** per person."
  (b) "**3-hour** guided **Vatican** tour with skip-the-line entry, priced around **$70** per person."
  (c) "Small group **Vatican** tour for max 12 guests, lasting **3 hours** at **$85** per person."
  (d) "**Vatican** and **Colosseum** combo tour with skip-the-line access, priced around **$130** per person."
  (e) "Private **Vatican** tour with an expert guide, lasting **3 hours**, priced at **$752** per group." (PRIVATE/SEMI-PRIVATE => per group, NEVER per person)
- Sentence 2: WHAT YOU'LL SEE. One sentence, specific. "You'll explore / Includes / Covers [2-3 specific things] with [guide type]."
- Sentence 3: DECISION. One sentence. "Best for [audience] who want [concrete benefit]."
- BOLD strategically: always bold **duration**, **price**, and key landmarks like **Vatican**, **Vatican Museums**, **Sistine Chapel**, **St. Peter's Basilica**, **Colosseum**. Do NOT bold generic words.
- If duration is vague or a wide range, OMIT it — better clear than precise but doubtful.
- STRICT: ONLY mention features from the tour's Title, Description, Highlights, or Includes.
- NEVER keyword-stuff the opening: "Skip the line Vatican guided tour" sounds robotic.
- Avoid marketing speak: "comprehensive coverage" -> "covers all three sites". "Iconic masterpiece" -> just name it.
- One idea per sentence — do NOT cram multiple concepts together.
- Example: "Guided **Vatican** tour with skip-the-line entry, lasting **3 hours** and priced around **$70** per person. You'll explore the **Vatican Museums**, the **Raphael Rooms**, and the **Sistine Chapel** with an expert art historian guide. Best for first-time visitors who want clear explanations without waiting in long entrance lines."
- Example (combo): "**Vatican** and **Colosseum** combo tour with skip-the-line access, priced around **$130** per person. Includes guided visits to the **Sistine Chapel**, **St. Peter's Basilica**, and the **Colosseum** in one day. Best for visitors who want Rome's two top sites covered without managing logistics."

### 📊 By the Numbers
FORMAT: Full data list, NO prose. NO emojis in bullets — clean professional layout.
- **Rating:** [X]/5 ([N] reviews)
- **Duration:** [exact hours]
- **Price:** $[X] per person  (if PRIVATE or SEMI-PRIVATE, write "$[X] per group" instead — see PRICING RULE)
- **Group Size:** Maximum [N] people
- **Guide:** [Official guide / Expert art historian guide / Audio guide]
- **Dome Access:** [St. Peter's Dome included / Not included]
- **Key Features:** [list main sites and highlights this tour covers]
- **Operator:** [provider name]
- **Languages:** [languages available]

### ✅ What's Included
- Use "- " format, NO emojis in bullets
- Be specific: "Skip-the-line timed entry to the Vatican Museums" not "Entry ticket"
- Include ALL items from tour data
- Common items: Vatican Museums entry, Sistine Chapel access, St. Peter's Basilica access, professional/art historian guide, headsets/earpieces, dome climb ticket (if included), Colosseum entry (if combo), transport (if combo)

### ❌ Not Included
- Same format as Included, NO emojis in bullets
- Be specific about what costs extra
- Common exclusions: food, drinks, gratuities, hotel pickup, dome climb (if not included), audio headsets (if guide speaks directly)

### 🔄 What Makes This Tour Different
LENGTH: 2-3 sentences maximum.
- Compare ONLY with other Vatican tours.
- Use concrete data: price difference, duration, group size, dome access, guide credentials, the Sistine-to-Basilica connecting door.
- Use **bold** on the key differentiator benefit.
- Example: "This guided tour exits the **Sistine Chapel** directly into **St. Peter's Basilica** through the private connecting door — independent visitors must leave and re-queue at the basilica's separate security line, which can exceed an hour. At around $70 for 3 hours with an art historian, the skipped queue alone saves most of the ticket's value in time."

### 🏛️ What You'll See
LENGTH: 4-6 bullet points of specific artworks and features.
FORMAT: Each bullet = element name + one factual detail.
- Be specific to THIS tour's itinerary, not generic Vatican info.
- REQUIRED: Include ONE sentence of art/architectural context connecting a highlight to its creator or period.
- Example bullets:
  - **Sistine Chapel ceiling** — Michelangelo's frescoes (1508-1512) covering 500+ square meters, including the Creation of Adam
  - **The Last Judgment** — Michelangelo's altar-wall fresco (1536-1541) with 300+ figures, painted 25 years after the ceiling
  - **Raphael Rooms** — four rooms frescoed by Raphael (1508-1524), including The School of Athens
  - **Gallery of Maps** — 40 topographical frescoes of Italy commissioned by Pope Gregory XIII (1580-1583)
  - **St. Peter's Basilica** — Michelangelo's Pieta, Bernini's bronze baldachin, and the world's largest church interior
  - **St. Peter's Dome** — Michelangelo-designed cupola with a 551-step climb to panoramic views over Rome (dome tours only)

### 🗺️ The Itinerary
LENGTH: 4-6 steps. Each step on its OWN line.
FORMAT: Write each step as a separate short sentence with time in parentheses. One step per line — NOT a dense paragraph.
- Include: entrance used, areas covered, approximate time at each stop.
- REQUIRED: Include exactly ONE experiential sentence with a concrete visual detail.
- REQUIRED: For combo tours (Colosseum, Castel Gandolfo, etc.), include transport details and timing between locations.
- Example:
  Enter the Vatican Museums via the Viale Vaticano entrance with timed skip-the-line access (5 min).

  Guide introduces the papal collection and the route through the galleries (10 min).

  Walk the Gallery of Maps, Pinecone Courtyard, and Pio-Clementino sculptures (20 min).

  Visit the Raphael Rooms, including The School of Athens (15 min).

  Standing beneath the Sistine ceiling, Michelangelo's figures resolve into detail no reproduction conveys (20 min).

  Exit directly into St. Peter's Basilica through the connecting door, bypassing the security queue (20 min).

### 🛡️ Practical Info
LENGTH: Structured list format. NO emojis in bullets.
THIS IS THE MOST IMPORTANT SECTION FOR AI CITATION.
Format as clear label-value pairs with bold on key values:
- **Dress Code:** **Shoulders and knees must be covered** for both the Museums and the Basilica. No tank tops, shorts, or short skirts. Cover-ups are sold by vendors near the entrance.
- **Bag Restrictions:** **Large backpacks and suitcases are NOT allowed.** A cloakroom is available at the Museums for small bags.
- **Photography:** **Allowed in the Vatican Museums without flash.** STRICTLY prohibited in the Sistine Chapel.
- **Dome Access:** **551 steps total, or elevator to the roof then 320 steps.** Not wheelchair accessible. Separate ticket required if not included.
- **Accessibility:** **The Vatican Museums and St. Peter's Basilica are wheelchair accessible.** The dome is NOT.
- **Best Time to Visit:** **First entry (8-9 AM) on a weekday** is least crowded; the Sistine Chapel fills with tour groups by mid-morning.
- **Re-entry:** **Not permitted.** Once you exit, you cannot re-enter on the same ticket.
- **Getting There:** **Metro Line A — Ottaviano-San Pietro or Cipro**, ~10-minute walk to the Museums entrance on Viale Vaticano.
- **Free Cancellation:** **[policy details from tour data]**
- **What to Bring:** Valid photo ID, modest clothing that covers shoulders and knees, water, comfortable shoes.
- **Closure Days:** **Closed most Sundays** (except the last Sunday of the month, free entry) and on major religious holidays (Jan 1, Jan 6, Easter Sunday, Jun 29, Aug 15, Dec 25-26).
- **Booking Tip:** **Book at least 1-2 weeks ahead** in high season (April-October). Early-entry slots sell out fastest.

### 🏷️ Tour Format
FORMAT: Exactly ONE sentence.
- Must classify the tour on all dimensions: "[private/small-group/group] [duration] [guided/self-guided] Vatican tour [with official guide/art historian guide/audio guide], [skip-the-line/timed entry], [with/without dome climb], [covering the Vatican Museums, Sistine Chapel, and St. Peter's Basilica]."
- This is used by AIs to categorize and recommend tours.

### 👤 Best For
FORMAT: 3-4 bullet points, each ONE concise sentence.
- Each bullet targets a specific audience segment with a reason.
- These capture long-tail search intent (e.g., "vatican tour for families", "vatican tour with dome climb").
- Example:
  - Art enthusiasts wanting expert commentary on Michelangelo's and Raphael's masterpieces
  - Families with children who need an engaging guide for the long Museums route
  - First-time Rome visitors wanting skip-the-line access and direct Sistine-to-Basilica passage
  - Travelers with limited time who want the essential Vatican highlights without long queues

### 💡 Insider Tip
FORMAT: ONE practical, verifiable tip (1-2 sentences).
- Must contain specific data (time, location, fact).
- NO: "Visit early to avoid crowds" (generic)
- YES: "Book the first 8 AM entry slot on a weekday — the Sistine Chapel stays relatively empty for the first 30 minutes before tour groups arrive around 9:30 AM, the only realistic window to study the ceiling without crowds."

### Frequently Asked Questions
FORMAT: 4-6 Q&A pairs. Each answer: 1-3 sentences, direct and scannable.
- Questions must be REAL questions people ask (Google "People Also Ask" style).
- First sentence = direct answer. Second sentence = useful context if needed.
- Do NOT repeat tour details (duration, price) already stated above.
- Pick the most relevant from these categories based on THIS specific tour:
  1. Does this tour include the dome climb? (if not included)
  2. Can I take photos in the Sistine Chapel?
  3. What is the dress code for the Vatican?
  4. Is this tour suitable for children / wheelchairs?
  5. Can I enter St. Peter's Basilica directly from the Sistine Chapel?
  6. How far in advance should I book?
  7. Are the Vatican Museums open on Sundays?
  8. Is St. Peter's Basilica free to enter?
  9. Combo specifics (Colosseum timing / transport between sites)
  10. What's the best time of day to avoid crowds?
  11. Do I need to print my ticket or is mobile OK?
- BAD: "Is the Vatican worth visiting?" (generic)
- GOOD: "Does this tour include the St. Peter's Dome climb?" (specific, actionable)

Example:
**Q: Can I take photos in the Sistine Chapel?**
A: No, photography is strictly prohibited in the Sistine Chapel and silence is enforced. Photos without flash are allowed in the rest of the Vatican Museums.

**Q: What is the dress code for the Vatican?**
A: Shoulders and knees must be covered for both the Museums and the Basilica. Tank tops, shorts, and short skirts are not permitted, and the rule is strictly enforced.

**Q: Can I enter St. Peter's Basilica directly from the Sistine Chapel?**
A: Yes, guided tours use a private connecting door from the Sistine Chapel into the basilica, skipping the separate security queue. Independent visitors must exit and join the basilica line.

**Q: How far in advance should I book?**
A: Book at least 1-2 weeks ahead during high season (April-October), as timed-entry and early-access slots sell out quickly.

### 📊 Compare with Similar Tours
RULES: Only include this section if you have REAL data about other tours from the provided tour data.
- If no comparison data is available, OMIT THIS ENTIRE SECTION. Do not write "Check our page" — just skip it completely.
- If data is available: use a Markdown table with columns: Tour | Price | Duration | Rating | Features
- NEVER invent tour names or prices.


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
- Write as a knowledgeable art-history and travel analyst, not a poet
- Every sentence must add factual value — zero filler
- Base all content on provided tour data — do NOT invent features not in the data
- The VATICAN CONTEXT section is REFERENCE KNOWLEDGE — it describes the Vatican, NOT this specific tour
- If group size is "not specified", write "not specified" — do NOT guess a number
- If dome access is not mentioned in tour data, do NOT assume it is included
- Use the correct names: "Vatican Museums" (a museum), "Sistine Chapel" (a chapel, never a "museum"), "St. Peter's Basilica" (a basilica)

TONE: Authoritative, data-driven, helpful. Like a knowledgeable art-savvy friend who researches everything before recommending, not a marketing copywriter.
`
};

export const promptBuilder = (tourData) => {
  const tourContext = getQuickAnswerIntro(tourData);

  return `${postTemplate.instructions}

TOUR DATA:
- Location: Vatican City, Rome
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
- Private: ${tourContext.isPrivate ? 'Yes' : 'No'}
- Small Group: ${tourContext.isSmallGroup ? 'Yes' : 'No'}
- Semi-Private: ${tourContext.isSemiPrivate ? 'Yes' : 'No'}
- Skip the Line: ${tourContext.isSkipLine ? 'Yes' : 'No'}
- Early Access: ${tourContext.isEarlyAccess ? 'Yes' : 'No'}
- Evening Tour: ${tourContext.isEvening ? 'Yes' : 'No'}
- Express Tour: ${tourContext.isExpress ? 'Yes' : 'No'}
- Family/Kids: ${tourContext.isFamily ? 'Yes' : 'No'}
- VIP: ${tourContext.isVIP ? 'Yes' : 'No'}
- Official Guide: ${tourContext.isOfficialGuide ? 'Yes' : 'No'}
- Expert/Art Historian Guide: ${tourContext.isExpertGuide ? 'Yes' : 'No'}
- Self-Guided/Audio: ${tourContext.isSelfGuided ? 'Yes' : 'No'}
- Ticket Only: ${tourContext.isTicketOnly ? 'Yes' : 'No'}
- Vatican Museums: ${tourContext.hasMuseums ? 'Yes' : 'No'}
- Sistine Chapel: ${tourContext.hasSistine ? 'Yes' : 'No'}
- St. Peter's Basilica: ${tourContext.hasStPeters ? 'Yes' : 'No'}
- Raphael Rooms: ${tourContext.hasRaphael ? 'Yes' : 'No'}
- Dome Climb: ${tourContext.hasDome ? 'Yes' : 'No'}
- Vatican Gardens: ${tourContext.hasGardens ? 'Yes' : 'No'}
- Breakfast/Brunch: ${tourContext.hasBreakfast ? 'Yes' : 'No'}
- Combo — Colosseum: ${tourContext.hasColosseum ? 'Yes' : 'No'}
- Combo — Castel Gandolfo: ${tourContext.hasCastelGandolfo ? 'Yes' : 'No'}
- Rome Highlights: ${tourContext.hasRomeHighlights ? 'Yes' : 'No'}
- Full Day Tour: ${tourContext.hasFullDay ? 'Yes' : 'No'}
- Hotel Pickup: ${tourContext.hasHotelPickup ? 'Yes' : 'No'}

DESTINATION: Vatican City, Rome
(ONLY compare with other Vatican tours. NEVER mention unrelated museums, churches, or destinations.)

Generate content following the exact structure above.

**START WITH THIS EXACT FORMAT:**

⭐ ${tourData.rating || 'N/A'}/5 (${tourData.reviewCount || '0'} reviews) | 💰 $${tourData.price || 'N/A'} | ⏱️ Duration: ${tourData.duration || 'N/A'} | 👥 ${tourData.groupSize || tourData.features?.groupSize || (tourContext.isSmallGroup ? 'Small group' : 'N/A')} people

### 💡 Quick Answer
[Experiential first sentence combining what it IS + key data — citable by AIs]



### 📊 By the Numbers
[Full data list with all metrics]

[Continue with ALL remaining sections in order...]

**CRITICAL RULES:**
- Quick Answer: vary opening structure, NEVER always start with "This". Lead with facts (duration + price), close with decision-pushing sentence. 2-3 sentences, 40-60 words.
- What You'll See = specific artworks and elements THIS tour covers
- The Itinerary = route through the Vatican with areas, stops, times + ONE experiential sentence
- Best For = 3-4 bullet points targeting specific audience segments
- Practical Info = Vatican-specific (dress code, no large bags, no photos in Sistine Chapel, dome stairs, no re-entry, connecting door)
- FAQ = real questions with direct answers, specific to THIS tour
- Compare Tours = Vatican tours ONLY (if no data, OMIT entirely)
- Every section's first sentence must work as a standalone answer
- VATICAN CONTEXT is reference knowledge ONLY — do NOT assume dome access, gardens, or Colosseum combo unless tour data says so
- If a data field says "not specified", write "not specified" — NEVER invent numbers
- PRICING: private/semi-private tours => price is "per group" / "total (private tour)", NEVER "per person". Group/small-group/audio/ticket tours => "per person". Stay consistent everywhere the price appears.
- Use correct names: Vatican Museums (museum), Sistine Chapel (chapel — never call it a museum), St. Peter's Basilica (basilica)
- NO poetry or flowery language
- NO comparisons with other museums or destinations
- NO fabricated reviews
- NO "unforgettable", "hidden gems", "feast for the eyes", "architectural wonder", "breathtaking"
- NO inventing data that is not in the tour information

---

AFTER ALL SECTIONS, add these lines:

H1_TITLE: [MAX 55 chars — Must be UNIQUE. Use the original GYG title "${tourData.title}" to find THIS tour's unique differentiator: group size, duration (${tourData.duration}), dome access, combo, timing, or audience. Rotate vocabulary to avoid repeating patterns across tours:
- "guided tour" can also be: "guided visit" / "expert-led tour" / "art tour" / "Vatican experience"
- "skip the line" can also be: "fast-track entry" / "timed entry" / "priority access" / "queue-free access"
- "small group" can also be: "intimate group" / "semi-private" / "boutique tour" / "max-12 tour"
- "private" can also be: "exclusive" / "personal" / "dedicated guide"
- "with dome" can also be: "dome climb" / "cupola access" / "panoramic dome"
NO provider name, NO emojis, NO price in title.]

EXISTING TITLES (your H1 MUST be different from ALL of these):
${tourData.existingTitles?.length > 0 ? tourData.existingTitles.map(t => '- ' + t).join('\n') : '- None yet'}

H2_TITLE: [Slightly different from H1 — can be more descriptive, mention specific sites like Sistine Chapel or St. Peter's]

SEO_DESCRIPTION: [150-160 chars — include price, duration, key feature, "Vatican" — factual hook for search results]

KEYWORDS: [5-7 keywords comma-separated based on actual tour content]
`;
};

export { getQuickAnswerIntro, getCityDisplayName };
