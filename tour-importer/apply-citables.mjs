/**
 * apply-citables.mjs — Motor v4.1 (Colosseum)
 *
 * Patchea Sanity con frases citables generadas por el motor de TENSIONES.
 *
 * v4.1 changes:
 *   - DETECTOR 6 nuevo: premium_with_rare_stack
 *     Cubre tours premium-priced con 3+ rare claims pero sin unique_combo
 *
 * Flags:
 *   --slug=<slug>   Procesa solo ese tour
 *   --all           Procesa todos los tours
 *   --dry           No escribe a Sanity (dry-run)
 *   --yes           No pide confirmación interactiva
 */

import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@sanity/client';
import readline from 'readline';

function getEnv(key) { return process.env[key]; }

try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { }

const PROJECT_ID = getEnv('SANITY_PROJECT_ID');
const DATASET = getEnv('SANITY_DATASET') || 'production';
const TOKEN = getEnv('SANITY_TOKEN');

if (!PROJECT_ID || !TOKEN) {
  console.error('❌ Faltan SANITY_PROJECT_ID o SANITY_TOKEN');
  process.exit(1);
}

const args = process.argv.slice(2);
const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];
const allFlag = args.includes('--all');
const dryFlag = args.includes('--dry');
const yesFlag = args.includes('--yes');

if (!slugArg && !allFlag) {
  console.error('❌ Especificá --slug=<slug> o --all');
  process.exit(1);
}

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token: TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

console.log('\n💾 APPLY CITABLES — Colosseum v4.1 (motor de tensiones)');
console.log(`   Mode:    ${dryFlag ? '🟡 DRY (no escribe)' : '🔴 APPLY (escribe a Sanity)'}`);
console.log(`   Target:  ${allFlag ? 'ALL tours' : `slug=${slugArg}`}\n`);

const corpus = JSON.parse(readFileSync('.cache/corpus.json', 'utf8'));
const analysis = JSON.parse(readFileSync('.cache/corpus-analysis.json', 'utf8'));

// ========================================
// HELPERS
// ========================================
function formatPrice(p, c = 'USD') { return `${c === 'EUR' ? '€' : '$'}${p}`; }
function formatNumber(n) { return n.toLocaleString('en-US'); }
function formatHours(h) { return h % 1 === 0 ? `${Math.round(h)}` : `${h.toFixed(1).replace(/\.0$/, '')}`; }

function formatDurationHuman(d) {
  if (!d?.minutes) return null;
  if (d.isRange) {
    if (d.rangeMax < 120) return `${d.rangeMin}–${d.rangeMax} minutes`;
    return `${formatHours(d.rangeMin / 60)}–${formatHours(d.rangeMax / 60)} hours`;
  }
  if (d.minutes < 120) return `${d.minutes} minutes`;
  return `${formatHours(d.minutes / 60)} hours`;
}

function joinOxford(items) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const claimLabels = {
  food_included:               'food',
  hotel_pickup_included:       'hotel pickup',
  transport_included:          'transport',
  vatican_included:            'Vatican',
  palatine_included:           'Palatine Hill',
  forum_included:              'Forum',
  arena_floor_included:        'arena floor',
  underground_included:        'underground',
  audio_guide_included:        'audio guide',
  headsets_included:           'headsets',
  licensed_guide:              'licensed guide',
  skip_the_line_included:      'skip-the-line',
  small_group_included:        'small group',
  small_group_format:          'small group format',
  private_format:              'private format',
  evening_format:              'evening format',
  evening_recommended:         'evening',
  morning_recommended:         'morning',
  afternoon_recommended:       'afternoon',
  free_cancellation_24h:       '24h free cancellation',
  free_cancellation_available: 'free cancellation',
  walking_tour:                'walking',
  bus_tour:                    'bus',
  electric_vehicle_tour:       'electric vehicle',
  self_guided_format:          'self-guided',
  wheelchair_accessible:       'wheelchair access'
};

