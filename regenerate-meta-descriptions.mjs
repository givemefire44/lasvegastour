#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const hubData = JSON.parse(readFileSync("./data/tourHubs.json", "utf-8"));
const hubContent = JSON.parse(readFileSync("./data/hub-content.json", "utf-8"));

const HUB_CONTEXT = {
  "underground": {
    painPoint: "Underground slots sell out 4-8 weeks ahead, only 2% of visitors get access",
    uniqueValue: "Gladiator tunnels, animal cages, hypogeum, trapdoors — areas closed to regular tickets",
    buyerIntent: "Exclusive access seeker, willing to pay premium for hidden areas"
  },
  "night": {
    painPoint: "Very limited night slots, atmospheric but sells out fast",
    uniqueValue: "Evening lighting, zero daytime crowds, underground + arena after dark",
    buyerIntent: "Experience seeker wanting unique/romantic Rome moment"
  },
  "arena": {
    painPoint: "Arena floor is restricted — only accessible with specific guided tours",
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
    painPoint: "Self-guided visits miss 90% of the history — ruins look like rocks without context",
    uniqueValue: "Licensed archaeologists, historians, local experts bring ruins to life",
    buyerIntent: "Knowledge seeker wanting to understand what they are seeing"
  },
  "destination": {
    painPoint: "Roman Forum looks like a field of rubble without a guide to explain it",
    uniqueValue: "Guided walkthrough of Senate, temples, Via Sacra with Colosseum combos",
    buyerIntent: "Visitor wanting comprehensive ancient Rome experience beyond just Colosseum"
  }
};

const FEW_SHOT_EXAMPLES = [
  {
    type: "underground",
    title: "Colosseum Underground Tours 2026 — Tickets, Prices & Reviews",
    tours: 22, priceFrom: "$67",
    result: "22 underground tours tested. Gladiator tunnels, animal cages & hypogeum access from $67. Avoid sold-out dates — slots fill 4-8 weeks ahead."
  },
  {
    type: "private",
    title: "Private Colosseum Tours 2026 — Compare VIP Options",
    tours: 11, priceFrom: "$350",
    result: "11 private Colosseum tours from $350. True VIP or small group? We break down what \"private\" really means. Underground access, flexible schedules."
  },
  {
    type: "skip-the-line",
    title: "Skip the Line Colosseum Tours 2026 — How to Avoid the Queues",
    tours: 27, priceFrom: "$30",
    result: "27 skip-the-line Colosseum tours from $30. Avoid 1-3 hour queues with priority access. Underground combos, Roman Forum add-ons & free cancellation."
  },
  {
    type: "arena",
    title: "Colosseum Arena Floor Tours 2026 — Access, Prices & Tips",
    tours: 26, priceFrom: "$34",
    result: "26 arena floor tours from $34. Stand where gladiators fought — access restricted to guided tours only. Ratings, prices & real visitor reviews for 2026."
  }
];

async function generateDescription(hub, content) {
  const ctx = HUB_CONTEXT[hub.type] || HUB_CONTEXT["destination"];
  const tourCount = content.quickAnswer?.range?.match(/(\d+)\s*tours/)?.[1] || "?";
  const lowestPrice = content.pricingTiers?.[0]?.range?.match(/\$[\d]+/)?.[0] || "";
  const bestPick = content.quickAnswer?.bestPick;
  const faqTopics = content.faqs?.slice(0, 3).map(f => f.question).join("; ") || "";

  const examples = FEW_SHOT_EXAMPLES.map(ex =>
    `Type: ${ex.type} | Title: ${ex.title} | Tours: ${ex.tours} | From: ${ex.priceFrom}\nResult: ${ex.result}`
  ).join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `You write meta descriptions for Colosseum tour comparison pages. Your descriptions are specific, punchy, and speak to the real pain point of the searcher.

RULES:
- Max 155 characters
- Start with the number of tours or a specific data point — NEVER start with "Compare" or "Best"
- Include lowest price
- Reference the specific pain point or unique value of this tour type
- Use dashes, ampersands, short punchy sentences
- No generic filler like "save time choosing" or "find your perfect experience"
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
Top FAQ topics: ${faqTopics}

Return ONLY the meta description text. No quotes, no explanation.`
    }]
  });

  return response.content[0].text.trim();
}

async function main() {
  const targetSlug = process.argv[2]?.replace("--hub=", "");
  console.log("\nRegenerating meta descriptions...\n");

  for (const hub of hubData.hubs) {
    if (targetSlug && hub.slug !== targetSlug) continue;
    const content = hubContent[hub.slug];
    if (!content) { console.log(`  ! No content for ${hub.slug}, skipping`); continue; }
    try {
      console.log(`${hub.icon} ${hub.shortTitle}`);
      console.log(`  Old: ${content.seoDescription}`);
      const newDesc = await generateDescription(hub, content);
      content.seoDescription = newDesc;
      console.log(`  New: ${newDesc}`);
      console.log(`  Chars: ${newDesc.length}\n`);
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) { console.log(`  X Failed: ${e.message}`); }
  }

  writeFileSync("./data/hub-content.json", JSON.stringify(hubContent, null, 2));
  console.log("> Saved to data/hub-content.json\nDone!");
}
main();
