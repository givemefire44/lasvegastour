/**
 * analyze-corpus.mjs — Script 2 de 3 (v0.3 — Colosseum edition)
 *
 * v0.3 CHANGES:
 *   - Capa 7 (NUEVA): claimsCommonness — frecuencia global de cada claim
 *   - Capa 8 (NUEVA): priceRefsAggregated — agregación de price refs del corpus
 *   - Capa 9 (NUEVA): tourClaimsAnalysis — claims raros y citables por tour
 *   - Mantiene 100% de las capas 1-6 existentes
 *
 * Input:  .cache/corpus.json (v0.3 — con extracted + claims)
 * Output: .cache/corpus-analysis.json
 */

import { readFileSync, writeFileSync } from 'fs';

const INPUT_PATH = '.cache/corpus.json';
const OUTPUT_PATH = '.cache/corpus-analysis.json';

console.log('\n📊 ANALYZE CORPUS — Script 2 de 3 (v0.3 Colosseum)');
console.log(`   Input: ${INPUT_PATH}`);
console.log(`   Output: ${OUTPUT_PATH}\n`);

// ========================================
// LOAD
// ========================================
const corpus = JSON.parse(readFileSync(INPUT_PATH, 'utf8'));
console.log(`📥 Loaded ${corpus.tours.length} tours from corpus\n`);

// ========================================
// FEATURE TIERS (Colosseum-specific)
// ========================================
const COMMODITY_FEATURES = new Set([
  'skip_line',
  'live_guide',
  'free_cancellation',
  'small_group',
  'audio_guide',
  'roman_forum'
]);

const PREMIUM_FEATURES = new Set([
  'arena_floor',
  'underground',
  'palatine_hill',
  'vatican',
  'wheelchair_accessible',
  'hotel_pickup',
  'attic',
  'pantheon',
  'gladiator_focus',
  'night_tour'
]);

// ========================================
// HELPERS DE ESTADÍSTICA
// ========================================
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return null;
  const idx = Math.floor(sortedArr.length * p);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
}

function stats(values) {
  const sorted = [...values].filter(v => v != null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.50),
    p75: percentile(sorted, 0.75),
    avg: sorted.reduce((a, b) => a + b, 0) / sorted.length
  };
}

// ========================================
// CAPA 1 — DISTRIBUCIONES GLOBALES
// ========================================
const priceStats = stats(corpus.tours.map(t => t.specs.price));
const durationStats = stats(corpus.tours.map(t => t.specs.duration?.minutes));
const ratingStats = stats(corpus.tours.map(t => t.specs.rating));
const reviewCountStats = stats(corpus.tours.map(t => t.specs.reviewCount));

// ========================================
// CAPA 2 — FRECUENCIA DE FEATURES
// ========================================
const featureCounts = {};
for (const tour of corpus.tours) {
  for (const f of tour.features.combined) {
    featureCounts[f] = (featureCounts[f] || 0) + 1;
  }
}

const featureCommonness = {};
for (const [feature, count] of Object.entries(featureCounts)) {
  featureCommonness[feature] = {
    count,
    percent: Math.round((count / corpus.tours.length) * 100),
    rarity: corpus.tours.length - count
  };
}