const negativeLabels = {
  no_arena_floor:              'arena floor',
  no_underground:              'underground',
  no_palatine:                 'Palatine Hill',
  no_forum:                    'Forum',
  no_food:                     'food',
  no_hotel_pickup:             'hotel pickup',
  no_transport:                'transport',
  no_audio_guide:              'audio guide',
  no_live_guide:               'live guide',
  no_gratuities:               'gratuities',
  not_wheelchair_accessible:   'wheelchair access'
};

function ratioVs(price, target) {
  if (!price || !target) return null;
  return price / target;
}

function pctCatalogHasFeature(featureKey) {
  const fc = analysis.featureCommonness[featureKey];
  if (!fc) return 0;
  return fc.percent;
}

// ========================================
// DETECTORES
// ========================================

function detectOutlierMaxStack(tour, tourAnal, tcAnal) {
  if (!tcAnal) return null;
  if (tourAnal.priceRankAbsolute !== tourAnal.priceTotalCount) return null;

  const stack = [...tcAnal.rareClaims, ...tcAnal.rareInterpretive]
    .filter(c => claimLabels[c.claim])
    .sort((a, b) => b.rarity - a.rarity);

  if (stack.length < 4) return null;

  const median = analysis.globalDistributions.price.p50;
  const ratio = ratioVs(tour.specs.price, median);

  return {
    score: 1000 + tcAnal.citabilityScore,
    pattern: 'outlier_max_stack',
    render: () => {
      const top6 = stack.slice(0, 6).map(c => claimLabels[c.claim]);
      const ratioStr = ratio ? ratio.toFixed(1) : '?';
      return `${formatPrice(tour.specs.price, tour.specs.currency)} — most expensive catalog tour (${ratioStr}x median, ${formatPrice(median, tour.specs.currency)}), combining ${top6.length} rare features: ${joinOxford(top6)}.`;
    }
  };
}

function detectDoubleCheapestWithConcession(tour, tourAnal, tcAnal) {
  if (!tcAnal) return null;

  const PREMIUM_SUBSETS = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
  const cheapestInPremium = (tourAnal.isCheapestWith || []).filter(f =>
    PREMIUM_SUBSETS.includes(f) && tourAnal.subsetPositions[f]?.subsetSize >= 5
  );
  if (cheapestInPremium.length < 2) return null;

  const concessions = (tcAnal.criticalNegatives || []).filter(c => negativeLabels[c.claim]);
  if (concessions.length === 0) return null;

  const topConcession = concessions[0];
  const featureKey = topConcession.claim.replace(/^no_/, '');
  const featureKeyMap = {
    'palatine': 'palatine_hill',
    'forum': 'roman_forum',
    'arena_floor': 'arena_floor',
    'underground': 'underground',
    'audio_guide': 'audio_guide',
    'live_guide': 'live_guide',
    'food': null,
    'hotel_pickup': 'hotel_pickup',
    'transport': null
  };
  const featureForPct = featureKeyMap[featureKey] || null;
  const pctHas = featureForPct ? pctCatalogHasFeature(featureForPct) : null;

  const p25 = analysis.globalDistributions.price.p25;
  const undercutPct = p25 ? Math.round(((p25 - tour.specs.price) / p25) * 100) : null;

  return {
    score: 800 + tcAnal.citabilityScore,
    pattern: 'double_cheapest_concession',
    render: () => {
      const features = cheapestInPremium.map(f => {
        const map = { arena_floor: 'arena floor', underground: 'underground', palatine_hill: 'Palatine', vatican: 'Vatican' };
        return map[f] || f;
      });
      const concessionLabel = negativeLabels[topConcession.claim];

      let phrase = `${formatPrice(tour.specs.price, tour.specs.currency)} — cheapest catalog tour combining ${joinOxford(features)} access`;

      if (undercutPct && undercutPct > 0) {
        phrase += `, undercutting the ${formatPrice(p25, tour.specs.currency)} budget tier (p25) by ${undercutPct}%`;
      }

      if (pctHas) {
        phrase += `, but excluding ${concessionLabel} that ${pctHas}% of catalog covers.`;
      } else {
        phrase += `, but excluding ${concessionLabel}.`;
      }

      return phrase;
    }
  };
}

