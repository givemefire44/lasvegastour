/**
 * bulk-extract.mjs v2 — Validación masiva multi-formato
 *
 * Usa el extractor v4 que soporta:
 *   - MODERN: h3 con emojis (💡 Quick Answer, 📊 By the Numbers, etc.)
 *   - LEGACY: h2 numerado ("1. What Makes This Tour Special", etc.)
 *
 * Reporta:
 *   - Cobertura por formato
 *   - Section coverage agregada
 *   - Claims frequency (todos los tours, ambos formatos)
 *   - Self-comparisons stats
 *   - Tours unknown format (skipped)
 *
 * Solo lectura. No patchea Sanity.
 */

import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@sanity/client';

function getEnv(key) { return process.env[key]; }
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PROJECT_ID = getEnv('SANITY_PROJECT_ID');
const DATASET = getEnv('SANITY_DATASET') || 'production';
const TOKEN = getEnv('SANITY_TOKEN');

if (!PROJECT_ID || !TOKEN) {
  console.error('❌ Faltan SANITY_PROJECT_ID o SANITY_TOKEN');
  process.exit(1);
}

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token: TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

console.log('\n🔬 BULK EXTRACT v2 — Coliseo (multi-formato)\n');

// ========================================
// HELPERS BÁSICOS
// ========================================

function blockText(block) {
  if (!block?.children) return '';
  return block.children.map(c => c.text || '').join('').trim();
}

function blocksToStrings(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter(b => b?._type === 'block')
    .map(b => blockText(b))
    .filter(s => s.length > 0);
}

function blocksToText(blocks) {
  return blocksToStrings(blocks).join(' ').replace(/\s+/g, ' ').trim();
}

// ========================================
// DETECCIÓN DE FORMATO
// ========================================

function detectFormat(body) {
  if (!Array.isArray(body)) return 'unknown';
  let h2Numbered = 0;
  let h3WithEmoji = 0;
  for (const block of body) {
    if (block?._type !== 'block') continue;
    const text = blockText(block);
    if (block.style === 'h2') {
      if (/^\d+\.\s+/.test(text)) h2Numbered++;
    } else if (block.style === 'h3') {
      if (!/^\d+\.\s+/.test(text)) h3WithEmoji++;
    }
  }
  if (h2Numbered >= 4) return 'legacy';
  if (h3WithEmoji >= 4) return 'modern';
  return 'unknown';
}

// ========================================
// HEADERS
// ========================================

function detectModernHeader(block) {
  if (block?._type !== 'block' || block?.style !== 'h3') return null;
  const text = blockText(block).toLowerCase();
  if (text.includes('quick answer'))            return 'quickAnswer';
  if (text.includes('by the numbers'))          return 'byNumbers';
  if (text.includes("what's included") ||
      text.includes('what is included'))         return 'included';
  if (text.includes('not included'))             return 'notIncluded';
  if (text.includes('what makes') &&
      text.includes('different'))                return 'whatMakesDifferent';
  if (text.includes("what you'll see") ||
      text.includes('what you will see'))        return 'whatYoullSee';
  if (text.includes('itinerary'))                return 'itinerary';
  if (text.includes('practical info'))           return 'practicalInfo';
  if (text.includes('tour format'))              return 'tourFormat';
  if (text.includes('best for'))                 return 'bestFor';
  if (text.includes('insider tip') ||
      text.includes('insider tips'))             return 'insiderTip';
  return null;
}

