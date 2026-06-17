#!/usr/bin/env node
/**
 * generate-hub-content.mjs v3 (Las Vegas)
 *
 * Cambios vs v2:
 * - NO genera seoTitle (usa hub.title de tourHubs.json)
 * - Meta descriptions de alta calidad con pain points, few-shot, sin exageraciones
 * - Contenido editorial rico y variado
 *
 * Adaptacion Las Vegas:
 * - HUB_CONTEXT, META_DESC_EXAMPLES y SYSTEM_PROMPT reescritos para day trips
 *   (Grand Canyon, Hoover Dam, Antelope, parques, helicopteros, Strip).
 * - HUB_CONTEXT se busca primero por slug y cae a type, para diferenciar los
 *   destinos que comparten type "destination" (West Rim / South Rim / Antelope).
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@sanity/client";
import { readFileSync, writeFileSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

const hubData = JSON.parse(readFileSync("./data/tourHubs.json", "utf-8"));
const hubs = hubData.hubs;

const args = process.argv.slice(2);
const SINGLE_HUB = args.find(a => a.startsWith("--hub="))?.split("=")[1];

// --- Pain points y contexto por tipo de hub (Las Vegas) ---
// Las claves por TYPE cubren los hubs transversales. Las claves por SLUG (al final)
// dan contexto especifico a los destinos que comparten type "destination".
const HUB_CONTEXT = {
  "private": {
    painPoint: "Many Vegas tours advertised as private are actually shared shuttles with 10-14 strangers, and pickup windows can run 60-90 minutes across multiple hotels",
    uniqueValue: "True private vehicles with your own guide, flexible departure times, and the freedom to linger at viewpoints or skip stops",
    buyerIntent: "Premium traveler wanting a personalized day trip with schedule control and no shared-van waiting"
  },
  "small-group": {
    painPoint: "Big coach tours pack 40-50 people, so you wait at every stop and barely hear the guide over the engine",
    uniqueValue: "Capped at a handful of guests in an SUV or small van, with real interaction and faster stops",
    buyerIntent: "Quality-focused traveler wanting an intimate trip without paying full private-tour prices"
  },
  "food-drink": {
    painPoint: "The Strip is full of overpriced tourist-trap restaurants, and it is hard to know which tastings and tours are actually worth booking",
    uniqueValue: "Curated food walks, wine and cocktail tastings, and brewery visits led by locals who know where the value is",
    buyerIntent: "Foodie or group wanting a guided culinary experience beyond the casino buffets"
  },
  "budget": {
    painPoint: "Las Vegas day trips swing from under $50 to over $400, and it is hard to tell which cheaper options still include transport, entry fees and a real guide",
    uniqueValue: "Curated lower-priced tours that still cover hotel pickup, park fees and guided commentary, usually with free cancellation",
    buyerIntent: "Budget-conscious visitor wanting a genuine experience without overspending"
  },
  "sunset": {
    painPoint: "Midday desert light is flat and harsh for photos, and the most atmospheric departure times sell out first",
    uniqueValue: "Golden-hour timing over the canyon, the Strip or Hoover Dam, when the light is best and the heat drops",
    buyerIntent: "Photographer or couple wanting the most scenic, atmospheric version of the trip"
  },
  "combo": {
    painPoint: "Booking the Grand Canyon, Hoover Dam and other sights as separate trips means repeated hotel pickups and wasted hours on the road",
    uniqueValue: "Two or more marquee destinations bundled into a single day with one pickup, often cheaper than booking them apart",
    buyerIntent: "Time-pressed visitor wanting to see more of the region in fewer days"
  },
  "helicopter": {
    painPoint: "A Grand Canyon helicopter trip can mean an air-only flyover or a full canyon-floor landing with champagne, and the listings rarely make the difference clear",
    uniqueValue: "Flights that descend below the rim and land on the canyon floor, some with a Colorado River boat ride or a champagne picnic",
    buyerIntent: "Bucket-list traveler wanting the most dramatic way to experience the Grand Canyon"
  },
  "multi-day": {
    painPoint: "The best of the Southwest (Zion, Bryce, Antelope, Monument Valley) is too far for a single day from Vegas, and self-driving means booking lodging and permits yourself",
    uniqueValue: "Overnight and road-trip tours that chain multiple national parks with lodging, permits and transport handled",
    buyerIntent: "Traveler wanting to cover several Southwest parks without planning the logistics"
  },
  "nature": {
    painPoint: "Vegas day-trip listings bury the natural parks (Valley of Fire, Red Rock, Death Valley) among generic city tours, so they are hard to compare",
    uniqueValue: "Guided trips to Nevada and California state and national parks, with transport, fees and short hikes included",
    buyerIntent: "Outdoors-minded visitor wanting red rocks, desert landscapes and hikes within reach of the Strip"
  },
  "destination": {
    painPoint: "Day trips to the same destination vary widely in driving time, stops and what is actually included, and the listings rarely make it clear",
    uniqueValue: "Guided trips to a specific marquee destination with transport, entry fees and the key viewpoints covered",
    buyerIntent: "Visitor wanting a focused day trip to one bucket-list destination from Las Vegas"
  },

  // --- Overrides por SLUG para destinos que comparten type "destination" ---
  "grand-canyon-west-rim-tours": {
    painPoint: "The West Rim is neither the national park nor the famous South Rim viewpoints, yet many listings blur the two, and the glass Skywalk usually costs extra on top of the tour",
    uniqueValue: "Closest rim to Vegas (about 2-2.5 hours each way), on Hualapai land with Eagle Point, Guano Point and the optional Skywalk",
    buyerIntent: "Time-limited visitor wanting the quickest Grand Canyon day trip from the Strip, with the Skywalk as an option"
  },
  "grand-canyon-south-rim-tours": {
    painPoint: "The South Rim is the postcard Grand Canyon but sits about 4.5 hours from Vegas, so day trips run long and some fly part of the way",
    uniqueValue: "The classic national-park viewpoints (Mather Point, Grand Canyon Village) with deeper canyon views than the West Rim",
    buyerIntent: "Visitor who wants the iconic Grand Canyon views and will trade a longer day to get them"
  },
  "antelope-canyon-horseshoe-bend-tours": {
    painPoint: "Antelope Canyon sits on Navajo land near Page, Arizona, requires a Navajo guide, and Lower vs Upper canyon access differs a lot between tours",
    uniqueValue: "The glowing slot-canyon walls plus the Horseshoe Bend overlook, usually paired in one long day or an overnight from Vegas",
    buyerIntent: "Photographer or bucket-list traveler wanting the slot canyon and Horseshoe Bend in one trip"
  },
};

// --- Few-shot examples de meta descriptions de alta calidad (Las Vegas) ---
const META_DESC_EXAMPLES = [
  {
    type: "west-rim",
    tours: 20, priceFrom: "$99",
    result: "20 Grand Canyon West Rim tours from $99. Closest rim to Vegas, about 2.5 hrs each way. Skywalk optional, Eagle & Guano Point. Free cancellation on most."
  },
  {
    type: "helicopter",
    tours: 10, priceFrom: "$399",
    result: "10 Grand Canyon helicopter tours from $399. Air-only flyover or land on the canyon floor with champagne? We break down the difference before you book."
  },
  {
    type: "budget",
    tours: 50, priceFrom: "$39",
    result: "50 Las Vegas tours under $50. Hoover Dam, Red Rock & Valley of Fire with hotel pickup and a guide — which cheap trips still deliver, compared."
  },
  {
    type: "nature",
    tours: 79, priceFrom: "$45",
    result: "79 nature & parks tours from Vegas, from $45. Valley of Fire, Red Rock & Death Valley — driving time, stops & what's included, compared for 2026."
  }
];

// --- System prompt para contenido editorial ---
const SYSTEM_PROMPT = `You are a Las Vegas travel expert writing for lasvegastour.com, an independent guide to Las Vegas tours and day trips — Grand Canyon, Hoover Dam, Antelope Canyon, Red Rock, Valley of Fire, Death Valley, helicopter flights and the Strip.

VOICE: Knowledgeable insider who has personally tested tours. Authoritative yet accessible. No fluff. No absolute claims like "essential", "guarantee", "zero", "100%", or unverifiable percentages — use "typically", "usually", "in most cases", "far fewer".

You will receive a hub type and real tour data. Generate content with this EXACT structure:

OUTPUT JSON:
{
  "quickAnswer": {
    "hook": "1 sentence: benefit + pain point (e.g. long drives, harsh midday heat, shared-van waiting). Max 20 words.",
    "range": "1 sentence: total tours available + price range + sweet spot recommendation.",
    "bestPick": {
      "name": "Name of top recommended tour",
      "rating": 4.7,
      "price": 149,
      "duration": "10 hours",
      "highlight": "One key selling point in 5-8 words"
    },
    "verdict": "1 sentence final recommendation. Max 15 words."
  },
  "methodology": "1 sentence explaining review criteria. Example: We compared X tours based on price, review volume, group size, included access, driving time, and cancellation policy.",
  "intro": {
    "whyItMatters": "2-3 sentences: why this tour type matters (driving time, heat, crowds, experience quality)",
    "whatOptions": "2-3 sentences: how many tours exist, what the range covers",
    "sweetSpot": "2-3 sentences: where the best value is, with specific price tier",
    "howToChoose": "2-3 sentences: quick decision criteria (cancellation, group size, transport, booking timing)"
  },
  "pricingTiers": [
    {"range": "$40-$90", "label": "Entry-level / shared shuttle day trips"},
    {"range": "$90-$200", "label": "Best value guided tours"}
  ],
  "decisionBox": {
    "title": "Who should book [this tour type]?",
    "bullets": [
      "Specific bullet for THIS tour type",
      "Another specific bullet",
      "Third specific bullet",
      "Fourth specific bullet"
    ]
  },
  "internalLinks": [
    {"text": "Descriptive anchor text", "slug": "grand-canyon-west-rim-tours"}
  ],
  "faqs": [
    {"question": "Real question a visitor would ask Google", "answer": "Specific 2-3 sentence answer with real data."}
  ]
}

IMPORTANT:
- Do NOT generate "seoTitle" — it is managed separately.
- Do NOT generate "seoDescription" — it is generated by a specialized prompt.
- PRICING TIERS: Create 3-5 tiers based on REAL prices from the tour data. Don't invent prices.
- DECISION BOX: Make 4 bullets specific to THIS tour type (not generic).
- INTERNAL LINKS: Suggest 2-3 links to OTHER hub types. Do NOT link to self.
- FAQs: 7 questions people actually search on Google. Topics: what's included, worth the price, best time, driving time, comparison with other types, accessibility, cancellation, age suitability.
- NEVER use unverifiable stats like "90% of visitors" or "only 2% get access".

Return JSON only. No markdown fences.`;

// --- Fetch tours desde Sanity ---
async function fetchToursForHub(hub) {
  const keywordConditions = hub.matchKeywords
    .map((kw) => `title match "*${kw}*"`)
    .join(" || ");

  const featureConditions = Object.entries(hub.matchFeatures || {})
    .map(([key, val]) => `tourFeatures.${key} == ${val}`)
    .join(" || ");

  const priceCondition = hub.matchPrice?.max
    ? `tourInfo.price <= ${hub.matchPrice.max}`
    : null;

  let filter = `_type == "post" && !(_id in path("drafts.**"))`;

  const conditions = [keywordConditions, featureConditions, priceCondition].filter(Boolean);

  if (conditions.length > 0) {
    filter += ` && (${conditions.join(" || ")})`;
  }

  const query = `*[${filter}] | order(editorialRating desc) {
    title,
    slug,
    seoDescription,
    tourInfo { duration, price, currency },
    tourFeatures { skipTheLine, smallGroupAvailable, freeCancellation },
    getYourGuideData { rating, reviewCount, provider },
    editorialRating,
    bookingUrl
  }`;

  return await sanityClient.fetch(query);
}

// --- Generar contenido editorial ---
async function generateHubContent(hub, tours) {
  const tourSummary = tours.map((t, i) => {
    const parts = [`${i + 1}. "${t.title}"`];
    if (t.tourInfo?.price) parts.push(`$${t.tourInfo.price}`);
    if (t.tourInfo?.duration) parts.push(t.tourInfo.duration);
    if (t.getYourGuideData?.rating) parts.push(`${t.getYourGuideData.rating}/5 (${t.getYourGuideData.reviewCount} reviews)`);
    if (t.getYourGuideData?.provider) parts.push(`by ${t.getYourGuideData.provider}`);
    if (t.tourFeatures?.skipTheLine) parts.push("skip-the-line");
    if (t.tourFeatures?.smallGroupAvailable) parts.push("small group");
    if (t.tourFeatures?.freeCancellation) parts.push("free cancellation");
    return parts.join(" | ");
  }).join("\n");

  const prices = tours.filter(t => t.tourInfo?.price).map(t => t.tourInfo.price);
  const minPrice = prices.length ? Math.min(...prices) : "N/A";
  const maxPrice = prices.length ? Math.max(...prices) : "N/A";

  const userMessage = `Generate content for hub: "${hub.title}"
Type: ${hub.type}
Total tours found: ${tours.length}
Price range: $${minPrice} - $${maxPrice}

REAL TOUR DATA:
${tourSummary}

Remember: Do NOT include seoTitle or seoDescription in your response.
Return JSON only.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  let text = response.content[0].text.replace(/```json\n?|```\n?/g, "").trim();
  // El modelo a veces antepone un preambulo (ej. "I notice the tour data...").
  // Recortar al primer "{" y ultimo "}" para quedarnos solo con el objeto JSON.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace > 0 || (lastBrace !== -1 && lastBrace < text.length - 1)) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(text);
}

// --- Generar meta description de alta calidad ---
async function generateMetaDescription(hub, content, tours) {
  const ctx = HUB_CONTEXT[hub.slug] || HUB_CONTEXT[hub.type] || HUB_CONTEXT["destination"];
  const tourCount = tours.length;
  const prices = tours.filter(t => t.tourInfo?.price).map(t => t.tourInfo.price);
  const lowestPrice = prices.length ? `$${Math.min(...prices)}` : "";
  const bestPick = content.quickAnswer?.bestPick;

  const examples = META_DESC_EXAMPLES.map(ex =>
    `Type: ${ex.type} | Tours: ${ex.tours} | From: ${ex.priceFrom}\nResult: ${ex.result}`
  ).join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `You write meta descriptions for Las Vegas tour and day-trip comparison pages. Your descriptions are specific, punchy, and speak to the real pain point of the searcher.

RULES:
- Max 155 characters
- Start with the number of tours or a specific data point — NEVER start with "Compare" or "Best"
- Include lowest price
- Reference the specific pain point or unique value of this tour type
- Use dashes, ampersands, short punchy sentences
- No generic filler like "save time choosing" or "find your perfect experience"
- NEVER use unverifiable stats like "90%", "only 2%", or absolutes like "zero crowds"
- Every word must earn its place

EXAMPLES OF GREAT META DESCRIPTIONS:
${examples}

NOW GENERATE FOR:
Type: ${hub.type}
Title: ${hub.title}
Tour count: ${tourCount}
Lowest price: ${lowestPrice}
Best pick: ${bestPick?.name || "N/A"} (${bestPick?.rating || "N/A"}/5, ${bestPick?.price ? "$" + bestPick.price : "N/A"})
Pain point: ${ctx.painPoint}
Unique value: ${ctx.uniqueValue}
Buyer intent: ${ctx.buyerIntent}

Return ONLY the meta description text. No quotes, no explanation.`
    }]
  });

  return response.content[0].text.trim();
}

// --- Main ---
async function main() {
  const hubsToProcess = SINGLE_HUB
    ? hubs.filter(h => h.slug === SINGLE_HUB)
    : hubs;

  if (hubsToProcess.length === 0) {
    console.error(`Hub not found: ${SINGLE_HUB}`);
    process.exit(1);
  }

  let existingContent = {};
  try {
    existingContent = JSON.parse(readFileSync("./data/hub-content.json", "utf-8"));
  } catch { /* file doesn't exist yet */ }

  console.log(`\nGenerating content v3 for ${hubsToProcess.length} hubs...\n`);

  for (let i = 0; i < hubsToProcess.length; i++) {
    const hub = hubsToProcess[i];
    console.log(`[${i + 1}/${hubsToProcess.length}] ${hub.icon} ${hub.title}`);

    try {
      const tours = await fetchToursForHub(hub);
      console.log(`  > Found ${tours.length} matching tours`);

      if (tours.length === 0) {
        console.log(`  ! No tours found, skipping`);
        continue;
      }

      // Generar contenido editorial
      const content = await generateHubContent(hub, tours);
      console.log(`  > Content generated`);
      console.log(`  > FAQs: ${content.faqs?.length || 0}`);
      console.log(`  > Tiers: ${content.pricingTiers?.length || 0}`);

      // Generar meta description de alta calidad
      await new Promise(r => setTimeout(r, 1500));
      const metaDesc = await generateMetaDescription(hub, content, tours);
      console.log(`  > Meta: ${metaDesc} (${metaDesc.length} chars)`);

      // Ensamblar: titulo de tourHubs.json, meta desc especializada, contenido editorial
      existingContent[hub.slug] = {
        ...content,
        seoTitle: hub.title,
        seoDescription: metaDesc
      };

      if (i < hubsToProcess.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.log(`  X Failed: ${e.message}`);
    }
  }

  writeFileSync("./data/hub-content.json", JSON.stringify(existingContent, null, 2));
  console.log(`\n> Saved to data/hub-content.json`);
  console.log("Done!");
}

main();
