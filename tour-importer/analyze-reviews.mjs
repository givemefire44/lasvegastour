#!/usr/bin/env node
/**
 * analyze-reviews.mjs
 * 
 * Analiza el dataset de reviews scrapeado y genera estadísticas
 * para artículos citables.
 * 
 * Uso: node analyze-reviews.mjs
 */

import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./reviews-colosseum.json', 'utf-8'));
const allReviews = [];

data.tours.forEach(tour => {
  tour.reviews.forEach(r => {
    allReviews.push({
      ...r,
      tourType: tour.tourType,
      format: tour.format,
      groupSize: tour.groupSize,
      price: tour.price,
      tourTitle: tour.title,
      slug: tour.slug
    });
  });
});

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  📊 REVIEW ANALYSIS — Colosseum Tours Dataset                 ║');
console.log(`║  ${allReviews.length} reviews across ${data.tours.length} tours                            ║`);
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// ========================================
// 1. RATING BY TOUR TYPE
// ========================================
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  1. ⭐ AVERAGE RATING BY TOUR TYPE                            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const byType = {};
allReviews.forEach(r => {
  if (!byType[r.tourType]) byType[r.tourType] = { ratings: [], reviews: [] };
  byType[r.tourType].ratings.push(r.rating);
  byType[r.tourType].reviews.push(r);
});

Object.entries(byType)
  .sort((a, b) => (b[1].ratings.reduce((x,y)=>x+y,0)/b[1].ratings.length) - (a[1].ratings.reduce((x,y)=>x+y,0)/a[1].ratings.length))
  .forEach(([type, data]) => {
    const avg = (data.ratings.reduce((a,b)=>a+b,0) / data.ratings.length).toFixed(2);
    const count5 = data.ratings.filter(r => r === 5).length;
    const count1 = data.ratings.filter(r => r <= 2).length;
    const pct5 = (count5 / data.ratings.length * 100).toFixed(1);
    const pct1 = (count1 / data.ratings.length * 100).toFixed(1);
    console.log(`   ${type.padEnd(20)} ⭐ ${avg}/5  |  ${data.ratings.length} reviews  |  5★: ${pct5}%  |  1-2★: ${pct1}%`);
  });

// ========================================
// 2. RATING BY FORMAT (guided vs audio vs private)
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  2. ⭐ AVERAGE RATING BY FORMAT                               ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const byFormat = {};
allReviews.forEach(r => {
  if (!byFormat[r.format]) byFormat[r.format] = { ratings: [], reviews: [] };
  byFormat[r.format].ratings.push(r.rating);
  byFormat[r.format].reviews.push(r);
});

Object.entries(byFormat)
  .sort((a, b) => (b[1].ratings.reduce((x,y)=>x+y,0)/b[1].ratings.length) - (a[1].ratings.reduce((x,y)=>x+y,0)/a[1].ratings.length))
  .forEach(([fmt, data]) => {
    const avg = (data.ratings.reduce((a,b)=>a+b,0) / data.ratings.length).toFixed(2);
    const count5 = data.ratings.filter(r => r === 5).length;
    const count1 = data.ratings.filter(r => r <= 2).length;
    const pct5 = (count5 / data.ratings.length * 100).toFixed(1);
    const pct1 = (count1 / data.ratings.length * 100).toFixed(1);
    console.log(`   ${fmt.padEnd(20)} ⭐ ${avg}/5  |  ${data.ratings.length} reviews  |  5★: ${pct5}%  |  1-2★: ${pct1}%`);
  });

// ========================================
// 3. UNDERGROUND VS ARENA — HEAD TO HEAD
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  3. ⚔️ UNDERGROUND vs ARENA — HEAD TO HEAD                    ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const underground = allReviews.filter(r => r.tourType === 'underground');
const arena = allReviews.filter(r => r.tourType === 'arena');