function detectLegacyHeader(block) {
  if (block?.style === 'h3') {
    const text = blockText(block).toLowerCase();
    if (text.includes('quick answer')) return 'quickAnswer';
    return null;
  }
  if (block?.style !== 'h2') return null;
  const text = blockText(block);
  const stripped = text.replace(/^\d+\.\s+/, '').toLowerCase();

  if (stripped.includes('what makes') &&
      stripped.includes('special'))               return 'whatMakesDifferent';
  if (stripped.includes('the experience') ||
      stripped.includes('what to expect'))         return 'itinerary';
  if (stripped.includes('tour highlights') ||
      stripped.includes('highlights'))             return 'whatYoullSee';
  if (stripped.includes("what's included") ||
      stripped.includes('what is included'))       return 'included';
  if (stripped.includes('not included'))           return 'notIncluded';
  if (stripped.includes("curator's tip") ||
      stripped.includes('curator tip') ||
      stripped.includes('insider tip'))            return 'insiderTip';
  if (stripped.includes('review snapshot'))        return 'reviewSnapshot';
  if (stripped.includes('final word'))             return 'finalWord';
  return null;
}

// ========================================
// AGRUPAMIENTO
// ========================================

function groupBlocksBySection(body, format) {
  if (!Array.isArray(body)) return {};
  const sections = {};
  let currentSection = null;
  let currentBlocks = [];

  for (const block of body) {
    let header = null;
    if (format === 'modern')      header = detectModernHeader(block);
    else if (format === 'legacy') header = detectLegacyHeader(block);
    else                          header = detectModernHeader(block) || detectLegacyHeader(block);

    if (header) {
      if (currentSection) sections[currentSection] = currentBlocks;
      currentSection = header;
      currentBlocks = [];

      // CASO ESPECIAL legacy: el h3 "Quick Answer" puede tener la respuesta inline
      if (header === 'quickAnswer' && block?.style === 'h3') {
        const fullText = blockText(block);
        const afterColon = fullText.replace(/.*quick answer[:\s]*/i, '').trim();
        if (afterColon.length > 10) {
          currentBlocks.push({
            _type: 'block',
            style: 'normal',
            children: [{ text: afterColon }]
          });
        }
      }
    } else if (currentSection) {
      currentBlocks.push(block);
    }
  }
  if (currentSection) sections[currentSection] = currentBlocks;
  return sections;
}

// ========================================
// PARSERS
// ========================================

function parseByNumbers(blocks) {
  const result = {};
  for (const block of blocks) {
    const text = blockText(block);
    const match = text.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;
    const label = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (label === 'rating') {
      const m = value.match(/([\d.]+)\/5\s*\((\d+)\s*reviews?\)/i);
      if (m) { result.rating = parseFloat(m[1]); result.reviews = parseInt(m[2]); }
    } else if (label === 'duration')        result.duration = value;
    else if (label === 'price')             result.price = value;
    else if (label === 'group size')        result.groupSize = value;
    else if (label === 'guide')             result.guide = value;
    else if (label === 'meeting point')     result.meetingPoint = value;
    else if (label === 'sites covered')     result.sitesCovered = value.split(',').map(s => s.trim());
    else if (label === 'operator')          result.operator = value;
    else if (label === 'languages')         result.languages = value.split(',').map(s => s.trim());
    else if (label === 'max')               result.maxGroup = value;
  }
  return result;
}

function parsePracticalInfo(blocks) {
  const result = {};
  for (const block of blocks) {
    const text = blockText(block);
    const match = text.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;
    const label = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    result[label] = match[2].trim();
  }
  return result;
}

function parseReviewSnapshot(blocks) {
  const text = blocksToText(blocks);
  const result = {};
  const m = text.match(/(\d+\.?\d*)(?:\s*\/\s*5)?\s*stars?\s*(?:from|of|with)?\s*(?:over\s+)?([\d,]+)/i)
       || text.match(/(\d+\.?\d*)\/5\s*rating\s*(?:from)?\s*([\d,]+)/i);
  if (m) {
    result.rating = parseFloat(m[1]);
    result.reviews = parseInt(m[2].replace(/,/g, ''));
  }
  return result;
}