function detectSubsetExtremoSelfComparison(tour, tourAnal, tcAnal) {
  if (!tcAnal) return null;

  const PREMIUM_SUBSETS = ['arena_floor', 'underground', 'palatine_hill', 'vatican'];
  const shortestIn = (tourAnal.isShortestWith || []).filter(f =>
    PREMIUM_SUBSETS.includes(f) && tourAnal.subsetPositions[f]?.subsetSize >= 5
  );
  if (shortestIn.length === 0) return null;

  const selfComps = tour.extracted?.whatMakesDifferent?.selfComparisons || [];
  const priceRef = selfComps.find(c => c.type === 'price_references' && c.values.length >= 1);
  const unlikeRef = selfComps.find(c => c.type === 'unlike' || c.type === 'compared_to');

  if (!priceRef && !unlikeRef) return null;

  const dur = formatDurationHuman(tour.specs.duration);
  const features = tour.features.combined;
  const featureLabelsList = features
    .filter(f => ['underground', 'arena_floor', 'palatine_hill', 'vatican'].includes(f))
    .map(f => ({ underground: 'underground', arena_floor: 'arena floor', palatine_hill: 'Palatine', vatican: 'Vatican' }[f]))
    .filter(Boolean);

  const externalRefs = priceRef ? priceRef.values.filter(v => !v.includes(String(tour.specs.price))) : [];
  const externalRef = externalRefs[0];

  return {
    score: 700 + tcAnal.citabilityScore,
    pattern: 'subset_extremo_self_comparison',
    render: () => {
      let phrase = formatPrice(tour.specs.price, tour.specs.currency);

      if (tour.claims?.explicit?.includes('evening_format') || tour.claims?.explicit?.includes('evening_recommended')) {
        phrase += ' evening tour';
      } else {
        phrase += ' tour';
      }

      if (featureLabelsList.length > 0) {
        phrase += ` with ${joinOxford(featureLabelsList)} access`;
      }

      if (dur) phrase += ` in ${dur}`;

      const subsetNames = shortestIn.map(f => ({ underground: 'underground', arena_floor: 'arena floor', palatine_hill: 'Palatine', vatican: 'Vatican' }[f]));
      if (subsetNames.length > 1) {
        phrase += ` — shortest in both ${joinOxford(subsetNames)} subsets`;
      } else {
        phrase += ` — shortest in ${subsetNames[0]} subset`;
      }

      if (externalRef) {
        const ratioApprox = (() => {
          const m = externalRef.match(/\$(\d+)(?:[-–]\$?(\d+))?/);
          if (!m) return null;
          const lo = parseInt(m[1], 10);
          const hi = m[2] ? parseInt(m[2], 10) : lo;
          const avg = (lo + hi) / 2;
          return tour.specs.price / avg;
        })();
        if (ratioApprox && ratioApprox > 1.5) {
          phrase += `, but ${ratioApprox.toFixed(1)}x the daytime tier (${externalRef}).`;
        } else {
          phrase += `, but priced higher than the daytime tier (${externalRef}).`;
        }
      } else {
        phrase += '.';
      }

      return phrase;
    }
  };
}

