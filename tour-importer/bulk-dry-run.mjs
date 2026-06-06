/**
 * bulk-dry-run.mjs — Motor v0.5.5 Colosseum edition (v3 — feedback experto)
 *
 * v3 IMPROVEMENTS (validación final del experto):
 *
 *   IMPROVEMENT 1: breadth_for_depth ahora rota entre 4 variantes
 *     - Antes: 1 sola frase aparecía 40 veces
 *     - Ahora: 4 variantes rotadas por hash(slug) → ~10 cada una
 *
 *   IMPROVEMENT 2: palatine_combo ahora tiene 4 plantillas (era 3)
 *     - Reduce repetición en 20 tours del catálogo
 *
 * El experto aprobó el motor: "publicable, monetizable, GEO-ready, AI-citable".
 * Después de este bulk → patchear directo.
 */

import { readFileSync, writeFileSync } from 'fs';

const corpus = JSON.parse(readFileSync('.cache/corpus.json', 'utf8'));
const analysis = JSON.parse(readFileSync('.cache/corpus-analysis.json', 'utf8'));

console.log('\n📊 BULK DRY-RUN — Colosseum (77 tours) — v3');
console.log('   Mode: 🟡 NO PATCH (read-only)\n');

// ========================================
// LABELS
// ========================================
const featureLabels = {
  arena_floor: 'arena floor access',
  underground: 'underground access',
  attic: 'attic access',
  roman_forum: 'Roman Forum',
  palatine_hill: 'Palatine Hill',
  vatican: 'Vatican',
  pantheon: 'Pantheon',
  hotel_pickup: 'hotel pickup',
  headphones: 'headphones',
  skip_line: 'skip-the-line entry',
  live_guide: 'professional guide',
  audio_guide: 'audio guide',
  small_group: 'small group format',
  free_cancellation: 'free cancellation',
  wheelchair_accessible: 'wheelchair access',
  gladiator_focus: 'gladiator history focus',
  night_tour: 'evening visit'
};

const NON_CITABLE_FEATURES = new Set([
  'headphones',
  'audio_guide',
  'skip_line',
  'hotel_pickup',
  'free_cancellation',
  'small_group',
  'live_guide'
]);

// ========================================
// HELPERS
// ========================================
function isAudioOnlyTour(t) {
  return /audio[\s-]?(guide|app)|self[\s-]guided|audioguide/i.test(t.title || '');
}
function isPrivateOrExclusive(t) {
  return /\bprivate\b|\bexclusive\b|semi[-\s]private/i.test(t.title || '');
}
function isMamertineTour(t) {
  return /mamertine|ludus\s+magnus/i.test(t.title || '');
}
function isExpressFormat(t) {
  return /\bexpress\b|fast[-\s]track|skip[\s-]the[\s-]ticket[\s-]line/i.test(t.title || '');
}
function isNightTour(t, ta) {
  return ta.categories.includes('night_theme');
}
function isGladiatorThemed(t, ta) {
  return ta.categories.includes('gladiator_theme');
}

function hashSlug(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h) + slug.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function formatDurationHuman(d) {
  if (!d?.minutes) return null;
  if (d.isRange) {
    if (d.rangeMax < 120) return `${d.rangeMin}–${d.rangeMax} minutes`;
    return `${formatHours(d.rangeMin / 60)}–${formatHours(d.rangeMax / 60)} hours`;
  }
  if (d.minutes < 120) return `${d.minutes} minutes`;
  return `${formatHours(d.minutes / 60)} hours`;
}
function formatHours(h) { return h % 1 === 0 ? `${Math.round(h)}` : `${h.toFixed(1).replace(/\.0$/, '')}`; }
function formatPrice(p, c = 'USD') { return `${c === 'EUR' ? '€' : '$'}${p}`; }
function formatNumber(n) { return n.toLocaleString('en-US'); }