function parseFinalWord(blocks) {
  const text = blocksToText(blocks);
  const m = text.match(/recommended\s+for[:\s]+(.+?)(?:\.|$)/i);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function extractSelfComparisons(text) {
  if (!text) return [];
  const comparisons = [];
  const unlikeMatches = text.matchAll(/unlike\s+([^,.;]+?)(?:[,.;]|$)/gi);
  for (const m of unlikeMatches) comparisons.push({ type: 'unlike', raw: m[0].trim(), target: m[1].trim() });
  const comparedMatches = text.matchAll(/compared\s+to\s+([^,.;]+?)(?:[,.;]|$)/gi);
  for (const m of comparedMatches) comparisons.push({ type: 'compared_to', raw: m[0].trim(), target: m[1].trim() });
  const vsMatches = text.matchAll(/\bvs\.?\s+([^,.;]+?)(?:[,.;]|$)/gi);
  for (const m of vsMatches) comparisons.push({ type: 'vs', raw: m[0].trim(), target: m[1].trim() });
  const priceRefs = text.match(/\$\d+(?:[-–]\$?\d+)?/g) || [];
  if (priceRefs.length > 0) comparisons.push({ type: 'price_references', values: priceRefs });
  return comparisons;
}

function deriveClaims(extracted) {
  const claims = { explicit: [], explicitNegative: [], interpretive: [] };

  const included = extracted.included || [];
  for (const item of included) {
    const lower = item.toLowerCase();
    if (lower.includes('skip-the-line') || lower.includes('skip the line')) claims.explicit.push('skip_the_line_included');
    if (lower.includes('headset')) claims.explicit.push('headsets_included');
    if (lower.includes('licensed guide') || lower.includes('licensed english') ||
        lower.includes('professional guide') || lower.includes('expert guide')) claims.explicit.push('licensed_guide');
    if (lower.includes('arena floor')) claims.explicit.push('arena_floor_included');
    if (lower.includes('underground') || lower.includes('hypogeum')) claims.explicit.push('underground_included');
    if (lower.includes('audio guide') || lower.includes('audio app') ||
        lower.includes('audio tour') || lower.includes('audio headset')) claims.explicit.push('audio_guide_included');
    if (lower.includes('hotel pickup') || lower.includes('hotel pick-up')) claims.explicit.push('hotel_pickup_included');
    if (lower.includes('vatican')) claims.explicit.push('vatican_included');
    if (lower.includes('palatine')) claims.explicit.push('palatine_included');
    if (lower.includes('forum')) claims.explicit.push('forum_included');
    if (lower.includes('food') || lower.includes('lunch') || lower.includes('snack') || lower.includes('meal')) claims.explicit.push('food_included');
    if (lower.includes('transport') || lower.includes('transfer')) claims.explicit.push('transport_included');
    if (lower.includes('small group') || lower.includes('small-group')) claims.explicit.push('small_group_included');
  }

  const notIncluded = extracted.notIncluded || [];
  for (const item of notIncluded) {
    const lower = item.toLowerCase();
    if (lower.includes('arena floor')) claims.explicitNegative.push('no_arena_floor');
    if (lower.includes('underground')) claims.explicitNegative.push('no_underground');
    if (lower.includes('food') || lower.includes('beverage') || lower.includes('lunch')) claims.explicitNegative.push('no_food');
    if (lower.includes('hotel pickup') || lower.includes('hotel pick-up')) claims.explicitNegative.push('no_hotel_pickup');
    if (lower.includes('gratuit')) claims.explicitNegative.push('no_gratuities');
    if (lower.includes('audio guide')) claims.explicitNegative.push('no_audio_guide');
    if (lower.includes('transport') || lower.includes('transfer')) claims.explicitNegative.push('no_transport');
    if (lower.includes('live') && lower.includes('guide')) claims.explicitNegative.push('no_live_guide');
    if (lower.includes('palatine')) claims.explicitNegative.push('no_palatine');
    if (lower.includes('forum')) claims.explicitNegative.push('no_forum');
  }

  const practical = extracted.practicalInfo || {};
  if (practical.accessibility) {
    const a = practical.accessibility.toLowerCase();
    if (a.includes('not wheelchair') || a.includes('not accessible')) claims.explicitNegative.push('not_wheelchair_accessible');
    else if (a.includes('wheelchair accessible') || a.includes('accessible')) claims.explicit.push('wheelchair_accessible');
  }
  if (practical.best_time || practical.best_time_to_visit) {
    const b = (practical.best_time || practical.best_time_to_visit).toLowerCase();
    if (b.includes('morning'))   claims.explicit.push('morning_recommended');
    if (b.includes('evening') || b.includes('night') || b.includes('after-hours') || b.includes('after hours')) claims.explicit.push('evening_recommended');
    if (b.includes('afternoon')) claims.explicit.push('afternoon_recommended');
  }
  if (practical.free_cancellation) {
    const f = practical.free_cancellation.toLowerCase();
    if (f.includes('24 hour') || f.includes('24-hour') || f.includes('24h')) claims.explicit.push('free_cancellation_24h');
    else if (f.includes('available')) claims.explicit.push('free_cancellation_available');
  }

  // legacy: detectar free cancellation y best time desde itinerary y insider tip
  const itineraryRaw = (extracted.itinerary?.raw || '').toLowerCase();
  if (itineraryRaw.includes('free cancellation') &&
      (itineraryRaw.includes('24 hour') || itineraryRaw.includes('24-hour') || itineraryRaw.includes('24h'))) {
    claims.explicit.push('free_cancellation_24h');
  }
  const tipRaw = (extracted.insiderTip?.raw || '').toLowerCase();
  if (tipRaw.includes('morning') && (tipRaw.includes('book') || tipRaw.includes('arrive') || tipRaw.includes('start'))) {
    claims.explicit.push('morning_recommended');
  }
  if ((tipRaw.includes('evening') || tipRaw.includes('after-hours')) && (tipRaw.includes('book') || tipRaw.includes('best'))) {
    claims.explicit.push('evening_recommended');
  }

  const bestFor = extracted.bestFor || [];
  for (const item of bestFor) {
    const lower = item.toLowerCase();
    if (lower.includes('first-time') || lower.includes('first time')) claims.interpretive.push('best_for_first_timers');
    if (lower.includes('history enthusiast') || lower.includes('history lover') ||
        lower.includes('history buff')) claims.interpretive.push('best_for_history_enthusiasts');
    if (lower.includes('limited time') || lower.includes('short on time') || lower.includes('quick visit')) claims.interpretive.push('best_for_limited_time');
    if (lower.includes('famil') || lower.includes('kid') || lower.includes('child')) claims.interpretive.push('best_for_families');
    if (lower.includes('budget')) claims.interpretive.push('best_for_budget_travelers');
    if (lower.includes('photograph')) claims.interpretive.push('best_for_photographers');
    if (lower.includes('repeat')) claims.interpretive.push('best_for_repeat_visitors');
    if (lower.includes('senior') || lower.includes('mobility')) claims.interpretive.push('best_for_senior_travelers');
    if (lower.includes('solo')) claims.interpretive.push('best_for_solo_travelers');
    if (lower.includes('couple') || lower.includes('romantic')) claims.interpretive.push('best_for_couples');
    if (lower.includes('luxury') || lower.includes('premium')) claims.interpretive.push('best_for_luxury_seekers');
    if (lower.includes('evening') || lower.includes('after-hours')) claims.interpretive.push('best_for_evening_seekers');
    if (lower.includes('crowd') || lower.includes('without crowd')) claims.interpretive.push('best_for_crowd_avoiders');
    if (lower.includes('archaeolog')) claims.interpretive.push('best_for_archaeology_enthusiasts');
  }

  const formatRaw = (extracted.tourFormat?.raw || extracted.whatMakesDifferent?.raw || '').toLowerCase();
  if (formatRaw.includes('walking')) claims.explicit.push('walking_tour');
  if (formatRaw.includes('bus')) claims.explicit.push('bus_tour');
  if (formatRaw.includes('electric')) claims.explicit.push('electric_vehicle_tour');
  if (formatRaw.includes('private')) claims.explicit.push('private_format');
  if (formatRaw.includes('small-group') || formatRaw.includes('small group') ||
      formatRaw.includes('semi-private') || formatRaw.includes('semi private')) claims.explicit.push('small_group_format');
  if (formatRaw.includes('self-guided') || formatRaw.includes('self guided')) claims.explicit.push('self_guided_format');
  if (formatRaw.includes('night') || formatRaw.includes('evening') ||
      formatRaw.includes('after-hours') || formatRaw.includes('after hours')) claims.explicit.push('evening_format');

  claims.explicit = [...new Set(claims.explicit)];
  claims.explicitNegative = [...new Set(claims.explicitNegative)];
  claims.interpretive = [...new Set(claims.interpretive)];
  return claims;
}

// ========================================
// MAIN EXTRACTOR
// ========================================
function extractTour(tour) {
  const format = detectFormat(tour.body);
  const sections = groupBlocksBySection(tour.body, format);

  let whatMakesDifferent = null;
  if (sections.whatMakesDifferent) {
    const raw = blocksToText(sections.whatMakesDifferent);
    whatMakesDifferent = { raw, selfComparisons: extractSelfComparisons(raw) };
  }

  let byNumbers = null;
  if (sections.byNumbers) byNumbers = parseByNumbers(sections.byNumbers);
  else if (sections.reviewSnapshot) byNumbers = parseReviewSnapshot(sections.reviewSnapshot);

  let bestForList = [];
  if (sections.bestFor) bestForList = blocksToStrings(sections.bestFor);
  else if (sections.finalWord) bestForList = parseFinalWord(sections.finalWord);

  const extracted = {
    quickAnswer: sections.quickAnswer ? {
      raw: blocksToText(sections.quickAnswer),
      sentenceCount: blocksToText(sections.quickAnswer).split(/\.\s+/).length
    } : null,
    byNumbers,
    included: sections.included ? blocksToStrings(sections.included) : [],
    notIncluded: sections.notIncluded ? blocksToStrings(sections.notIncluded) : [],
    whatMakesDifferent,
    whatYoullSee: sections.whatYoullSee ? blocksToStrings(sections.whatYoullSee) : [],
    itinerary: sections.itinerary ? { raw: blocksToText(sections.itinerary) } : null,
    practicalInfo: sections.practicalInfo ? parsePracticalInfo(sections.practicalInfo) : null,
    tourFormat: sections.tourFormat ? { raw: blocksToText(sections.tourFormat) } : null,
    bestFor: bestForList,
    insiderTip: sections.insiderTip ? { raw: blocksToText(sections.insiderTip) } : null,
    finalWord: sections.finalWord ? { raw: blocksToText(sections.finalWord) } : null,
    reviewSnapshot: sections.reviewSnapshot ? { raw: blocksToText(sections.reviewSnapshot) } : null
  };

  const claims = deriveClaims(extracted);
  return { slug: tour.slug, title: tour.title, format, sectionsFound: Object.keys(sections), extracted, claims };
}

// ========================================
// FETCH ALL + PROCESS
// ========================================
console.log('📥 Fetching todos los tours del Coliseo...\n');

const tours = await sanity.fetch(`
  *[_type == "post" && defined(slug.current)]{
    title,
    "slug": slug.current,
    body
  }
`);

console.log(`   ✅ ${tours.length} tours fetched\n`);
console.log('🔬 Procesando con extractor multi-formato...\n');

const results = [];
const skipped = [];
for (const tour of tours) {
  if (!tour.slug || !tour.title || tour.title.trim().length < 3) {
    skipped.push({ slug: tour.slug, title: tour.title, reason: 'invalid_slug_or_title' });
    continue;
  }
  try {
    const extracted = extractTour(tour);
    results.push(extracted);
  } catch (err) {
    console.error(`❌ Error en ${tour.slug}: ${err.message}`);
    skipped.push({ slug: tour.slug, title: tour.title, reason: err.message });
  }
}

console.log(`   ✅ ${results.length} tours procesados`);
if (skipped.length > 0) console.log(`   ⏭️  ${skipped.length} skipped\n`);

// ========================================
// AGREGADOS Y ESTADÍSTICAS
// ========================================
const stats = {
  total: results.length,
  byFormat: { modern: 0, legacy: 0, unknown: 0 },
  unknownTours: [],
  sectionsCoverage: {},
  claimsFrequency: { explicit: {}, explicitNegative: {}, interpretive: {} },
  toursWithSelfComparisons: 0,
  selfComparisonsTotal: 0,
  toursWithPriceRefs: 0,
  byNumbersFields: { operator: 0, languages: 0, sitesCovered: 0, meetingPoint: 0, groupSize: 0, ratingFromBody: 0 },
  bestForCount: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 },
  practicalInfoCount: { 0: 0, '1-3': 0, '4-6': 0, '7-9': 0, '10+': 0 },
  // por formato:
  perFormat: {
    modern: { claimsAvg: { explicit: 0, neg: 0, interpretive: 0 }, sections: {} },
    legacy: { claimsAvg: { explicit: 0, neg: 0, interpretive: 0 }, sections: {} }
  }
};

