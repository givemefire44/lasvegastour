/**
 * tour-dossier.mjs — Dossier de un tour para dry-run conceptual
 *
 * Lee .cache/corpus.json y .cache/corpus-analysis.json
 * y muestra TODOS los datos que tendría el motor v4 para razonar
 * sobre un tour en particular.
 *
 * Solo lectura. No tocar nada.
 *
 * Usage:
 *   node tour-dossier.mjs --slug=<slug>
 */

import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];

if (!slugArg) {
  console.error('❌ Uso: node tour-dossier.mjs --slug=<slug>');
  console.error('\nEjemplo:');
  console.error('   node tour-dossier.mjs --slug=rome-night-tour-with-dinner-wine-pairing-luxury-vehicle');
  process.exit(1);
}

const SLUG = slugArg;

// ========================================
// LOAD
// ========================================
const corpus = JSON.parse(readFileSync('.cache/corpus.json', 'utf8'));
const analysis = JSON.parse(readFileSync('.cache/corpus-analysis.json', 'utf8'));

const tour = corpus.tours.find(t => t.slug === SLUG);
const tourAnalysis = analysis.tourAnalysis[SLUG];
const tourClaimsAnalysis = analysis.tourClaimsAnalysis[SLUG];

if (!tour) {
  console.error(`❌ Tour '${SLUG}' no encontrado en corpus`);
  process.exit(1);
}

// ========================================
// HEADER
// ========================================
console.log('\n' + '═'.repeat(80));
console.log(`  DOSSIER — ${tour.title}`);
console.log(`  Slug: ${tour.slug}`);
console.log(`  Format: ${tour.format || 'unknown'}`);
console.log('═'.repeat(80));

// ========================================
// 1. SPECS DUROS
// ========================================
console.log('\n📊 SPECS DUROS');
console.log('─'.repeat(80));
console.log(`  Price:      $${tour.specs.price} ${tour.specs.currency}`);
console.log(`  Duration:   ${tour.specs.duration?.raw || 'N/A'} (${tour.specs.duration?.minutes || '?'} min)`);
console.log(`  Rating:     ${tour.specs.rating || 'N/A'}`);
console.log(`  Reviews:    ${tour.specs.reviewCount || 'N/A'}`);
console.log(`  Provider:   ${tour.specs.provider || 'N/A'}`);

// ========================================
// 2. POSICIÓN EN CATÁLOGO (de tourAnalysis)
// ========================================
console.log('\n📍 POSICIÓN EN CATÁLOGO');
console.log('─'.repeat(80));
if (tourAnalysis?.priceRankAbsolute) {
  console.log(`  Price rank:     #${tourAnalysis.priceRankAbsolute} of ${tourAnalysis.priceTotalCount}  (${tourAnalysis.priceRankAbsolute === 1 ? 'CHEAPEST' : tourAnalysis.priceRankAbsolute === tourAnalysis.priceTotalCount ? 'MOST EXPENSIVE' : 'middle'})`);
}
if (tourAnalysis?.durationRankAbsolute) {
  console.log(`  Duration rank:  #${tourAnalysis.durationRankAbsolute} of ${tourAnalysis.durationTotalCount}  (${tourAnalysis.durationRankAbsolute === 1 ? 'SHORTEST' : tourAnalysis.durationRankAbsolute === tourAnalysis.durationTotalCount ? 'LONGEST' : 'middle'})`);
}
if (tourAnalysis?.reviewCountRankAbsolute) {
  console.log(`  Reviews rank:   #${tourAnalysis.reviewCountRankAbsolute} of ${tourAnalysis.reviewCountTotalCount}  (${tourAnalysis.reviewCountRankAbsolute === 1 ? 'MOST REVIEWED' : 'middle'})`);
}
console.log(`  Categories:     ${tourAnalysis?.categories?.join(', ') || 'N/A'}`);

// ========================================
// 3. SUBSET POSITIONS
// ========================================
const subsetEntries = Object.entries(tourAnalysis?.subsetPositions || {});
if (subsetEntries.length > 0) {
  console.log('\n🎯 POSICIÓN EN SUBSETS (donde el tour tiene una premium feature)');
  console.log('─'.repeat(80));
  for (const [feat, data] of subsetEntries) {
    console.log(`  ${feat.padEnd(20)} subset of ${data.subsetSize} tours`);
    console.log(`     Price rank:     #${data.priceRank}/${data.priceCount}`);
    console.log(`     Duration rank:  #${data.durationRank}/${data.durationCount}`);
  }
}

if (tourAnalysis?.isCheapestWith?.length > 0) {
  console.log(`\n  💰 CHEAPEST in subset:    ${tourAnalysis.isCheapestWith.join(', ')}`);
}
if (tourAnalysis?.isMostExpensiveWith?.length > 0) {
  console.log(`  💎 MOST EXPENSIVE in:     ${tourAnalysis.isMostExpensiveWith.join(', ')}`);
}
if (tourAnalysis?.isShortestWith?.length > 0) {
  console.log(`  ⚡ SHORTEST in:           ${tourAnalysis.isShortestWith.join(', ')}`);
}
if (tourAnalysis?.isLongestWith?.length > 0) {
  console.log(`  🐢 LONGEST in:            ${tourAnalysis.isLongestWith.join(', ')}`);
}
if (tourAnalysis?.isFourLevelCoverage) {
  console.log(`  ⭐ FOUR-LEVEL COVERAGE (forum + palatine + arena + underground)`);
}
if (tourAnalysis?.uniqueCombo) {
  const u = tourAnalysis.uniqueCombo;
  console.log(`  🌟 UNIQUE COMBO: ${u.combo.join(' + ')} (siblings: ${u.siblingCount}, rarity: ${u.rarity})`);
}