// ========================================
// CAPA 3 — CATEGORÍAS NATURALES
// ========================================
function classifyTour(tour) {
  const cats = [];
  const feats = new Set(tour.features.combined);
  const lowerTitle = (tour.title || '').toLowerCase();

  const isMultiSite = feats.has('palatine_hill')
                    || feats.has('vatican')
                    || feats.has('pantheon')
                    || feats.has('hotel_pickup');
  cats.push(isMultiSite ? 'multi_site' : 'single_site');

  if (feats.has('audio_guide') && !feats.has('live_guide')) cats.push('audio_guide_only');
  if (feats.has('live_guide')) cats.push('guided');

  const mins = tour.specs.duration?.minutes;
  if (mins != null) {
    if (mins < 90) cats.push('short_format');
    else if (mins >= 360) cats.push('full_day');
    else if (mins >= 240) cats.push('extended_format');
    else cats.push('standard_format');
  }

  if (priceStats && tour.specs.price != null) {
    if (tour.specs.price <= priceStats.p25) cats.push('budget_priced');
    else if (tour.specs.price >= priceStats.p75) cats.push('premium_priced');
    else cats.push('mid_priced');
  }

  if (feats.has('arena_floor')) cats.push('has_arena_floor');
  if (feats.has('underground')) cats.push('has_underground');
  if (feats.has('attic')) cats.push('has_attic');
  if (feats.has('palatine_hill')) cats.push('has_palatine');
  if (feats.has('vatican')) cats.push('has_vatican');
  if (feats.has('pantheon')) cats.push('has_pantheon');
  if (feats.has('wheelchair_accessible')) cats.push('wheelchair_friendly');

  if (/\bnight\b|\bevening\b|moonlight|by\s+night|twilight/i.test(lowerTitle)) cats.push('night_theme');
  if (/\bgladiator|\bcombat\b|spartacus/i.test(lowerTitle)) cats.push('gladiator_theme');
  if (/\bprivate\b|\bexclusive\b/i.test(lowerTitle)) cats.push('private_theme');
  if (/audio[\s-]?(guide|app)|self[\s-]guided/i.test(lowerTitle)) cats.push('audio_theme');

  if (feats.has('roman_forum') && feats.has('palatine_hill')
      && feats.has('arena_floor') && feats.has('underground')) {
    cats.push('four_level_coverage');
  }

  return cats;
}

const tourCategories = {};
const categoryMembers = {};

for (const tour of corpus.tours) {
  const cats = classifyTour(tour);
  tourCategories[tour.slug] = cats;
  for (const cat of cats) {
    if (!categoryMembers[cat]) categoryMembers[cat] = [];
    categoryMembers[cat].push(tour.slug);
  }
}

// ========================================
// CAPA 4 — OUTLIERS GLOBALES
// ========================================
function findOutlier(tours, accessor, mode = 'max') {
  const valid = tours.filter(t => accessor(t) != null);
  if (valid.length === 0) return null;
  return valid.reduce((best, current) => {
    const bestVal = accessor(best);
    const currentVal = accessor(current);
    if (mode === 'max') return currentVal > bestVal ? current : best;
    return currentVal < bestVal ? current : best;
  });
}

const outliers = {
  mostExpensive: findOutlier(corpus.tours, t => t.specs.price, 'max')?.slug,
  cheapest: findOutlier(corpus.tours, t => t.specs.price, 'min')?.slug,
  longestDuration: findOutlier(corpus.tours, t => t.specs.duration?.minutes, 'max')?.slug,
  shortestDuration: findOutlier(corpus.tours, t => t.specs.duration?.minutes, 'min')?.slug,
  mostReviews: findOutlier(corpus.tours, t => t.specs.reviewCount, 'max')?.slug,
  highestRating: findOutlier(corpus.tours, t => t.specs.rating, 'max')?.slug,
  mostStops: findOutlier(corpus.tours, t => t.itinerary?.stopCount, 'max')?.slug,
  fewestStops: findOutlier(corpus.tours, t => t.itinerary?.stopCount, 'min')?.slug
};

// ========================================
// CAPA 5 — UNIQUE FEATURE COMBOS
// ========================================
function findUniqueCombo(tour, allTours) {
  const eligibleFeatures = tour.features.combined.filter(f => !COMMODITY_FEATURES.has(f));
  if (eligibleFeatures.length < 3) return null;

  let bestCombo = null;
  let bestSiblingCount = Infinity;
  let bestRarity = -Infinity;

  for (let i = 0; i < eligibleFeatures.length; i++) {
    for (let j = i + 1; j < eligibleFeatures.length; j++) {
      for (let k = j + 1; k < eligibleFeatures.length; k++) {
        const combo = [eligibleFeatures[i], eligibleFeatures[j], eligibleFeatures[k]];

        const hasPremium = combo.some(f => PREMIUM_FEATURES.has(f));
        if (!hasPremium) continue;

        const siblingCount = allTours.filter(t => {
          if (t.slug === tour.slug) return false;
          const tFeats = new Set(t.features.combined);
          return combo.every(f => tFeats.has(f));
        }).length;

        const rarity = combo.reduce((sum, f) => sum + (featureCommonness[f]?.rarity || 0), 0);

        if (siblingCount < bestSiblingCount ||
            (siblingCount === bestSiblingCount && rarity > bestRarity)) {
          bestCombo = combo;
          bestSiblingCount = siblingCount;
          bestRarity = rarity;
        }
      }
    }
  }

  return bestCombo ? { combo: bestCombo, siblingCount: bestSiblingCount, rarity: bestRarity } : null;
}