const allSections = ['quickAnswer', 'byNumbers', 'included', 'notIncluded', 'whatMakesDifferent',
  'whatYoullSee', 'itinerary', 'practicalInfo', 'tourFormat', 'bestFor', 'insiderTip',
  'finalWord', 'reviewSnapshot'];
for (const sec of allSections) stats.sectionsCoverage[sec] = 0;

for (const r of results) {
  stats.byFormat[r.format]++;
  if (r.format === 'unknown') stats.unknownTours.push({ slug: r.slug, title: r.title });

  for (const sec of r.sectionsFound) {
    if (stats.sectionsCoverage[sec] !== undefined) stats.sectionsCoverage[sec]++;
  }

  for (const c of r.claims.explicit) stats.claimsFrequency.explicit[c] = (stats.claimsFrequency.explicit[c] || 0) + 1;
  for (const c of r.claims.explicitNegative) stats.claimsFrequency.explicitNegative[c] = (stats.claimsFrequency.explicitNegative[c] || 0) + 1;
  for (const c of r.claims.interpretive) stats.claimsFrequency.interpretive[c] = (stats.claimsFrequency.interpretive[c] || 0) + 1;

  if (r.extracted.whatMakesDifferent?.selfComparisons?.length > 0) {
    stats.toursWithSelfComparisons++;
    stats.selfComparisonsTotal += r.extracted.whatMakesDifferent.selfComparisons.length;
    if (r.extracted.whatMakesDifferent.selfComparisons.some(c => c.type === 'price_references')) {
      stats.toursWithPriceRefs++;
    }
  }

  const bn = r.extracted.byNumbers || {};
  if (bn.operator) stats.byNumbersFields.operator++;
  if (bn.languages?.length) stats.byNumbersFields.languages++;
  if (bn.sitesCovered?.length) stats.byNumbersFields.sitesCovered++;
  if (bn.meetingPoint) stats.byNumbersFields.meetingPoint++;
  if (bn.groupSize && bn.groupSize !== 'Not specified') stats.byNumbersFields.groupSize++;
  if (bn.rating) stats.byNumbersFields.ratingFromBody++;

  const bf = r.extracted.bestFor.length;
  if (bf === 0) stats.bestForCount[0]++;
  else if (bf <= 5) stats.bestForCount[bf]++;
  else stats.bestForCount['6+']++;

  const pi = Object.keys(r.extracted.practicalInfo || {}).length;
  if (pi === 0) stats.practicalInfoCount[0]++;
  else if (pi <= 3) stats.practicalInfoCount['1-3']++;
  else if (pi <= 6) stats.practicalInfoCount['4-6']++;
  else if (pi <= 9) stats.practicalInfoCount['7-9']++;
  else stats.practicalInfoCount['10+']++;

  // Por formato
  if (r.format === 'modern' || r.format === 'legacy') {
    const fmt = stats.perFormat[r.format];
    fmt.claimsAvg.explicit += r.claims.explicit.length;
    fmt.claimsAvg.neg += r.claims.explicitNegative.length;
    fmt.claimsAvg.interpretive += r.claims.interpretive.length;
    for (const sec of r.sectionsFound) {
      fmt.sections[sec] = (fmt.sections[sec] || 0) + 1;
    }
  }
}