if (underground.length && arena.length) {
  const ugAvg = (underground.reduce((a,r)=>a+r.rating,0) / underground.length).toFixed(2);
  const arAvg = (arena.reduce((a,r)=>a+r.rating,0) / arena.length).toFixed(2);
  const ugPrice = (underground.reduce((a,r)=>a+r.price,0) / underground.length).toFixed(0);
  const arPrice = (arena.reduce((a,r)=>a+r.price,0) / arena.length).toFixed(0);
  const ug5 = (underground.filter(r=>r.rating===5).length / underground.length * 100).toFixed(1);
  const ar5 = (arena.filter(r=>r.rating===5).length / arena.length * 100).toFixed(1);
  const ug12 = (underground.filter(r=>r.rating<=2).length / underground.length * 100).toFixed(1);
  const ar12 = (arena.filter(r=>r.rating<=2).length / arena.length * 100).toFixed(1);
  
  console.log(`   ${''.padEnd(25)} UNDERGROUND          ARENA`);
  console.log(`   ${'Reviews'.padEnd(25)} ${underground.length.toString().padEnd(20)} ${arena.length}`);
  console.log(`   ${'Avg Rating'.padEnd(25)} ${(ugAvg + '/5').padEnd(20)} ${arAvg}/5`);
  console.log(`   ${'5-star %'.padEnd(25)} ${(ug5 + '%').padEnd(20)} ${ar5}%`);
  console.log(`   ${'1-2 star %'.padEnd(25)} ${(ug12 + '%').padEnd(20)} ${ar12}%`);
  console.log(`   ${'Avg Price'.padEnd(25)} ${'$' + ugPrice.padEnd(19)} $${arPrice}`);
}

// ========================================
// 4. RATING BY COUNTRY (top 10)
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  4. 🌍 AVERAGE RATING BY COUNTRY                              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const byCountry = {};
allReviews.forEach(r => {
  const c = r.country || 'Unknown';
  if (!byCountry[c]) byCountry[c] = [];
  byCountry[c].push(r.rating);
});

Object.entries(byCountry)
  .filter(([_, ratings]) => ratings.length >= 10)
  .sort((a, b) => (b[1].reduce((x,y)=>x+y,0)/b[1].length) - (a[1].reduce((x,y)=>x+y,0)/a[1].length))
  .forEach(([country, ratings]) => {
    const avg = (ratings.reduce((a,b)=>a+b,0) / ratings.length).toFixed(2);
    const pct5 = (ratings.filter(r=>r===5).length / ratings.length * 100).toFixed(1);
    console.log(`   ${country.padEnd(25)} ⭐ ${avg}/5  |  ${ratings.length} reviews  |  5★: ${pct5}%`);
  });

// ========================================
// 5. AMERICANS vs BRITISH
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  5. 🇺🇸 vs 🇬🇧 AMERICANS vs BRITISH                            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const americans = allReviews.filter(r => r.country === 'United States');
const british = allReviews.filter(r => r.country === 'United Kingdom');

if (americans.length && british.length) {
  const usAvg = (americans.reduce((a,r)=>a+r.rating,0) / americans.length).toFixed(2);
  const ukAvg = (british.reduce((a,r)=>a+r.rating,0) / british.length).toFixed(2);
  const us5 = (americans.filter(r=>r.rating===5).length / americans.length * 100).toFixed(1);
  const uk5 = (british.filter(r=>r.rating===5).length / british.length * 100).toFixed(1);
  const us12 = (americans.filter(r=>r.rating<=2).length / americans.length * 100).toFixed(1);
  const uk12 = (british.filter(r=>r.rating<=2).length / british.length * 100).toFixed(1);
  
  console.log(`   ${''.padEnd(25)} 🇺🇸 USA               🇬🇧 UK`);
  console.log(`   ${'Reviews'.padEnd(25)} ${americans.length.toString().padEnd(20)} ${british.length}`);
  console.log(`   ${'Avg Rating'.padEnd(25)} ${(usAvg + '/5').padEnd(20)} ${ukAvg}/5`);
  console.log(`   ${'5-star %'.padEnd(25)} ${(us5 + '%').padEnd(20)} ${uk5}%`);
  console.log(`   ${'1-2 star %'.padEnd(25)} ${(us12 + '%').padEnd(20)} ${uk12}%`);
}