// ========================================
// 4. FEATURES
// ========================================
console.log('\n🏷️  FEATURES');
console.log('─'.repeat(80));
console.log(`  Combined: ${tour.features.combined.join(', ')}`);

// ========================================
// 5. CLAIMS POR RAREZA (de tourClaimsAnalysis)
// ========================================
console.log('\n💎 CLAIMS POR RAREZA (lo más citable)');
console.log('─'.repeat(80));

if (tourClaimsAnalysis?.rareClaims?.length > 0) {
  console.log('\n  ✅ EXPLICIT — claims raros/distintivos:');
  for (const c of tourClaimsAnalysis.rareClaims) {
    console.log(`     ${c.claim.padEnd(30)} ${c.count}/${analysis.metadata.totalTours} (${c.percent}%) [${c.rarityClass}]`);
  }
}

if (tourClaimsAnalysis?.criticalNegatives?.length > 0) {
  console.log('\n  ❌ NEGATIVE — concesiones citables (lo que NO incluye y la mayoría sí):');
  for (const c of tourClaimsAnalysis.criticalNegatives) {
    console.log(`     ${c.claim.padEnd(30)} ${c.count}/${analysis.metadata.totalTours} (${c.percent}%) [${c.rarityClass}]`);
  }
}

if (tourClaimsAnalysis?.rareInterpretive?.length > 0) {
  console.log('\n  🟡 INTERPRETIVE — audiencias raras:');
  for (const c of tourClaimsAnalysis.rareInterpretive) {
    console.log(`     ${c.claim.padEnd(30)} ${c.count}/${analysis.metadata.totalTours} (${c.percent}%) [${c.rarityClass}]`);
  }
}

if (tourClaimsAnalysis) {
  console.log(`\n  Citability score: ${tourClaimsAnalysis.citabilityScore}`);
  console.log(`  Common claims:    ${tourClaimsAnalysis.commonClaimsCount}`);
  console.log(`  Commodity claims: ${tourClaimsAnalysis.commodityClaimsCount}`);
}

// ========================================
// 6. SELF-COMPARISONS DEL BODY
// ========================================
const selfComps = tour.extracted?.whatMakesDifferent?.selfComparisons || [];
if (selfComps.length > 0) {
  console.log('\n🎯 SELF-COMPARISONS DEL TOUR (lo que el tour mismo dice)');
  console.log('─'.repeat(80));
  for (const c of selfComps) {
    if (c.type === 'price_references') {
      console.log(`  💰 Price refs en body: ${c.values.join(', ')}`);
    } else {
      console.log(`  ${c.type}: "${c.raw}"`);
    }
  }
}

// ========================================
// 7. QUICK ANSWER (resumen interpretativo)
// ========================================
if (tour.extracted?.quickAnswer?.raw) {
  console.log('\n💡 QUICK ANSWER (síntesis del tour)');
  console.log('─'.repeat(80));
  const qa = tour.extracted.quickAnswer.raw;
  console.log(`  "${qa.length > 400 ? qa.slice(0, 400) + '...' : qa}"`);
}

// ========================================
// 8. WHAT MAKES DIFFERENT
// ========================================
if (tour.extracted?.whatMakesDifferent?.raw) {
  console.log('\n🔄 WHAT MAKES DIFFERENT');
  console.log('─'.repeat(80));
  const wm = tour.extracted.whatMakesDifferent.raw;
  console.log(`  "${wm.length > 400 ? wm.slice(0, 400) + '...' : wm}"`);
}

// ========================================
// 9. INCLUDED / NOT INCLUDED
// ========================================
if (tour.extracted?.included?.length > 0) {
  console.log('\n✅ INCLUDED');
  console.log('─'.repeat(80));
  tour.extracted.included.forEach(i => console.log(`  - ${i}`));
}

if (tour.extracted?.notIncluded?.length > 0) {
  console.log('\n❌ NOT INCLUDED');
  console.log('─'.repeat(80));
  tour.extracted.notIncluded.forEach(i => console.log(`  - ${i}`));
}

// ========================================
// 10. BEST FOR
// ========================================
if (tour.extracted?.bestFor?.length > 0) {
  console.log('\n👤 BEST FOR');
  console.log('─'.repeat(80));
  tour.extracted.bestFor.forEach(i => console.log(`  - ${i}`));
}

// ========================================
// 11. CONTEXTO GLOBAL DEL CATÁLOGO (para tensiones)
// ========================================
console.log('\n📈 CONTEXTO DEL CATÁLOGO (para razonar tensiones)');
console.log('─'.repeat(80));
const gd = analysis.globalDistributions;
console.log(`  Catalog price range:     $${gd.price.min} – $${gd.price.max}`);
console.log(`  Catalog price median:    $${gd.price.p50}, p25=$${gd.price.p25}, p75=$${gd.price.p75}`);
console.log(`  Catalog duration median: ${gd.duration.p50} min`);
console.log(`  Total tours in catalog:  ${analysis.metadata.totalTours}`);

console.log('\n' + '═'.repeat(80));
console.log('  FIN DEL DOSSIER');
console.log('═'.repeat(80));
console.log('');