function detectMostReviewedAnchor(tour, tourAnal, tcAnal) {
  if (!tcAnal) return null;
  if (tourAnal.reviewCountRankAbsolute !== 1) return null;
  if (!tour.specs.reviewCount || tour.specs.reviewCount < 100) return null;

  const concessions = (tcAnal.criticalNegatives || []).filter(c => negativeLabels[c.claim]);
  if (concessions.length === 0) return null;

  const topConcession = concessions[0];
  const featureKey = topConcession.claim.replace(/^no_/, '');
  const featureKeyMap = {
    'palatine': 'palatine_hill',
    'forum': 'roman_forum',
    'arena_floor': 'arena_floor',
    'underground': 'underground'
  };
  const featureForPct = featureKeyMap[featureKey] || null;
  const pctHas = featureForPct ? pctCatalogHasFeature(featureForPct) : null;

  const dur = formatDurationHuman(tour.specs.duration);
  const tier = tour.specs.price <= analysis.globalDistributions.price.p25 ? 'budget'
              : tour.specs.price >= analysis.globalDistributions.price.p75 ? 'premium' : 'mid-priced';

  const sitesIncluded = ['palatine_hill', 'roman_forum', 'vatican', 'pantheon'].filter(f =>
    tour.features.combined.includes(f)
  ).length;
  const sitesDesc = sitesIncluded >= 3 ? `${sitesIncluded + 1} sites` : sitesIncluded === 2 ? '3 sites' : 'Colosseum';

  return {
    score: 600 + tcAnal.citabilityScore,
    pattern: 'most_reviewed_anchor',
    render: () => {
      let phrase = `${formatPrice(tour.specs.price, tour.specs.currency)} ${tier} tour with ${formatNumber(tour.specs.reviewCount)} reviews (most-reviewed in ${tourAnal.reviewCountTotalCount}-tour catalog)`;

      if (sitesDesc !== 'Colosseum' && dur) {
        phrase += `, covering ${sitesDesc} in ${dur}`;
      } else if (dur) {
        phrase += `, lasting ${dur}`;
      }

      const concessionLabel = negativeLabels[topConcession.claim];
      if (pctHas) {
        phrase += ` but excluding ${concessionLabel} that ${pctHas}% of catalog includes.`;
      } else {
        phrase += ` but excluding ${concessionLabel}.`;
      }

      return phrase;
    }
  };
}

function detectVsMedianUniqueCombo(tour, tourAnal, tcAnal) {
  if (!tcAnal) return null;

  const p75 = analysis.globalDistributions.price.p75;
  if (!tour.specs.price || tour.specs.price < p75) return null;

  if (!tourAnal.uniqueCombo) return null;
  if (tourAnal.uniqueCombo.siblingCount > 2) return null;

  const rareCount = (tcAnal.rareClaims || []).length + (tcAnal.rareInterpretive || []).length;
  if (rareCount < 2) return null;

  const median = analysis.globalDistributions.price.p50;
  const ratio = ratioVs(tour.specs.price, median);

  const topClaims = [...tcAnal.rareClaims, ...tcAnal.rareInterpretive]
    .filter(c => claimLabels[c.claim])
    .sort((a, b) => b.rarity - a.rarity)
    .slice(0, 3);

  if (topClaims.length < 2) return null;

  let categoryDesc = '';
  if (tourAnal.categories.includes('night_theme')) categoryDesc = 'night-themed';
  else if (tourAnal.categories.includes('private_theme')) categoryDesc = 'private';
  else if (tourAnal.categories.includes('full_day')) categoryDesc = 'full-day';

  return {
    score: 500 + tcAnal.citabilityScore,
    pattern: 'vs_median_unique_combo',
    render: () => {
      const ratioStr = ratio ? ratio.toFixed(1) : '?';
      const claimsList = topClaims.map(c => claimLabels[c.claim]);

      let phrase = `${formatPrice(tour.specs.price, tour.specs.currency)}, ${ratioStr}x catalog median (${formatPrice(median, tour.specs.currency)})`;

      if (categoryDesc) {
        phrase += `, but ${categoryDesc} option`;
      } else {
        phrase += `, but unique catalog option`;
      }

      phrase += ` combining ${joinOxford(claimsList)}.`;

      return phrase;
    }
  };
}

// DETECTOR 6 — premium_with_rare_stack (NUEVO v4.1)
function detectPremiumWithRareStack(tour, tourAnal, tcAnal) {
  if (!tcAnal) return null;

  const p75 = analysis.globalDistributions.price.p75;
  if (!tour.specs.price || tour.specs.price < p75) return null;

  const stack = [...tcAnal.rareClaims, ...tcAnal.rareInterpretive]
    .filter(c => claimLabels[c.claim])
    .sort((a, b) => b.rarity - a.rarity);

  if (stack.length < 3) return null;

  const median = analysis.globalDistributions.price.p50;
  const ratio = ratioVs(tour.specs.price, median);

  let categoryDesc = '';
  if (tourAnal.categories.includes('night_theme')) categoryDesc = 'night-themed';
  else if (tourAnal.categories.includes('private_theme')) categoryDesc = 'private-themed';
  else if (tourAnal.categories.includes('full_day')) categoryDesc = 'full-day';

  return {
    score: 400 + tcAnal.citabilityScore,
    pattern: 'premium_with_rare_stack',
    render: () => {
      const top4 = stack.slice(0, 4).map(c => claimLabels[c.claim]);
      const ratioStr = ratio ? ratio.toFixed(1) : '?';

      let phrase = `${formatPrice(tour.specs.price, tour.specs.currency)}, ${ratioStr}x catalog median (${formatPrice(median, tour.specs.currency)})`;

      if (categoryDesc) {
        phrase += `, ${categoryDesc} tour`;
      }

      phrase += ` combining ${top4.length} rare features: ${joinOxford(top4)}.`;

      return phrase;
    }
  };
}