// ========================================
// 6. KEYWORD ANALYSIS — POSITIVE REVIEWS (5 stars)
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  6. 💬 MOST COMMON WORDS IN 5-STAR REVIEWS                    ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const positiveKeywords = [
  'amazing', 'fantastic', 'incredible', 'excellent', 'wonderful', 'brilliant',
  'knowledgeable', 'informative', 'passionate', 'enthusiastic', 'friendly',
  'recommend', 'worth', 'best', 'loved', 'perfect', 'unforgettable',
  'guide', 'history', 'underground', 'arena', 'skip the line', 'small group',
  'fascinating', 'entertaining', 'professional', 'organized', 'smooth',
  'highlight', 'must do', 'must-do', 'bucket list', 'once in a lifetime',
  'exceeded', 'expectations', 'blown away', 'mind-blowing'
];

const fiveStars = allReviews.filter(r => r.rating === 5);
const positiveCounts = {};
positiveKeywords.forEach(kw => {
  const count = fiveStars.filter(r => r.text.toLowerCase().includes(kw)).length;
  if (count > 0) positiveCounts[kw] = count;
});

Object.entries(positiveCounts)
  .sort((a,b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([word, count]) => {
    const pct = (count / fiveStars.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`   ${word.padEnd(20)} ${count} (${pct}%)  ${bar}`);
  });

// ========================================
// 7. KEYWORD ANALYSIS — NEGATIVE REVIEWS (1-3 stars)
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  7. ⚠️ MOST COMMON WORDS IN 1-3 STAR REVIEWS                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const negativeKeywords = [
  'wait', 'waiting', 'crowded', 'rushed', 'short', 'disappointed', 'disappointing',
  'scam', 'waste', 'money', 'overpriced', 'expensive', 'rip off', 'ripoff',
  'confusing', 'lost', 'disorganized', 'chaotic', 'late', 'cancelled', 'canceled',
  'rude', 'boring', 'slow', 'long', 'hot', 'rain', 'weather',
  'audio', 'headset', 'headphone', 'app', 'broken', 'technical',
  'not worth', 'wouldn\'t recommend', 'avoid', 'terrible', 'awful', 'horrible',
  'refund', 'complaint', 'misleading', 'false advertising',
  'large group', 'too many people', 'couldn\'t hear', 'couldn\'t see',
  'skip', 'line', 'queue', 'security'
];

const lowStars = allReviews.filter(r => r.rating <= 3);
const negativeCounts = {};
negativeKeywords.forEach(kw => {
  const count = lowStars.filter(r => r.text.toLowerCase().includes(kw)).length;
  if (count > 0) negativeCounts[kw] = count;
});

console.log(`   Total 1-3 star reviews: ${lowStars.length} (${(lowStars.length/allReviews.length*100).toFixed(1)}% of all)\n`);

Object.entries(negativeCounts)
  .sort((a,b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([word, count]) => {
    const pct = (count / lowStars.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`   ${word.padEnd(20)} ${count} (${pct}%)  ${bar}`);
  });

// ========================================
// 8. GUIDE MENTIONS — Named guides
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  8. 👤 MOST MENTIONED GUIDES BY NAME                          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Buscar patrones como "our guide X", "guide X was", "X was our guide"
const guidePattern = /(?:guide|tour guide|our guide|guides?\s+(?:was|named|called))\s+([A-Z][a-z]+)/gi;
const guideMentions = {};

allReviews.forEach(r => {
  const matches = [...r.text.matchAll(guidePattern)];
  matches.forEach(m => {
    const name = m[1];
    if (name.length > 2 && !['The', 'Our', 'Was', 'Very', 'Really', 'She', 'His', 'Her', 'And', 'Not', 'But'].includes(name)) {
      if (!guideMentions[name]) guideMentions[name] = { count: 0, ratings: [] };
      guideMentions[name].count++;
      guideMentions[name].ratings.push(r.rating);
    }
  });
});

// También buscar "NAME was" al inicio o después de punto
const nameWasPattern = /(?:^|\.\s+)([A-Z][a-z]{2,})\s+(?:was|is)\s+(?:an?\s+)?(?:amazing|fantastic|great|excellent|wonderful|knowledgeable|incredible|brilliant|our)/gm;
allReviews.forEach(r => {
  const matches = [...r.text.matchAll(nameWasPattern)];
  matches.forEach(m => {
    const name = m[1];
    if (!['The', 'Our', 'Was', 'Very', 'Really', 'She', 'His', 'Her', 'And', 'Not', 'But', 'This', 'That'].includes(name)) {
      if (!guideMentions[name]) guideMentions[name] = { count: 0, ratings: [] };
      guideMentions[name].count++;
      guideMentions[name].ratings.push(r.rating);
    }
  });
});

Object.entries(guideMentions)
  .sort((a,b) => b[1].count - a[1].count)
  .slice(0, 15)
  .forEach(([name, data]) => {
    const avg = (data.ratings.reduce((a,b)=>a+b,0) / data.ratings.length).toFixed(1);
    console.log(`   ${name.padEnd(20)} ${data.count} mentions  |  avg ⭐ ${avg}/5`);
  });

// ========================================
// 9. RATING DISTRIBUTION
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  9. 📊 OVERALL RATING DISTRIBUTION                            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

for (let star = 5; star >= 1; star--) {
  const count = allReviews.filter(r => r.rating === star).length;
  const pct = (count / allReviews.length * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(pct));
  console.log(`   ${star}★  ${count.toString().padEnd(6)} (${pct.padStart(5)}%)  ${bar}`);
}

// ========================================
// 10. KEY FINDINGS SUMMARY
// ========================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  10. 📰 KEY FINDINGS FOR ARTICLE                              ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Calcular hallazgos
const overallAvg = (allReviews.reduce((a,r)=>a+r.rating,0) / allReviews.length).toFixed(2);
const pct5Star = (allReviews.filter(r=>r.rating===5).length / allReviews.length * 100).toFixed(1);
const pct1to3 = (allReviews.filter(r=>r.rating<=3).length / allReviews.length * 100).toFixed(1);

console.log(`   📊 Overall: ${overallAvg}/5 average across ${allReviews.length} reviews`);
console.log(`   ⭐ ${pct5Star}% gave 5 stars`);
console.log(`   ⚠️ ${pct1to3}% gave 1-3 stars`);

if (underground.length && arena.length) {
  const ugAvg = (underground.reduce((a,r)=>a+r.rating,0) / underground.length).toFixed(2);
  const arAvg = (arena.reduce((a,r)=>a+r.rating,0) / arena.length).toFixed(2);
  console.log(`   ⚔️ Underground (${ugAvg}/5) vs Arena (${arAvg}/5) — difference: ${(ugAvg - arAvg).toFixed(2)} stars`);
}

const guided = allReviews.filter(r => r.format === 'guided');
const audioGuide = allReviews.filter(r => r.format === 'audio-guide');
if (guided.length && audioGuide.length) {
  const gAvg = (guided.reduce((a,r)=>a+r.rating,0) / guided.length).toFixed(2);
  const aAvg = (audioGuide.reduce((a,r)=>a+r.rating,0) / audioGuide.length).toFixed(2);
  console.log(`   🎧 Guided (${gAvg}/5) vs Audio Guide (${aAvg}/5) — difference: ${(gAvg - aAvg).toFixed(2)} stars`);
}

if (americans.length && british.length) {
  const usAvg = (americans.reduce((a,r)=>a+r.rating,0) / americans.length).toFixed(2);
  const ukAvg = (british.reduce((a,r)=>a+r.rating,0) / british.length).toFixed(2);
  console.log(`   🌍 Americans (${usAvg}/5) vs British (${ukAvg}/5) — difference: ${(usAvg - ukAvg).toFixed(2)} stars`);
}

// Top positive keyword
const topPositive = Object.entries(positiveCounts).sort((a,b)=>b[1]-a[1])[0];
if (topPositive) {
  console.log(`   💬 Most common word in 5★ reviews: "${topPositive[0]}" (${(topPositive[1]/fiveStars.length*100).toFixed(0)}%)`);
}

// Top negative keyword
const topNegative = Object.entries(negativeCounts).sort((a,b)=>b[1]-a[1])[0];
if (topNegative) {
  console.log(`   ⚠️ Most common word in 1-3★ reviews: "${topNegative[0]}" (${(topNegative[1]/lowStars.length*100).toFixed(0)}%)`);
}

// Guide mention
const topGuide = Object.entries(guideMentions).sort((a,b)=>b[1].count-a[1].count)[0];
if (topGuide) {
  console.log(`   👤 Most mentioned guide: ${topGuide[0]} (${topGuide[1].count} mentions, avg ${(topGuide[1].ratings.reduce((a,b)=>a+b,0)/topGuide[1].ratings.length).toFixed(1)}/5)`);
}

console.log('\nDone!');