// Promedios por formato
for (const fmt of ['modern', 'legacy']) {
  const count = stats.byFormat[fmt];
  if (count > 0) {
    stats.perFormat[fmt].claimsAvg.explicit = (stats.perFormat[fmt].claimsAvg.explicit / count).toFixed(1);
    stats.perFormat[fmt].claimsAvg.neg = (stats.perFormat[fmt].claimsAvg.neg / count).toFixed(1);
    stats.perFormat[fmt].claimsAvg.interpretive = (stats.perFormat[fmt].claimsAvg.interpretive / count).toFixed(1);
  }
}

// ========================================
// REPORT
// ========================================
let report = '';
report += '╔════════════════════════════════════════════════════════════════════╗\n';
report += '║       BULK EXTRACT REPORT v2 — Coliseo (multi-formato)             ║\n';
report += `║       Generated: ${new Date().toISOString()}            ║\n`;
report += '╚════════════════════════════════════════════════════════════════════╝\n\n';

report += `📊 OVERVIEW\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
report += `  Total tours processed:     ${stats.total}\n`;
report += `  ⏭️  Skipped:                ${skipped.length}\n\n`;

report += `📋 FORMAT DISTRIBUTION\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
report += `  Modern (h3 + emoji):       ${stats.byFormat.modern} (${Math.round(stats.byFormat.modern/stats.total*100)}%)\n`;
report += `  Legacy (h2 numerado):      ${stats.byFormat.legacy} (${Math.round(stats.byFormat.legacy/stats.total*100)}%)\n`;
report += `  Unknown:                   ${stats.byFormat.unknown}\n\n`;