// ========================================
// CAPA 6 — POR TOUR: outlier dimensions
// ========================================
function analyzeTourOutliers(tour, corpus) {
  const dim = {
    slug: tour.slug,
    title: tour.title,
    categories: tourCategories[tour.slug],

    priceRankAbsolute: null,
    durationRankAbsolute: null,
    reviewCountRankAbsolute: null,

    subsetPositions: {},
    uniqueCombo: null,

    isCheapestWith: [],
    isMostExpensiveWith: [],
    isShortestWith: [],
    isLongestWith: [],

    isFourLevelCoverage: false,
    multiSitePartner: null
  };

  if (tour.specs.price != null) {
    const sorted = [...corpus.tours].filter(t => t.specs.price != null).sort((a, b) => a.specs.price - b.specs.price);
    dim.priceRankAbsolute = sorted.findIndex(t => t.slug === tour.slug) + 1;
    dim.priceTotalCount = sorted.length;
  }

  if (tour.specs.duration?.minutes != null) {
    const sorted = [...corpus.tours].filter(t => t.specs.duration?.minutes != null).sort((a, b) => a.specs.duration.minutes - b.specs.duration.minutes);
    dim.durationRankAbsolute = sorted.findIndex(t => t.slug === tour.slug) + 1;
    dim.durationTotalCount = sorted.length;
  }

  if (tour.specs.reviewCount != null) {
    const sorted = [...corpus.tours].filter(t => t.specs.reviewCount != null).sort((a, b) => b.specs.reviewCount - a.specs.reviewCount);
    dim.reviewCountRankAbsolute = sorted.findIndex(t => t.slug === tour.slug) + 1;
    dim.reviewCountTotalCount = sorted.length;
  }

  const PREMIUM_FOR_SUBSETS = ['arena_floor', 'underground', 'palatine_hill', 'vatican', 'wheelchair_accessible'];
  for (const feat of PREMIUM_FOR_SUBSETS) {
    if (!tour.features.combined.includes(feat)) continue;

    const subset = corpus.tours.filter(t => t.features.combined.includes(feat));
    if (subset.length < 2) continue;

    const sortedByPrice = subset.filter(t => t.specs.price != null).sort((a, b) => a.specs.price - b.specs.price);
    const priceRank = sortedByPrice.findIndex(t => t.slug === tour.slug) + 1;

    const sortedByDur = subset.filter(t => t.specs.duration?.minutes != null).sort((a, b) => a.specs.duration.minutes - b.specs.duration.minutes);
    const durationRank = sortedByDur.findIndex(t => t.slug === tour.slug) + 1;

    dim.subsetPositions[feat] = {
      subsetSize: subset.length,
      priceRank,
      priceCount: sortedByPrice.length,
      durationRank,
      durationCount: sortedByDur.length
    };

    if (priceRank === 1) dim.isCheapestWith.push(feat);
    if (priceRank === sortedByPrice.length && sortedByPrice.length >= 3) dim.isMostExpensiveWith.push(feat);
    if (durationRank === 1) dim.isShortestWith.push(feat);
    if (durationRank === sortedByDur.length && sortedByDur.length >= 3) dim.isLongestWith.push(feat);
  }

  dim.uniqueCombo = findUniqueCombo(tour, corpus.tours);

  const feats = new Set(tour.features.combined);
  dim.isFourLevelCoverage = feats.has('roman_forum') && feats.has('palatine_hill')
                           && feats.has('arena_floor') && feats.has('underground');

  if (feats.has('vatican')) dim.multiSitePartner = 'Vatican';
  else if (feats.has('palatine_hill')) dim.multiSitePartner = 'Palatine Hill';
  else if (feats.has('pantheon')) dim.multiSitePartner = 'Pantheon';

  return dim;
}

const tourAnalysis = {};
for (const tour of corpus.tours) {
  tourAnalysis[tour.slug] = analyzeTourOutliers(tour, corpus);
}

