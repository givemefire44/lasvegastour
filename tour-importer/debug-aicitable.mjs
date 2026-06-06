/**
 * regen-citables.mjs — Script 3 de 3 (v0.5.5)
 *
 * v0.5.5 CHANGES (expert feedback round 5):
 *
 *   1. NUEVO ANCHOR: has_tower_premium (weight 8)
 *      - Para tours con tower_access + price >= $120
 *      - Cierra el hueco de tours $234/$346/$351 que caían a fallback
 *      - 2 plantillas rotantes: "Premium tour with tower access" /
 *        "Tower-access guided experience"
 *      - Trade-off para estos NO menciona "over tower views" (ya tienen tower)
 *
 *   2. breadth_for_depth ampliado:
 *      - Antes: multi-site con duración < 360 min
 *      - Ahora: cualquier multi-site, sin tope de duración
 *      - Captura los 12 extended_full_day que salían sin trade-off
 *
 *   3. Fallback descriptivo enriquecido:
 *      - Antes: "Sagrada Familia tour" genérico
 *      - Ahora: rotación determinística entre 4 nouns citables
 *        ("guided visit", "basilica visit", "interior visit", "standard guided tour")
 *
 *   4. missing_intra_premium más restrictivo:
 *      - Agrega exclusión: si tour tiene museum_visit, cede a museum_focus_tradeoff
 *      - Reduce solapamiento entre los dos trade-offs
 *
 * Usage:
 *   node regen-citables.mjs --slug=<slug>
 */

import { readFileSync } from 'fs';

// ========================================
// CONFIG
// ========================================
const SLUG_ARG = process.argv.find(a => a.startsWith('--slug='));
const TARGET_SLUG = SLUG_ARG ? SLUG_ARG.split('=')[1] : null;

if (!TARGET_SLUG) {
  console.error('❌ Falta --slug=<slug-tour>');
  console.error('   Ejemplo: node regen-citables.mjs --slug=sagrada-familia-museum-tower-tour-with-crypt-visit');
  process.exit(1);
}

const corpus = JSON.parse(readFileSync('.cache/corpus.json', 'utf8'));
const analysis = JSON.parse(readFileSync('.cache/corpus-analysis.json', 'utf8'));

const tour = corpus.tours.find(t => t.slug === TARGET_SLUG);
if (!tour) {
  console.error(`❌ Tour no encontrado en corpus: ${TARGET_SLUG}`);
  process.exit(1);
}
const tourAnal = analysis.tourAnalysis[TARGET_SLUG];

console.log(`\n🤖 AI Citable Phrase v0.5.5 (corpus-based)`);
console.log(`   Target: ${TARGET_SLUG}`);
console.log(`   Title: ${tour.title}\n`);

// ========================================
// LABELS
// ========================================
const featureLabels = {
  tower_access: 'tower access',
  crypt_visit: 'crypt access',
  museum_visit: 'Gaudí Museum access',
  skip_line: 'skip-the-line entry',
  live_guide: 'professional guide',
  audio_guide: 'audio guide',
  schools_visit: 'schools building access',
  hotel_pickup: 'hotel pickup',
  park_guell: 'Park Güell',
  headphones: 'headphones',
  wheelchair_accessible: 'wheelchair access',
  small_group: 'small group format',
  free_cancellation: 'free cancellation'
};