function joinOxford(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// ========================================
// INSIGHTS LIBRARY (Colosseum v3)
// ========================================
const INSIGHTS = [

  // ========= TIER 1 — SUPERLATIVOS =========

  { id: 'coverage_unique_premium', weight: 9, isStrongSuperlative: true,
    condition: (t, ta) => {
      if (!ta.uniqueCombo) return false;
      const hasNonCitable = ta.uniqueCombo.combo.some(f => NON_CITABLE_FEATURES.has(f));
      if (hasNonCitable) return false;
      const PREMIUM = new Set(['arena_floor', 'underground', 'palatine_hill', 'vatican', 'attic', 'pantheon']);
      return ta.uniqueCombo.siblingCount === 0 && ta.uniqueCombo.combo.some(f => PREMIUM.has(f));
    },
    render: (t, ta) => {
      const PREMIUM_ORDER = ['vatican', 'pantheon', 'underground', 'arena_floor', 'palatine_hill', 'attic', 'wheelchair_accessible'];
      const sorted = [...ta.uniqueCombo.combo].sort((a, b) => {
        const ai = PREMIUM_ORDER.indexOf(a);
        const bi = PREMIUM_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      return `The only catalog tour combining ${joinOxford(sorted.map(f => featureLabels[f] || f))}`;
    }
  },

  { id: 'most_reviewed_absolute', weight: 9, isStrongSuperlative: true,
    condition: (t, ta) => ta.reviewCountRankAbsolute === 1 && t.specs.reviewCount >= 1000,
    render: (t) => `The most-reviewed tour in the catalog with ${formatNumber(t.specs.reviewCount)} reviews` },

  { id: 'cheapest_with_premium', weight: 8, isStrongSuperlative: true,
    condition: (t, ta) => {
      const PREMIUM = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
      return ta.isCheapestWith.some(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 5);
    },
    render: (t, ta) => {
      const PREMIUM = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
      const feat = ta.isCheapestWith.find(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 5);
      return `The catalog's most affordable tour with ${featureLabels[feat]}`;
    }
  },

  { id: 'highest_priced_with', weight: 8, isStrongSuperlative: true,
    condition: (t, ta) => {
      const PREMIUM = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
      return ta.isMostExpensiveWith.some(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 8);
    },
    render: (t, ta) => {
      const PREMIUM = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
      const feat = ta.isMostExpensiveWith.find(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 8);
      return `The highest-priced tour in the catalog including ${featureLabels[feat]}`;
    }
  },

  { id: 'shortest_in_subset', weight: 7, isStrongSuperlative: true,
    condition: (t, ta) => {
      const PREMIUM = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
      return ta.isShortestWith.some(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 5);
    },
    render: (t, ta) => {
      const PREMIUM = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
      const feat = ta.isShortestWith.find(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 5);
      const dur = formatDurationHuman(t.specs.duration);
      return dur ? `The shortest catalog tour with ${featureLabels[feat]} at ${dur}` : `The shortest catalog tour with ${featureLabels[feat]}`;
    }
  },

  { id: 'cheapest_absolute', weight: 7, isStrongSuperlative: true,
    condition: (t, ta, an) => an.outliers.cheapest === t.slug && t.specs.price != null,
    render: (t) => `The catalog's lowest-priced option at ${formatPrice(t.specs.price, t.specs.currency)}` },

  // ========= TIER 2 — DESCRIPTIVOS =========

  { id: 'four_level_comprehensive', weight: 8, isStrongSuperlative: false,
    condition: (t, ta) => ta.isFourLevelCoverage,
    render: (t) => {
      const variants = [
        'Comprehensive guided tour covering Colosseum, Roman Forum, Palatine Hill, arena floor and underground access',
        'Full-coverage tour combining Colosseum interior with arena floor, underground, Roman Forum and Palatine Hill',
        'Multi-level guided experience including arena floor, underground hypogeum, Roman Forum and Palatine Hill'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  { id: 'has_underground_premium', weight: 8, isStrongSuperlative: false,
    condition: (t, ta) => {
      const feats = new Set(t.features.combined);
      if (ta.isFourLevelCoverage) return false;
      return feats.has('underground') && (t.specs.price ?? 0) >= 120;
    },
    render: (t) => {
      const variants = [
        'Premium tour with underground access',
        'Underground-access guided experience',
        'Hypogeum-access guided tour'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  { id: 'has_arena_premium', weight: 7, isStrongSuperlative: false,
    condition: (t, ta) => {
      const feats = new Set(t.features.combined);
      if (ta.isFourLevelCoverage) return false;
      return feats.has('arena_floor') && (t.specs.price ?? 0) >= 100 && !feats.has('underground');
    },
    render: (t) => {
      const variants = [
        'Premium tour with arena floor access',
        'Arena-floor guided experience'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  { id: 'vatican_combo', weight: 8, isStrongSuperlative: false,
    condition: (t) => {
      const feats = new Set(t.features.combined);
      return feats.has('vatican');
    },
    render: (t) => {
      const variants = [
        'Combo tour covering the Colosseum and Vatican',
        'Two-monument visit pairing Colosseum and Vatican',
        'Multi-site tour combining Colosseum and Vatican'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  // IMPROVEMENT 2: 4 plantillas para palatine_combo (era 3)
  { id: 'palatine_combo', weight: 7, isStrongSuperlative: false,
    condition: (t, ta) => {
      const feats = new Set(t.features.combined);
      if (ta.isFourLevelCoverage) return false;
      return feats.has('palatine_hill') && !feats.has('vatican');
    },
    render: (t) => {
      const variants = [
        'Combo tour covering Colosseum, Roman Forum, and Palatine Hill',
        'Three-site visit including Palatine Hill',
        'Guided tour spanning Colosseum, Forum, and Palatine',
        'Tour combining Colosseum interior with Roman Forum and Palatine Hill'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  { id: 'private_premium', weight: 7, isStrongSuperlative: false,
    condition: (t) => isPrivateOrExclusive(t),
    render: (t) => {
      const variants = ['Private guided experience', 'Exclusive small-group visit', 'Semi-private guided tour'];
      if (/\bexclusive\b/i.test(t.title || '')) return variants[1];
      if (/semi[-\s]private/i.test(t.title || '')) return variants[2];
      return variants[0];
    }
  },

  { id: 'mamertine_special', weight: 7, isStrongSuperlative: false,
    condition: (t) => isMamertineTour(t),
    render: () => 'Special-access tour including Mamertine Prison and Ludus Magnus gladiator school' },

  { id: 'night_atmosphere', weight: 6, isStrongSuperlative: false,
    condition: (t, ta) => isNightTour(t, ta),
    render: () => 'Evening visit when the Colosseum is illuminated and crowds are smaller' },

  { id: 'gladiator_focus', weight: 6, isStrongSuperlative: false,
    condition: (t, ta) => isGladiatorThemed(t, ta),
    render: () => 'Tour centered on gladiator history and combat traditions' },

  { id: 'audio_only', weight: 5, isStrongSuperlative: false,
    condition: (t) => isAudioOnlyTour(t),
    render: () => 'Self-guided tour with downloadable audio app' },

  { id: 'extended_full_day', weight: 5, isStrongSuperlative: false,
    condition: (t, ta) => ta.categories.includes('full_day'),
    render: (t) => {
      const variants = [
        'Full-day format covering multiple Roman sites',
        'Extended full-day visit across central Rome',
        'Day-long itinerary spanning multiple monuments'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  { id: 'express_format', weight: 5, isStrongSuperlative: false,
    condition: (t) => isExpressFormat(t),
    render: () => 'Express guided visit with priority entry' },

  { id: 'wheelchair_supportive', weight: 4, isStrongSuperlative: false,
    condition: (t, ta) => {
      if (!ta.categories.includes('wheelchair_friendly')) return false;
      if (ta.categories.includes('premium_priced')) return false;
      return true;
    },
    render: () => 'Wheelchair-accessible guided visit' }
];

// ========================================
// TRADE-OFFS (Colosseum v3 — con rotación)
// ========================================
const TRADEOFFS = [

  { id: 'no_live_guide', priority: 10,
    condition: (t) => isAudioOnlyTour(t),
    render: () => 'without paying for a live guide' },

  { id: 'underground_no_arena', priority: 9,
    condition: (t) => {
      const feats = new Set(t.features.combined);
      if (!feats.has('underground')) return false;
      if ((t.specs.price ?? 0) < 120) return false;
      return !feats.has('arena_floor');
    },
    render: () => 'but without arena floor access' },

  { id: 'arena_no_underground', priority: 9,
    condition: (t) => {
      const feats = new Set(t.features.combined);
      if (!feats.has('arena_floor')) return false;
      if ((t.specs.price ?? 0) < 100) return false;
      return !feats.has('underground');
    },
    render: () => 'but without underground access' },

  // IMPROVEMENT 1: breadth_for_depth con 4 variantes rotantes
  { id: 'breadth_for_depth', priority: 8,
    condition: (t, ta) => ta.categories.includes('multi_site'),
    render: (t) => {
      const variants = [
        'trading deeper Colosseum exploration for broader Rome coverage',
        'covering more Roman sites instead of focusing exclusively on the Colosseum',
        'spanning multiple Roman landmarks rather than diving deep into one',
        'broadening the Roman experience at the expense of single-site depth'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  { id: 'depth_for_breadth', priority: 7,
    condition: (t, ta) => {
      if (!ta.categories.includes('single_site')) return false;
      const INTRA = new Set(['arena_floor', 'underground', 'attic']);
      const intraCount = t.features.combined.filter(f => INTRA.has(f)).length;
      return intraCount >= 2;
    },
    render: () => 'prioritizing comprehensive Colosseum coverage over external Rome sites' },

  { id: 'missing_deep_access', priority: 5,
    condition: (t, ta) => {
      if (!ta.categories.includes('single_site')) return false;
      if (isAudioOnlyTour(t)) return false;
      if (ta.categories.includes('premium_priced')) return false;
      const feats = new Set(t.features.combined);
      return !feats.has('arena_floor') && !feats.has('underground');
    },
    render: () => 'but without arena floor or underground access' }
];

// ========================================
// COMPOSITOR
// ========================================
function compose(tour, tourAnal) {
  const matched = INSIGHTS.filter(i => i.condition(tour, tourAnal, analysis)).sort((a, b) => b.weight - a.weight);
  const matchedTradeoffs = TRADEOFFS.filter(t => t.condition(tour, tourAnal, analysis)).sort((a, b) => b.priority - a.priority);

  const anchorA = matched.find(i => i.isStrongSuperlative);
  const anchorB = matched.find(i => !i.isStrongSuperlative);
  let structure, anchor;
  if (anchorA) { structure = 'A'; anchor = anchorA; }
  else if (anchorB) { structure = 'B'; anchor = anchorB; }
  else { structure = 'B-fallback'; anchor = null; }

  const tradeoff = matchedTradeoffs[0];
  const anchorClause = anchor ? anchor.render(tour, tourAnal, analysis) : composeFallbackAnchor(tour, tourAnal);
  const datos = composeDataClause(tour, anchor, anchorClause);
  const tradeoffClause = tradeoff ? tradeoff.render(tour, tourAnal, analysis) : null;

  let phrase = anchorClause;
  if (datos) phrase += ` ${datos}`;
  if (tradeoffClause) phrase += `, ${tradeoffClause}`;
  phrase += '.';
  phrase = phrase.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/\.+$/, '.').trim();

  return {
    phrase, structure,
    anchorChosen: anchor?.id || '(fallback)',
    tradeoffChosen: tradeoff?.id || '(none)',
    wordCount: phrase.split(/\s+/).length,
    charCount: phrase.length
  };
}

function composeFallbackAnchor(t, ta) {
  const parts = [];
  if (ta.categories.includes('budget_priced')) parts.push('Lower-priced');
  else if (ta.categories.includes('premium_priced')) parts.push('Higher-priced');
  else parts.push('Mid-range');
  parts.push(ta.categories.includes('multi_site') ? 'multi-site' : 'single-site');
  if (ta.categories.includes('full_day')) parts.push('full-day');
  else if (ta.categories.includes('extended_format')) parts.push('extended-format');
  else if (ta.categories.includes('short_format')) parts.push('short-format');

  const nounVariants = ['guided visit', 'Colosseum visit', 'amphitheater visit', 'standard guided tour'];
  parts.push(nounVariants[hashSlug(t.slug) % nounVariants.length]);

  return parts.join(' ');
}

function composeDataClause(t, anchor, anchorText) {
  const dur = formatDurationHuman(t.specs.duration);
  const price = t.specs.price != null ? formatPrice(t.specs.price, t.specs.currency) : null;
  if (!dur && !price) return '';
  const anchorMentionsDuration = /\d+(?:\.\d+)?\s*(minute|hour)/i.test(anchorText);
  const anchorMentionsPrice = /\$|€/.test(anchorText);
  const parts = [];
  if (dur && !anchorMentionsDuration) parts.push(`in ${dur}`);
  if (price && !anchorMentionsPrice) parts.push(`at ${price}`);
  return parts.join(' ');
}

// ========================================
// PROCESS ALL TOURS
// ========================================
const results = [];
let skippedCount = 0;

for (const tour of corpus.tours) {
  if (!tour.slug || !tour.title || tour.title.trim().length < 3) {
    skippedCount++;
    continue;
  }

  const tourAnal = analysis.tourAnalysis[tour.slug];
  if (!tourAnal) {
    skippedCount++;
    continue;
  }

  try {
    const r = compose(tour, tourAnal);
    results.push({ slug: tour.slug, title: tour.title, price: tour.specs.price, duration: tour.specs.duration?.raw || '(none)', ...r });
  } catch (err) {
    console.error(`❌ Error en ${tour.slug}:`, err.message);
    skippedCount++;
  }
}

if (skippedCount > 0) {
  console.log(`⚠️  Skipped ${skippedCount} tours (sin slug/título válido o sin análisis)\n`);
}

// ========================================
// STATS
// ========================================
const stats = {
  total: results.length,
  byStructure: { A: 0, B: 0, 'B-fallback': 0 },
  anchorUsage: {},
  tradeoffUsage: {},
  wordCounts: results.map(r => r.wordCount)
};

for (const r of results) {
  stats.byStructure[r.structure]++;
  stats.anchorUsage[r.anchorChosen] = (stats.anchorUsage[r.anchorChosen] || 0) + 1;
  stats.tradeoffUsage[r.tradeoffChosen] = (stats.tradeoffUsage[r.tradeoffChosen] || 0) + 1;
}

const avgWords = (stats.wordCounts.reduce((a, b) => a + b, 0) / stats.wordCounts.length).toFixed(1);
const minWords = Math.min(...stats.wordCounts);
const maxWords = Math.max(...stats.wordCounts);

// ========================================
// REPORT
// ========================================
let report = '';
report += '╔════════════════════════════════════════════════════════════════════╗\n';
report += '║          BULK CITABLE PHRASE REPORT — Colosseum v3                 ║\n';
report += `║          Generated: ${new Date().toISOString()}            ║\n`;
report += '╚════════════════════════════════════════════════════════════════════╝\n\n';

report += '📊 STATS\n';
report += '─────────────────────────────────────────────────────────────────────\n';
report += `Total tours:                 ${stats.total}\n`;
report += `Skipped (data issues):       ${skippedCount}\n`;
report += `Structure A (superlative):   ${stats.byStructure.A}\n`;
report += `Structure B (descriptive):   ${stats.byStructure.B}\n`;
report += `Structure B-fallback:        ${stats.byStructure['B-fallback']}\n`;
report += `Word count:                  ${minWords}–${maxWords} (avg ${avgWords})\n\n`;

report += '🎯 ANCHOR USAGE\n';
report += '─────────────────────────────────────────────────────────────────────\n';
const sortedAnchors = Object.entries(stats.anchorUsage).sort((a, b) => b[1] - a[1]);
for (const [a, c] of sortedAnchors) report += `${a.padEnd(30)} ${c} tours\n`;
report += '\n';

report += '🔄 TRADE-OFF USAGE\n';
report += '─────────────────────────────────────────────────────────────────────\n';
const sortedTradeoffs = Object.entries(stats.tradeoffUsage).sort((a, b) => b[1] - a[1]);
for (const [t, c] of sortedTradeoffs) report += `${t.padEnd(30)} ${c} tours\n`;
report += '\n';

const byStruct = { A: [], B: [], 'B-fallback': [] };
for (const r of results) byStruct[r.structure].push(r);

report += '═════════════════════════════════════════════════════════════════════\n';
report += `STRUCTURE A — ${byStruct.A.length} TOURS (with superlative)\n`;
report += '═════════════════════════════════════════════════════════════════════\n\n';
for (const r of byStruct.A) {
  report += `▸ ${r.title}\n  ${r.slug}\n  $${r.price} | ${r.duration} | anchor=${r.anchorChosen} | tradeoff=${r.tradeoffChosen}\n  ► "${r.phrase}"\n\n`;
}

report += '═════════════════════════════════════════════════════════════════════\n';
report += `STRUCTURE B — ${byStruct.B.length} TOURS (descriptive, no superlative)\n`;
report += '═════════════════════════════════════════════════════════════════════\n\n';
for (const r of byStruct.B) {
  report += `▸ ${r.title}\n  ${r.slug}\n  $${r.price} | ${r.duration} | anchor=${r.anchorChosen} | tradeoff=${r.tradeoffChosen}\n  ► "${r.phrase}"\n\n`;
}

report += '═════════════════════════════════════════════════════════════════════\n';
report += `STRUCTURE B-FALLBACK — ${byStruct['B-fallback'].length} TOURS (generic descriptive)\n`;
report += '═════════════════════════════════════════════════════════════════════\n\n';
for (const r of byStruct['B-fallback']) {
  report += `▸ ${r.title}\n  ${r.slug}\n  $${r.price} | ${r.duration} | tradeoff=${r.tradeoffChosen}\n  ► "${r.phrase}"\n\n`;
}

writeFileSync('.cache/bulk-report.txt', report);

console.log('📊 SUMMARY');
console.log(`   Total tours:    ${stats.total}`);
console.log(`   Skipped:        ${skippedCount}`);
console.log(`   Structure A:    ${stats.byStructure.A}`);
console.log(`   Structure B:    ${stats.byStructure.B}`);
console.log(`   B-fallback:     ${stats.byStructure['B-fallback']}`);
console.log(`   Word count:     ${minWords}–${maxWords} (avg ${avgWords})\n`);

console.log('🎯 ANCHOR USAGE');
sortedAnchors.forEach(([a, c]) => console.log(`   ${a.padEnd(30)} ${c}`));
console.log('');

console.log('🔄 TRADE-OFF USAGE');
sortedTradeoffs.forEach(([t, c]) => console.log(`   ${t.padEnd(30)} ${c}`));
console.log('');

console.log(`✅ Report saved to .cache/bulk-report.txt\n`);