// ========================================
// CAPA 7 — CLAIMS COMMONNESS (NUEVO v0.3)
// ========================================
/**
 * Frecuencia global de cada claim en el corpus.
 * Permite distinguir claims commodity (>70%) de raros (<30%).
 */
const claimCounts = { explicit: {}, explicitNegative: {}, interpretive: {} };
const toursWithClaims = corpus.tours.filter(t => t.claims).length;

for (const tour of corpus.tours) {
  if (!tour.claims) continue;
  for (const c of tour.claims.explicit || []) {
    claimCounts.explicit[c] = (claimCounts.explicit[c] || 0) + 1;
  }
  for (const c of tour.claims.explicitNegative || []) {
    claimCounts.explicitNegative[c] = (claimCounts.explicitNegative[c] || 0) + 1;
  }
  for (const c of tour.claims.interpretive || []) {
    claimCounts.interpretive[c] = (claimCounts.interpretive[c] || 0) + 1;
  }
}

const claimsCommonness = { explicit: {}, explicitNegative: {}, interpretive: {} };

function classifyClaimRarity(percent) {
  if (percent >= 70) return 'commodity';     // todos lo tienen, no diferencia
  if (percent >= 30) return 'common';        // diferenciador medio
  if (percent >= 10) return 'distinctive';   // diferenciador fuerte
  return 'rare';                              // muy citable
}

for (const type of ['explicit', 'explicitNegative', 'interpretive']) {
  for (const [claim, count] of Object.entries(claimCounts[type])) {
    const percent = Math.round((count / corpus.tours.length) * 100);
    claimsCommonness[type][claim] = {
      count,
      percent,
      rarity: corpus.tours.length - count,
      rarityClass: classifyClaimRarity(percent)
    };
  }
}

// ========================================
// CAPA 8 — PRICE REFS AGGREGATED (NUEVO v0.3)
// ========================================
/**
 * Agrega todos los price references que los tours mencionan en su body
 * (en self-comparisons del whatMakesDifferent).
 *
 * Esto permite al motor v4 verificar si un claim de tipo
 * "compared to $57-65 daytime tours" tiene respaldo real en el catálogo.
 */
const priceRefsAggregated = {
  totalRefs: 0,
  toursWithRefs: 0,
  uniqueValues: new Set(),
  byTour: {}
};

for (const tour of corpus.tours) {
  const comps = tour.extracted?.whatMakesDifferent?.selfComparisons || [];
  const priceRefs = comps.filter(c => c.type === 'price_references');
  if (priceRefs.length === 0) continue;

  priceRefsAggregated.toursWithRefs++;
  const tourRefs = [];
  for (const ref of priceRefs) {
    for (const value of ref.values || []) {
      priceRefsAggregated.totalRefs++;
      priceRefsAggregated.uniqueValues.add(value);
      tourRefs.push(value);
    }
  }
  priceRefsAggregated.byTour[tour.slug] = tourRefs;
}

priceRefsAggregated.uniqueValues = [...priceRefsAggregated.uniqueValues].sort();

// ========================================
// CAPA 9 — TOUR CLAIMS ANALYSIS (NUEVO v0.3)
// ========================================
/**
 * Por cada tour, identifica:
 *   - Claims raros que tiene (oro citable)
 *   - Claims negativos críticos (concesiones reales)
 *   - "citabilityScore": suma de rareza de claims raros
 */
const tourClaimsAnalysis = {};