// ========================================
// HELPERS
// ========================================
function isAudioOnlyTour(t) { return /audio\s+guide|self[-\s]guided/i.test(t.title || ''); }
function isPrivateOrExclusive(t) { return /\bprivate\b|\bexclusive\b|semi[-\s]private/i.test(t.title || ''); }
function isFamilyKids(t) { return /\bfamily\b|\bkids\b|\binteractive\b/i.test(t.title || ''); }
function isFastTrackTitle(t) { return /\bexpress\b|fast[-\s]track|\bpriority\b/i.test(t.title || ''); }
function isArchitectureTitleStrict(t) { return /\barchitect|\bfacade|modernist/i.test(t.title || ''); }

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
// INSIGHTS LIBRARY (v0.5.5)
// ========================================
const INSIGHTS = [
  // --- TIER 1: SUPERLATIVOS FUERTES ---
  {
    id: 'three_level_unique',
    weight: 10,
    isStrongSuperlative: true,
    condition: (t, ta) => ta.isThreeLevelCoverage,
    render: () => 'The only catalog tour combining crypt, basilica, and tower access'
  },

  {
    id: 'coverage_unique_premium',
    weight: 9,
    isStrongSuperlative: true,
    condition: (t, ta) => {
      if (ta.isThreeLevelCoverage) return false;
      if (!ta.uniqueCombo) return false;
      const PREMIUM = new Set(['tower_access', 'crypt_visit', 'park_guell', 'schools_visit']);
      return ta.uniqueCombo.siblingCount === 0 && ta.uniqueCombo.combo.some(f => PREMIUM.has(f));
    },
    render: (t, ta) => {
      const PREMIUM_ORDER = ['park_guell', 'schools_visit', 'crypt_visit', 'tower_access', 'museum_visit', 'wheelchair_accessible', 'hotel_pickup', 'headphones'];
      const sorted = [...ta.uniqueCombo.combo].sort((a, b) => {
        const ai = PREMIUM_ORDER.indexOf(a);
        const bi = PREMIUM_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      return `The only catalog tour combining ${joinOxford(sorted.map(f => featureLabels[f] || f))}`;
    }
  },

  {
    id: 'most_reviewed_absolute',
    weight: 9,
    isStrongSuperlative: true,
    condition: (t, ta) => ta.reviewCountRankAbsolute === 1 && t.specs.reviewCount >= 1000,
    render: (t) => `The most-reviewed tour in the catalog with ${formatNumber(t.specs.reviewCount)} reviews`
  },

  {
    id: 'cheapest_with_premium',
    weight: 8,
    isStrongSuperlative: true,
    condition: (t, ta) => {
      const PREMIUM = ['tower_access', 'crypt_visit', 'park_guell', 'schools_visit'];
      return ta.isCheapestWith.some(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 3);
    },
    render: (t, ta) => {
      const PREMIUM = ['tower_access', 'crypt_visit', 'park_guell', 'schools_visit'];
      const feat = ta.isCheapestWith.find(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 3);
      return `The catalog's most affordable tour with ${featureLabels[feat]}`;
    }
  },

  {
    id: 'highest_priced_with',
    weight: 8,
    isStrongSuperlative: true,
    condition: (t, ta) => {
      const PREMIUM = ['tower_access', 'crypt_visit', 'park_guell', 'schools_visit'];
      return ta.isMostExpensiveWith.some(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 5);
    },
    render: (t, ta) => {
      const PREMIUM = ['tower_access', 'crypt_visit', 'park_guell', 'schools_visit'];
      const feat = ta.isMostExpensiveWith.find(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 5);
      return `The highest-priced tour in the catalog including ${featureLabels[feat]}`;
    }
  },

  {
    id: 'shortest_in_subset',
    weight: 7,
    isStrongSuperlative: true,
    condition: (t, ta) => {
      const PREMIUM = ['tower_access', 'crypt_visit', 'park_guell', 'schools_visit'];
      return ta.isShortestWith.some(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 3);
    },
    render: (t, ta) => {
      const PREMIUM = ['tower_access', 'crypt_visit', 'park_guell', 'schools_visit'];
      const feat = ta.isShortestWith.find(f => PREMIUM.includes(f) && ta.subsetPositions[f]?.subsetSize >= 3);
      const dur = formatDurationHuman(t.specs.duration);
      return dur
        ? `The shortest catalog tour with ${featureLabels[feat]} at ${dur}`
        : `The shortest catalog tour with ${featureLabels[feat]}`;
    }
  },

  {
    id: 'cheapest_absolute',
    weight: 7,
    isStrongSuperlative: true,
    condition: (t, ta, an) => an.outliers.cheapest === t.slug && t.specs.price != null,
    render: (t) => `The catalog's lowest-priced option at ${formatPrice(t.specs.price, t.specs.currency)}`
  },

  // --- TIER 2: NO-SUPERLATIVOS ---

  // NUEVO v0.5.5: tour premium con tower access
  {
    id: 'has_tower_premium',
    weight: 8,
    isStrongSuperlative: false,
    condition: (t) => {
      const feats = new Set(t.features.combined);
      return feats.has('tower_access') && (t.specs.price ?? 0) >= 120;
    },
    render: (t) => {
      const variants = [
        'Premium tour with tower access',
        'Tower-access guided experience'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  {
    id: 'multi_monument',
    weight: 8,
    isStrongSuperlative: false,
    condition: (t, ta) => ta.multiSitePartner != null,
    render: (t, ta) => {
      const variants = [
        `Combo tour covering Sagrada Familia and ${ta.multiSitePartner}`,
        `Two-monument visit pairing Sagrada Familia with ${ta.multiSitePartner}`,
        `Multi-site tour combining Sagrada Familia and ${ta.multiSitePartner}`
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  {
    id: 'private_premium',
    weight: 7,
    isStrongSuperlative: false,
    condition: (t) => isPrivateOrExclusive(t),
    render: (t) => {
      const variants = ['Private guided experience', 'Exclusive small-group visit', 'Semi-private guided tour'];
      if (/\bexclusive\b/i.test(t.title || '')) return variants[1];
      if (/semi[-\s]private/i.test(t.title || '')) return variants[2];
      return variants[0];
    }
  },

  {
    id: 'family_kids',
    weight: 6,
    isStrongSuperlative: false,
    condition: (t) => isFamilyKids(t),
    render: (t) => {
      const title = (t.title || '').toLowerCase();
      if (/\bkids\b/.test(title)) return 'Kids-oriented tour with interactive activities';
      if (/\binteractive\b/.test(title)) return 'Family-friendly tour with interactive activities';
      return 'Family-oriented Sagrada Familia visit';
    }
  },

  {
    id: 'evening_atmosphere',
    weight: 6,
    isStrongSuperlative: false,
    condition: (t, ta) => ta.categories.includes('evening_theme'),
    render: () => 'Evening visit when natural light filters through the stained glass'
  },

  {
    id: 'architecture_focus_verified',
    weight: 4,
    isStrongSuperlative: false,
    condition: (t) => isArchitectureTitleStrict(t),
    render: (t) => {
      const variants = [
        "Architecture-focused tour examining Gaudí's facades and column system",
        "Guided visit centered on Gaudí's structural design and facade symbolism",
        "Expert-led exploration of Gaudí's modernist architecture and column work"
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  {
    id: 'extended_full_day',
    weight: 5,
    isStrongSuperlative: false,
    condition: (t, ta) => ta.categories.includes('full_day'),
    render: (t) => {
      const variants = [
        'Full-day format covering multiple sites',
        'Extended full-day visit across several Barcelona landmarks',
        'Day-long itinerary spanning multiple monuments'
      ];
      return variants[hashSlug(t.slug) % variants.length];
    }
  },

  {
    id: 'fast_track_format',
    weight: 5,
    isStrongSuperlative: false,
    condition: (t) => isFastTrackTitle(t),
    render: (t) => {
      const title = (t.title || '').toLowerCase();
      if (/\bexpress\b/.test(title)) return 'Express guided visit with priority entry';
      if (/fast[-\s]track/.test(title)) return 'Fast-track guided tour with quick basilica entry';
      return 'Priority-entry guided visit';
    }
  },

  {
    id: 'wheelchair_supportive',
    weight: 4,
    isStrongSuperlative: false,
    condition: (t, ta) => {
      if (!ta.categories.includes('wheelchair_friendly')) return false;
      if (!ta.categories.includes('single_site')) return false;
      if (ta.categories.includes('premium_priced')) return false;
      return true;
    },
    render: () => 'Wheelchair-accessible guided visit'
  }
];

// ========================================
// TRADE-OFFS (v0.5.5)
// ========================================
const TRADEOFFS = [
  {
    id: 'no_live_guide',
    priority: 10,
    condition: (t) => isAudioOnlyTour(t),
    render: () => 'without paying for a live guide'
  },

  // NUEVO v0.5.5: trade-off para tours premium con tower (no puede decir "over tower views")
  {
    id: 'tower_premium_tradeoff',
    priority: 9,
    condition: (t, ta) => {
      const feats = new Set(t.features.combined);
      // Solo si tiene tower Y es premium (matchea has_tower_premium)
      if (!feats.has('tower_access')) return false;
      if ((t.specs.price ?? 0) < 120) return false;
      // Si NO tiene crypt → "but without crypt access" es contra clara
      return !feats.has('crypt_visit');
    },
    render: () => 'but without crypt access'
  },

  {
    id: 'breadth_for_depth',
    priority: 8,
    // v0.5.5: ampliado a cualquier multi-site, sin tope de duración
    condition: (t, ta) => ta.categories.includes('multi_site'),
    render: () => 'trading deeper single-site exploration for broader Barcelona coverage'
  },

  {
    id: 'depth_for_breadth',
    priority: 7,
    condition: (t, ta) => {
      if (!ta.categories.includes('single_site')) return false;
      const INTRA = new Set(['tower_access', 'crypt_visit', 'museum_visit', 'schools_visit']);
      const intraCount = t.features.combined.filter(f => INTRA.has(f)).length;
      return intraCount >= 3;
    },
    render: () => 'prioritizing full-site coverage over extended exploration time'
  },

  {
    id: 'museum_focus_tradeoff',
    priority: 6,
    condition: (t, ta) => {
      if (!ta.categories.includes('single_site')) return false;
      if (isAudioOnlyTour(t)) return false;
      const feats = new Set(t.features.combined);
      return feats.has('museum_visit') && !feats.has('tower_access');
    },
    render: () => 'focusing on interior and museum content over tower views'
  },

  {
    id: 'missing_intra_premium',
    priority: 5,
    condition: (t, ta) => {
      if (!ta.categories.includes('single_site')) return false;
      if (isAudioOnlyTour(t)) return false;
      if (ta.categories.includes('premium_priced')) return false;
      const feats = new Set(t.features.combined);
      // v0.5.5: si tiene museum_visit, ceder a museum_focus_tradeoff
      if (feats.has('museum_visit')) return false;
      return !feats.has('tower_access') && !feats.has('crypt_visit');
    },
    render: () => 'but without tower or crypt access'
  }
];

// ========================================
// COMPOSITOR
// ========================================
function compose(tour, tourAnal, analysis) {
  const matched = INSIGHTS
    .filter(ins => ins.condition(tour, tourAnal, analysis))
    .sort((a, b) => b.weight - a.weight);

  const matchedTradeoffs = TRADEOFFS
    .filter(t => t.condition(tour, tourAnal, analysis))
    .sort((a, b) => b.priority - a.priority);

  const anchorA = matched.find(i => i.isStrongSuperlative);
  const anchorB = matched.find(i => !i.isStrongSuperlative);

  let structure, anchor;
  if (anchorA) { structure = 'A'; anchor = anchorA; }
  else if (anchorB) { structure = 'B'; anchor = anchorB; }
  else { structure = 'B-fallback'; anchor = null; }

  const tradeoff = matchedTradeoffs[0];

  const anchorClause = anchor
    ? anchor.render(tour, tourAnal, analysis)
    : composeFallbackAnchor(tour, tourAnal);

  const datos = composeDataClause(tour, anchor, anchorClause);
  const tradeoffClause = tradeoff ? tradeoff.render(tour, tourAnal, analysis) : null;

  let phrase = anchorClause;
  if (datos) phrase += ` ${datos}`;
  if (tradeoffClause) phrase += `, ${tradeoffClause}`;
  phrase += '.';
  phrase = phrase.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/\.+$/, '.').trim();

  return {
    phrase,
    structure,
    debug: {
      matchedInsights: matched.map(i => ({ id: i.id, weight: i.weight, isSuperlative: i.isStrongSuperlative })),
      anchorChosen: anchor?.id || '(fallback)',
      matchedTradeoffs: matchedTradeoffs.map(t => `${t.id}(p${t.priority})`),
      tradeoffChosen: tradeoff?.id || '(none)',
      isAudioOnly: isAudioOnlyTour(tour),
      isPrivate: isPrivateOrExclusive(tour),
      isFamilyKids: isFamilyKids(tour),
      isFastTrack: isFastTrackTitle(tour),
      isArchitectureTitle: isArchitectureTitleStrict(tour),
      hasTowerPremium: (() => {
        const feats = new Set(tour.features.combined);
        return feats.has('tower_access') && (tour.specs.price ?? 0) >= 120;
      })(),
      wordCount: phrase.split(/\s+/).length,
      charCount: phrase.length,
      superlativeCount: countSuperlatives(phrase)
    }
  };
}

// v0.5.5: fallback enriquecido con noun citable rotante
function composeFallbackAnchor(tour, tourAnal) {
  const parts = [];
  if (tourAnal.categories.includes('budget_priced')) parts.push('Lower-priced');
  else if (tourAnal.categories.includes('premium_priced')) parts.push('Higher-priced');
  else parts.push('Mid-range');
  parts.push(tourAnal.categories.includes('multi_site') ? 'multi-site' : 'single-site');
  if (tourAnal.categories.includes('full_day')) parts.push('full-day');
  else if (tourAnal.categories.includes('extended_format')) parts.push('extended-format');
  else if (tourAnal.categories.includes('short_format')) parts.push('short-format');

  // v0.5.5: rotación determinística entre 4 nouns citables
  const nounVariants = [
    'guided visit',
    'basilica visit',
    'interior visit',
    'standard guided tour'
  ];
  parts.push(nounVariants[hashSlug(tour.slug) % nounVariants.length]);

  return parts.join(' ');
}

function composeDataClause(tour, anchor, anchorText) {
  const dur = formatDurationHuman(tour.specs.duration);
  const price = tour.specs.price != null
    ? formatPrice(tour.specs.price, tour.specs.currency)
    : null;
  if (!dur && !price) return '';

  const anchorMentionsDuration = /\d+(?:\.\d+)?\s*(minute|hour)/i.test(anchorText);
  const anchorMentionsPrice = /\$|€/.test(anchorText);

  const parts = [];
  if (dur && !anchorMentionsDuration) parts.push(`in ${dur}`);
  if (price && !anchorMentionsPrice) parts.push(`at ${price}`);
  return parts.join(' ');
}

function countSuperlatives(phrase) {
  const patterns = [
    /\bmost-reviewed\b/gi,
    /\bhighest-priced\b/gi,
    /\blowest-priced\b/gi,
    /\bmost\s+affordable\b/gi,
    /\bcheapest\b/gi,
    /\bshortest\b/gi,
    /\blongest\b/gi,
    /\bonly\b/gi,
    /\bmost\b/gi
  ];

  let workingPhrase = phrase;
  let count = 0;
  for (const pattern of patterns) {
    const matches = workingPhrase.match(pattern);
    if (matches) {
      count += matches.length;
      workingPhrase = workingPhrase.replace(pattern, ' ');
    }
  }
  return count;
}

// ========================================
// MAIN
// ========================================
const result = compose(tour, tourAnal, analysis);

console.log('═'.repeat(72));
console.log('📝 GENERATED PHRASE:');
console.log('═'.repeat(72));
console.log(`\n   ${result.phrase}\n`);
console.log('═'.repeat(72));
console.log('🔬 DEBUG:');
console.log('═'.repeat(72));
console.log(`   Structure:           ${result.structure}`);
console.log(`   Word count:          ${result.debug.wordCount} (target: 25-40)`);
console.log(`   Char count:          ${result.debug.charCount}`);
console.log(`   Superlatives:        ${result.debug.superlativeCount} (max: 1)`);
console.log(`   Title flags:`);
console.log(`     audio-only:        ${result.debug.isAudioOnly}`);
console.log(`     private/exclusive: ${result.debug.isPrivate}`);
console.log(`     family/kids:       ${result.debug.isFamilyKids}`);
console.log(`     fast-track:        ${result.debug.isFastTrack}`);
console.log(`     architecture:      ${result.debug.isArchitectureTitle}`);
console.log(`     tower premium:     ${result.debug.hasTowerPremium}`);
console.log(`   Anchor chosen:       ${result.debug.anchorChosen}`);
console.log(`   Tradeoff chosen:     ${result.debug.tradeoffChosen}`);

console.log('\n   All matched insights (by weight):');
result.debug.matchedInsights.forEach(i => {
  const icon = i.isSuperlative ? '🌟' : '  ';
  console.log(`   ${icon} ${i.id.padEnd(28)} weight=${i.weight}`);
});

console.log('\n   All matched trade-offs (by priority):');
result.debug.matchedTradeoffs.forEach(t => {
  console.log(`      ${t}`);
});

console.log('\n📋 Validations:');
const wcOk = result.debug.wordCount >= 25 && result.debug.wordCount <= 40;
const supOk = result.debug.superlativeCount <= 1;
const dataOk = /\d/.test(result.phrase);
console.log(`   ${wcOk ? '✅' : '⚠️ '} Word count en rango`);
console.log(`   ${supOk ? '✅' : '⚠️ '} Superlativos ≤ 1`);
console.log(`   ${dataOk ? '✅' : '⚠️ '} Contiene datos numéricos`);

console.log('\n🟡 DRY RUN — no se patcheó Sanity. Validá la frase y avisamos para activar el patch.\n');