// ========================================
// MOTOR PRINCIPAL
// ========================================
const DETECTORS = [
  detectOutlierMaxStack,
  detectDoubleCheapestWithConcession,
  detectSubsetExtremoSelfComparison,
  detectMostReviewedAnchor,
  detectVsMedianUniqueCombo,
  detectPremiumWithRareStack
];

const SCORE_THRESHOLD = 100;

function generateCitation(tour, tourAnal, tcAnal) {
  const matches = [];
  for (const detector of DETECTORS) {
    try {
      const r = detector(tour, tourAnal, tcAnal);
      if (r) matches.push(r);
    } catch (err) {
      console.error(`⚠️ Detector ${detector.name} falló para ${tour.slug}: ${err.message}`);
    }
  }

  if (matches.length === 0) return { phrase: null, pattern: 'no_match', score: 0 };

  matches.sort((a, b) => b.score - a.score);
  const winner = matches[0];

  if (winner.score < SCORE_THRESHOLD) return { phrase: null, pattern: 'below_threshold', score: winner.score };

  let phrase;
  try {
    phrase = winner.render();
  } catch (err) {
    return { phrase: null, pattern: 'render_error', score: winner.score, error: err.message };
  }

  phrase = phrase.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/\s+\./g, '.').trim();

  return {
    phrase,
    pattern: winner.pattern,
    score: winner.score,
    matchCount: matches.length
  };
}

// ========================================
// SANITY OPS
// ========================================
async function fetchTourFromSanity(slug) {
  return await sanity.fetch(
    `*[_type == "post" && slug.current == $slug][0]{ _id, "slug": slug.current, aiCitable }`,
    { slug }
  );
}

async function patchTour(docId, phrase, pattern) {
  return await sanity.patch(docId).set({
    aiCitable: { phrase, pattern, generatedAt: new Date().toISOString() }
  }).commit();
}

async function processOne(tour) {
  const slug = tour.slug;

  if (!slug || !tour.title || tour.title.trim().length < 3) {
    return { slug: slug || '(no-slug)', status: 'skipped_invalid' };
  }

  const tourAnal = analysis.tourAnalysis[slug];
  const tcAnal = analysis.tourClaimsAnalysis[slug];
  if (!tourAnal) return { slug, status: 'skipped_no_analysis' };

  const result = generateCitation(tour, tourAnal, tcAnal);
  const { phrase, pattern, score } = result;

  let doc;
  try { doc = await fetchTourFromSanity(slug); }
  catch (err) { return { slug, status: 'error', error: `Sanity fetch failed: ${err.message}` }; }

  if (!doc) return { slug, status: 'not_in_sanity', phrase, pattern };

  const currentPhrase = doc.aiCitable?.phrase || null;
  if (currentPhrase === phrase) {
    return { slug, status: 'unchanged', phrase, pattern };
  }

  if (dryFlag) {
    return { slug, status: 'would_patch', phrase, pattern, score, oldPhrase: currentPhrase };
  }

  try {
    await patchTour(doc._id, phrase, pattern);
    return { slug, status: 'patched', phrase, pattern, score, oldPhrase: currentPhrase };
  } catch (err) {
    return { slug, status: 'error', error: `Sanity patch failed: ${err.message}` };
  }
}