for (const tour of corpus.tours) {
  if (!tour.claims) {
    tourClaimsAnalysis[tour.slug] = null;
    continue;
  }

  const rareClaims = [];      // explicit que sean rare/distinctive
  const commonClaims = [];    // explicit que sean common
  const commodityClaims = []; // explicit que sean commodity
  const criticalNegatives = [];  // negative claims que sean rare/distinctive

  for (const c of tour.claims.explicit || []) {
    const meta = claimsCommonness.explicit[c];
    if (!meta) continue;
    if (meta.rarityClass === 'rare' || meta.rarityClass === 'distinctive') rareClaims.push({ claim: c, ...meta });
    else if (meta.rarityClass === 'common') commonClaims.push({ claim: c, ...meta });
    else commodityClaims.push({ claim: c, ...meta });
  }

  for (const c of tour.claims.explicitNegative || []) {
    const meta = claimsCommonness.explicitNegative[c];
    if (!meta) continue;
    // Negative claims raros son CONCESIONES citables ("este NO incluye X que la mayoría sí tiene")
    if (meta.rarityClass === 'rare' || meta.rarityClass === 'distinctive') {
      criticalNegatives.push({ claim: c, ...meta });
    }
  }

  const rareInterpretive = [];
  for (const c of tour.claims.interpretive || []) {
    const meta = claimsCommonness.interpretive[c];
    if (!meta) continue;
    if (meta.rarityClass === 'rare' || meta.rarityClass === 'distinctive') {
      rareInterpretive.push({ claim: c, ...meta });
    }
  }

  // Citability score: suma de rareza de los claims raros (más raro = más citable)
  const citabilityScore = rareClaims.reduce((s, c) => s + c.rarity, 0)
                         + criticalNegatives.reduce((s, c) => s + c.rarity, 0)
                         + rareInterpretive.reduce((s, c) => s + c.rarity, 0);

  tourClaimsAnalysis[tour.slug] = {
    format: tour.format,
    rareClaims:        rareClaims.sort((a, b) => b.rarity - a.rarity),
    rareInterpretive:  rareInterpretive.sort((a, b) => b.rarity - a.rarity),
    criticalNegatives: criticalNegatives.sort((a, b) => b.rarity - a.rarity),
    commonClaimsCount: commonClaims.length,
    commodityClaimsCount: commodityClaims.length,
    citabilityScore,
    selfComparisonsCount: tour.extracted?.whatMakesDifferent?.selfComparisons?.length || 0,
    priceRefsInBody: priceRefsAggregated.byTour[tour.slug] || []
  };
}

// ========================================
// SAVE
// ========================================
const analysis = {
  metadata: {
    ...corpus.metadata,
    analyzedAt: new Date().toISOString(),
    schemaVersion: '0.3'
  },

  globalDistributions: {
    price: priceStats,
    duration: durationStats,
    rating: ratingStats,
    reviewCount: reviewCountStats
  },

  featureCommonness,
  categoryMembers,
  tourCategories,
  outliers,
  tourAnalysis,

  // NUEVO v0.3:
  claimsCommonness,
  priceRefsAggregated,
  tourClaimsAnalysis
};

writeFileSync(OUTPUT_PATH, JSON.stringify(analysis, null, 2));

// ========================================
// REPORT
// ========================================
console.log('📊 GLOBAL DISTRIBUTIONS');
console.log(`   Price:    $${priceStats.min} – $${priceStats.max} (median $${priceStats.p50}, p75 $${priceStats.p75})`);
console.log(`   Duration: ${durationStats.min}min – ${durationStats.max}min (median ${durationStats.p50}min)`);
console.log(`   Rating:   ${ratingStats.min} – ${ratingStats.max} (median ${ratingStats.p50})`);
console.log(`   Reviews:  ${reviewCountStats.min} – ${reviewCountStats.max} (median ${reviewCountStats.p50})\n`);

console.log('🏷️  FEATURE COMMONNESS (sorted by rarity):');
const sortedFeatures = Object.entries(featureCommonness).sort((a, b) => b[1].rarity - a[1].rarity);
for (const [feat, data] of sortedFeatures) {
  const rarityIndicator = data.percent < 15 ? '🌟' : data.percent < 50 ? '⭐' : '  ';
  const tier = COMMODITY_FEATURES.has(feat) ? ' [commodity]' : PREMIUM_FEATURES.has(feat) ? ' [premium]' : '';
  console.log(`   ${rarityIndicator} ${feat.padEnd(25)} ${data.count}/${corpus.tours.length} (${data.percent}%)${tier}`);
}

console.log('\n📁 CATEGORY POPULATION:');
const sortedCats = Object.entries(categoryMembers).sort((a, b) => b[1].length - a[1].length);
for (const [cat, members] of sortedCats) {
  console.log(`   ${cat.padEnd(25)} ${members.length} tours`);
}