if (stats.unknownTours.length > 0) {
  report += `⚠️  UNKNOWN FORMAT TOURS (${stats.unknownTours.length}) — necesitan análisis:\n`;
  for (const t of stats.unknownTours) report += `  - ${t.slug}  |  ${t.title}\n`;
  report += '\n';
}

report += `📑 SECTION COVERAGE (cuántos tours tienen cada sección)\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
const sortedCov = Object.entries(stats.sectionsCoverage).sort((a, b) => b[1] - a[1]);
for (const [sec, count] of sortedCov) {
  if (count === 0) continue;
  const pct = Math.round(count / stats.total * 100);
  const bar = '█'.repeat(Math.round(pct / 5));
  report += `  ${sec.padEnd(22)} ${count}/${stats.total} (${pct}%) ${bar}\n`;
}
report += '\n';

report += `📊 BY THE NUMBERS — campos populated\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
for (const [field, count] of Object.entries(stats.byNumbersFields).sort((a, b) => b[1] - a[1])) {
  if (count === 0) continue;
  const pct = Math.round(count / stats.total * 100);
  report += `  ${field.padEnd(22)} ${count}/${stats.total} (${pct}%)\n`;
}
report += '\n';

report += `🎯 SELF-COMPARISONS\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
report += `  Tours con self-comparisons:  ${stats.toursWithSelfComparisons}/${stats.total} (${Math.round(stats.toursWithSelfComparisons/stats.total*100)}%)\n`;
report += `  Total comparisons detected:  ${stats.selfComparisonsTotal}\n`;
report += `  Tours con price refs:        ${stats.toursWithPriceRefs}/${stats.total} (${Math.round(stats.toursWithPriceRefs/stats.total*100)}%)\n\n`;

report += `📈 CLAIMS PROMEDIO POR FORMATO\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
report += `  MODERN  (${stats.byFormat.modern} tours):\n`;
report += `    Explicit:      ${stats.perFormat.modern.claimsAvg.explicit} avg\n`;
report += `    Negative:      ${stats.perFormat.modern.claimsAvg.neg} avg\n`;
report += `    Interpretive:  ${stats.perFormat.modern.claimsAvg.interpretive} avg\n\n`;
report += `  LEGACY  (${stats.byFormat.legacy} tours):\n`;
report += `    Explicit:      ${stats.perFormat.legacy.claimsAvg.explicit} avg\n`;
report += `    Negative:      ${stats.perFormat.legacy.claimsAvg.neg} avg\n`;
report += `    Interpretive:  ${stats.perFormat.legacy.claimsAvg.interpretive} avg\n\n`;