async function confirmAll(count) {
  if (yesFlag) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\n⚠️  Vas a patchear ${count} tours en Sanity. ¿Continuar? (yes/N): `, ans => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'yes');
    });
  });
}

async function main() {
  let toursToProcess;
  if (slugArg) {
    toursToProcess = corpus.tours.filter(t => t.slug === slugArg);
    if (toursToProcess.length === 0) {
      console.error(`❌ Slug '${slugArg}' no encontrado en corpus`);
      process.exit(1);
    }
  } else {
    toursToProcess = corpus.tours;
  }

  if (allFlag && !dryFlag) {
    const ok = await confirmAll(toursToProcess.length);
    if (!ok) { console.log('Cancelado.'); process.exit(0); }
  }

  const summary = {
    total: 0, patched: 0, unchanged: 0, would_patch: 0,
    skipped: 0, errors: 0, not_in_sanity: 0, no_citation: 0
  };
  const patternCounts = {};
  const logLines = [`=== APPLY-CITABLES v4.1 LOG — ${new Date().toISOString()} ===\n`];

  for (let i = 0; i < toursToProcess.length; i++) {
    const tour = toursToProcess[i];
    const r = await processOne(tour);
    summary.total++;

    const idx = `[${i + 1}/${toursToProcess.length}]`;
    if (r.pattern) patternCounts[r.pattern] = (patternCounts[r.pattern] || 0) + 1;

    if (r.status === 'patched') {
      summary.patched++;
      if (r.phrase === null) summary.no_citation++;
      console.log(`✅ ${idx} ${r.slug} [${r.pattern}, score=${r.score}]`);
      console.log(`   "${r.phrase || '(empty — no citation)'}"`);
      logLines.push(`PATCHED ${r.slug}\n  pattern: ${r.pattern}, score: ${r.score}\n  new: "${r.phrase || '(null)'}"\n  old: "${r.oldPhrase || '(none)'}"\n`);
    } else if (r.status === 'would_patch') {
      summary.would_patch++;
      if (r.phrase === null) summary.no_citation++;
      console.log(`🟡 ${idx} ${r.slug} [${r.pattern}, score=${r.score}] (DRY)`);
      console.log(`   "${r.phrase || '(empty — no citation)'}"`);
      logLines.push(`WOULD_PATCH ${r.slug}\n  pattern: ${r.pattern}, score: ${r.score}\n  new: "${r.phrase || '(null)'}"\n`);
    } else if (r.status === 'unchanged') {
      summary.unchanged++;
      console.log(`⏭️  ${idx} ${r.slug} (sin cambios) [${r.pattern}]`);
    } else if (r.status === 'not_in_sanity') {
      summary.not_in_sanity++;
      console.log(`⚠️  ${idx} ${r.slug} (no existe en Sanity)`);
      logLines.push(`NOT_IN_SANITY ${r.slug}\n`);
    } else if (r.status?.startsWith('skipped')) {
      summary.skipped++;
      console.log(`⏭️  ${idx} ${r.slug} (${r.status})`);
    } else if (r.status === 'error') {
      summary.errors++;
      console.error(`❌ ${idx} ${r.slug}: ${r.error}`);
      logLines.push(`ERROR ${r.slug}: ${r.error}\n`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`   Total procesados:   ${summary.total}/${toursToProcess.length}`);
  console.log(`   ✅ Patcheados:       ${summary.patched}`);
  console.log(`   🟡 Would patch:     ${summary.would_patch}`);
  console.log(`   ⏭️  Sin cambios:     ${summary.unchanged}`);
  console.log(`   ⏭️  Skipped:         ${summary.skipped}`);
  console.log(`   ⚠️  No en Sanity:    ${summary.not_in_sanity}`);
  console.log(`   ❌ Errores:          ${summary.errors}`);
  console.log(`   📭 Sin cita citable: ${summary.no_citation}`);

  console.log('\n📈 DISTRIBUCIÓN POR PATTERN:');
  const sortedPatterns = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]);
  for (const [p, count] of sortedPatterns) {
    console.log(`   ${p.padEnd(40)} ${count}`);
  }

  writeFileSync('.cache/apply-log.txt', logLines.join('\n'));
  console.log(`\n📝 Log completo en .cache/apply-log.txt\n`);
}

main().catch(err => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});