console.log('\n🎯 GLOBAL OUTLIERS:');
for (const [key, slug] of Object.entries(outliers)) {
  console.log(`   ${key.padEnd(20)} ${slug || '(none)'}`);
}

const withUniqueCombo = Object.values(tourAnalysis).filter(t => t.uniqueCombo).length;
const withFullyUnique = Object.values(tourAnalysis).filter(t => t.uniqueCombo?.siblingCount === 0).length;
console.log('\n🔬 UNIQUE COMBO STATS (post commodity filter):');
console.log(`   Tours with any unique combo:  ${withUniqueCombo}/${corpus.tours.length}`);
console.log(`   Tours with siblingCount=0:    ${withFullyUnique}/${corpus.tours.length}`);

// === REPORT v0.3 — Capas 7-9 ===
console.log('\n💡 CLAIMS COMMONNESS (v0.3 — top diferenciadores):');

console.log('\n   ✅ EXPLICIT (sorted by rarity, mostrando solo distintivos/raros):');
const sortedExplicit = Object.entries(claimsCommonness.explicit).sort((a, b) => b[1].rarity - a[1].rarity);
for (const [c, data] of sortedExplicit) {
  if (data.rarityClass === 'commodity') continue;
  const icon = data.rarityClass === 'rare' ? '🌟' : data.rarityClass === 'distinctive' ? '⭐' : '  ';
  console.log(`   ${icon} ${c.padEnd(30)} ${data.count}/${corpus.tours.length} (${data.percent}%) [${data.rarityClass}]`);
}

console.log('\n   ❌ EXPLICIT NEGATIVE (sorted by rarity, distinctive/rare):');
const sortedNeg = Object.entries(claimsCommonness.explicitNegative).sort((a, b) => b[1].rarity - a[1].rarity);
for (const [c, data] of sortedNeg) {
  if (data.rarityClass === 'commodity') continue;
  const icon = data.rarityClass === 'rare' ? '🌟' : data.rarityClass === 'distinctive' ? '⭐' : '  ';
  console.log(`   ${icon} ${c.padEnd(30)} ${data.count}/${corpus.tours.length} (${data.percent}%) [${data.rarityClass}]`);
}

console.log('\n   🟡 INTERPRETIVE (sorted by rarity, distinctive/rare):');
const sortedInt = Object.entries(claimsCommonness.interpretive).sort((a, b) => b[1].rarity - a[1].rarity);
for (const [c, data] of sortedInt) {
  if (data.rarityClass === 'commodity') continue;
  const icon = data.rarityClass === 'rare' ? '🌟' : data.rarityClass === 'distinctive' ? '⭐' : '  ';
  console.log(`   ${icon} ${c.padEnd(30)} ${data.count}/${corpus.tours.length} (${data.percent}%) [${data.rarityClass}]`);
}

console.log('\n💰 PRICE REFS AGGREGATED:');
console.log(`   Tours with price refs:    ${priceRefsAggregated.toursWithRefs}/${corpus.tours.length}`);
console.log(`   Total price refs:         ${priceRefsAggregated.totalRefs}`);
console.log(`   Unique values mentioned:  ${priceRefsAggregated.uniqueValues.length}`);
if (priceRefsAggregated.uniqueValues.length > 0 && priceRefsAggregated.uniqueValues.length <= 30) {
  console.log(`   Values: ${priceRefsAggregated.uniqueValues.join(', ')}`);
}

console.log('\n📊 CITABILITY SCORE — top 10 tours:');
const topCitable = Object.entries(tourClaimsAnalysis)
  .filter(([, v]) => v && v.citabilityScore > 0)
  .sort((a, b) => b[1].citabilityScore - a[1].citabilityScore)
  .slice(0, 10);
for (const [slug, data] of topCitable) {
  console.log(`   ${String(data.citabilityScore).padStart(4)}  ${slug}`);
  if (data.rareClaims.length > 0) {
    console.log(`         ${data.rareClaims.slice(0, 3).map(c => c.claim).join(', ')}`);
  }
}

const sizeKB = (Buffer.byteLength(JSON.stringify(analysis)) / 1024).toFixed(1);
console.log(`\n✅ Analysis saved to ${OUTPUT_PATH} (${sizeKB} KB)`);
console.log('\n   Próximo paso: motor v4 (apply-citables.mjs)');