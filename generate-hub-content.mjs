#!/usr/bin/env node
/**
 * generate-hub-content.mjs v3
 * 
 * Cambios vs v2:
 * - NO genera seoTitle (usa hub.title de tourHubs.json)
 * - Meta descriptions de alta calidad con pain points, few-shot, sin exageraciones
 * - Contenido editorial rico y variado
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

// --- Pain points y contexto por tipo de hub ---
const HUB_CONTEXT = {
  "underground": {
    painPoint: "Underground slots sell out 4-8 weeks ahead, only a limited number of daily permits available",
    uniqueValue: "Gladiator tunnels, animal cages, hypogeum, trapdoors � areas closed to regular tickets",
    buyerIntent: "Exclusive access seeker, willing to pay premium for hidden areas"
  },
  "night": {
    painPoint: "Very limited night slots, atmospheric but sells out fast",
    uniqueValue: "Evening lighting, far fewer crowds, underground + arena after dark",
    buyerIntent: "Experience seeker wanting unique/romantic Rome moment"
  },
  "arena": {
    painPoint: "Arena floor is restricted � only accessible with specific guided tours",
    uniqueValue: "Stand where gladiators fought, see reconstructed floor, first-tier views",
    buyerIntent: "History enthusiast wanting the most immersive gladiator experience"
  },
  "private": {
    painPoint: "Many tours say private but are actually small groups of 8-15",
    uniqueValue: "True 1-on-1 or family-only experiences with flexible schedules",
    buyerIntent: "Premium traveler wanting personalized attention and schedule control"
  },
  "skip-the-line": {
    painPoint: "Regular queues are 1-3 hours in peak season",
    uniqueValue: "Priority entrance, separate security line, more time inside",
    buyerIntent: "Time-conscious visitor wanting to maximize Rome trip efficiency"
  },
  "small-group": {
    painPoint: "Large groups of 30+ mean you can barely hear the guide",
    uniqueValue: "Max 6-15 people, real interaction with guide, better photo spots",
    buyerIntent: "Quality-focused traveler wanting intimate experience without private tour price"
  },
  "guided": {
    painPoint: "Self-guided visits often miss key historical context � ruins look like rocks without a guide",
    uniqueValue: "Licensed archaeologists, historians, local experts bring ruins to life",
    buyerIntent: "Knowledge seeker wanting to understand what they are seeing"
  },
  "destination": {
    painPoint: "Roman Forum looks like a field of rubble without a guide to explain it",
    uniqueValue: "Guided walkthrough of Senate, temples, Via Sacra with Colosseum combos",
    buyerIntent: "Visitor wanting comprehensive ancient Rome experience beyond just Colosseum"
  },

  "full-experience": {
    painPoint: "Standard tickets only cover the main levels � you miss underground, arena floor and upper tiers",
    uniqueValue: "All restricted areas in one tour: underground + arena + upper tiers + Roman Forum",
    buyerIntent: "Visitor wanting the most complete Colosseum experience in a single booking"
  },
"family": {
  painPoint: "Standard Colosseum tours involve 2+ hours of walking on uneven Roman stones, steep underground stairs, and no shade — kids lose interest in 20 minutes",
  uniqueValue: "Family-paced tours with engaging guides who turn gladiator history into stories kids love, no underground stairs, and manageable 1.5-hour duration",
  buyerIntent: "Parent wanting a Colosseum visit that keeps children genuinely engaged without physical challenges"
},
"budget": {
  painPoint: "Colosseum tour prices range from €18 to €300+ — it's hard to know which budget options still deliver a quality experience with skip-the-line access",
  uniqueValue: "Curated selection of tours under $50 that include skip-the-line entry, guided commentary, and Forum/Palatine access",
  buyerIntent: "Budget-conscious visitor wanting a quality Colosseum experience without overspending"
},
"self-guided": {
  painPoint: "Walking through the Colosseum without context means passing ancient ruins without understanding what you're looking at — every stone has a story",
  uniqueValue: "Audio guide apps and multimedia tours let you explore at your own pace with commentary on gladiator history, architecture, and daily Roman life",
  buyerIntent: "Independent traveler wanting flexibility to linger where they want without a group schedule"
},

};

// --- Few-shot examples de meta descriptions de alta calidad ---
const META_DESC_EXAMPLES = [
  {
    type: "underground",
    tours: 22, priceFrom: "$67",
    result: "22 underground tours from $67. Gladiator tunnels, animal cages & hypogeum � limited daily permits available. Book 4-8 weeks ahead before slots sell out."
  },
  {
    type: "private",
    tours: 11, priceFrom: "$350",
    result: "11 private Colosseum tours from $350. True VIP or small group? We break down what \"private\" really means. Underground access, flexible schedules."
  },
  {
    type: "skip-the-line",
    tours: 27, priceFrom: "$30",
    result: "27 skip-the-line Colosseum tours from $30. Avoid 1-3 hour queues with priority access. Underground combos, Roman Forum add-ons & free cancellation."
  },
  {
    type: "arena",
    tours: 26, priceFrom: "$34",
    result: "26 arena floor tours from $34. Stand where gladiators fought � access restricted to guided tours only. Ratings, prices & real visitor reviews for 2026."
  }
];

// --- System prompt para contenido editorial ---
const SYSTEM_PROMPT = `You are a Rome travel expert writing for lasvegastour.com, an independent guide to Colosseum tours.

VOICE: Knowledgeable insider who has personally tested tours. Authoritative yet accessible. No fluff. No absolute claims like "essential", "guarantee", "zero", "100%", or unverifiable percentages � use "typically", "usually", "in most cases", "far fewer".

You will receive a hub type and real tour data. Generate content with this EXACT structure:

OUTPUT JSON:
{
  "quickAnswer": {
    "hook": "1 sentence: benefit + pain point (e.g. crowds, time wasted). Max 20 words.",
    "range": "1 sentence: total tours available + price range + sweet spot recommendation.",
    "bestPick": {
      "name": "Name of top recommended tour",
      "rating": 4.7,
      "price": 106,
      "duration": "1.5 hours",
      "highlight": "One key selling point in 5-8 words"
    },
    "verdict": "1 sentence final recommendation. Max 15 words."
  },
  "methodology": "1 sentence explaining review criteria. Example: We compared X tours based on price, review volume, group size, included access, and cancellation policy.",
  "intro": {
    "whyItMatters": "2-3 sentences: why this tour type matters (crowds, stress, experience quality)",
    "whatOptions": "2-3 sentences: how many tours exist, what the range covers",
    "sweetSpot": "2-3 sentences: where the best value is, with specific price tier",
    "howToChoose": "2-3 sentences: quick decision criteria (cancellation, group size, booking timing)"
  },
  "pricingTiers": [
    {"range": "$30-$45", "label": "Entry-level / audio guide"},
    {"range": "$45-$85", "label": "Best value guided tours"}
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
    {"text": "Descriptive anchor text", "slug": "best-colosseum-underground-tours"}
  ],
  "faqs": [
    {"question": "Real question a visitor would ask Google", "answer": "Specific 2-3 sentence answer with real data."}
  ]
}

IMPORTANT:
- Do NOT generate "seoTitle" � it is managed separately.
- Do NOT generate "seoDescription" � it is generated by a specialized prompt.
- PRICING TIERS: Create 3-5 tiers based on REAL prices from the tour data. Dont invent prices.
- DECISION BOX: Make 4 bullets specific to THIS tour type (not generic).
- INTERNAL LINKS: Suggest 2-3 links to OTHER hub types. Do NOT link to self.
- FAQs: 7 questions people actually search on Google. Topics: what's included, worth the price, best time, comparison with other types, accessibility, cancellation, age suitability.
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
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0].text.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(text);
}

// --- Generar meta description de alta calidad ---
async function generateMetaDescription(hub, content, tours) {
  const ctx = HUB_CONTEXT[hub.type] || HUB_CONTEXT["destination"];
  const tourCount = tours.length;
  const prices = tours.filter(t => t.tourInfo?.price).map(t => t.tourInfo.price);
  const lowestPrice = prices.length ? `$${Math.min(...prices)}` : "";
  const bestPick = content.quickAnswer?.bestPick;

  const examples = META_DESC_EXAMPLES.map(ex =>
    `Type: ${ex.type} | Tours: ${ex.tours} | From: ${ex.priceFrom}\nResult: ${ex.result}`
  ).join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `You write meta descriptions for Colosseum tour comparison pages. Your descriptions are specific, punchy, and speak to the real pain point of the searcher.

RULES:
- Max 155 characters
- Start with the number of tours or a specific data point � NEVER start with "Compare" or "Best"
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
  } catch { /* file doesnt exist yet */ }

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

      // Ensamblar: t�tulo de tourHubs.json, meta desc especializada, contenido editorial
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