report += `✅ EXPLICIT CLAIMS — frecuencia\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
const sortedExplicit = Object.entries(stats.claimsFrequency.explicit).sort((a, b) => b[1] - a[1]);
for (const [claim, count] of sortedExplicit) {
  const pct = Math.round(count / stats.total * 100);
  report += `  ${claim.padEnd(30)} ${count} (${pct}%)\n`;
}
report += '\n';

report += `❌ EXPLICIT NEGATIVE CLAIMS — frecuencia\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
const sortedNeg = Object.entries(stats.claimsFrequency.explicitNegative).sort((a, b) => b[1] - a[1]);
for (const [claim, count] of sortedNeg) {
  const pct = Math.round(count / stats.total * 100);
  report += `  ${claim.padEnd(30)} ${count} (${pct}%)\n`;
}
report += '\n';

report += `🟡 INTERPRETIVE CLAIMS — frecuencia\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
const sortedInt = Object.entries(stats.claimsFrequency.interpretive).sort((a, b) => b[1] - a[1]);
for (const [claim, count] of sortedInt) {
  const pct = Math.round(count / stats.total * 100);
  report += `  ${claim.padEnd(30)} ${count} (${pct}%)\n`;
}
report += '\n';

report += `📋 BEST FOR — distribución de items por tour\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
for (const [k, v] of Object.entries(stats.bestForCount)) {
  if (v > 0) report += `  ${k} items:  ${v} tours\n`;
}
report += '\n';

report += `🛡️  PRACTICAL INFO — distribución de campos por tour\n`;
report += `─────────────────────────────────────────────────────────────────────\n`;
for (const [k, v] of Object.entries(stats.practicalInfoCount)) {
  if (v > 0) report += `  ${k} fields:  ${v} tours\n`;
}
report += '\n';

if (skipped.length > 0) {
  report += `⏭️  SKIPPED TOURS (${skipped.length})\n`;
  report += `─────────────────────────────────────────────────────────────────────\n`;
  for (const t of skipped) {
    report += `  - ${t.slug || '(no-slug)'} | ${t.title || '(no-title)'} | ${t.reason}\n`;
  }
  report += '\n';
}

writeFileSync('.cache/bulk-extract-report.txt', report);
writeFileSync('.cache/bulk-extract.json', JSON.stringify(results, null, 2));

console.log(report);
console.log(`\n💾 Reporte guardado en .cache/bulk-extract-report.txt`);
console.log(`📁 JSON completo en .cache/bulk-extract.json (${(Buffer.byteLength(JSON.stringify(results)) / 1024).toFixed(1)} KB)\n`);