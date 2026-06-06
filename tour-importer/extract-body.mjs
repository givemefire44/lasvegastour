/**
 * extract-body.mjs v4 — Extractor unificado (2 formatos)
 *
 * v4 changes:
 *   - Soporta formato MODERN (h3 con emoji 💡 📊 ✅ etc.)
 *   - Soporta formato LEGACY (h2 con numeración "1. What Makes This Tour Special")
 *   - Output unificado: ambos formatos producen las mismas keys en `extracted`
 *   - Quick Answer del legacy puede estar en el mismo h3 (inline) — extrae correctamente
 *   - Review Snapshot del legacy → parcialmente populated en byNumbers
 *   - Final Word del legacy → busca "Recommended for:" y la convierte en bestFor
 *
 * Usage:
 *   node extract-body.mjs                            (default tour)
 *   node extract-body.mjs --slug=<slug>              (tour específico)
 *   node extract-body.mjs --slug=<slug> --json       (JSON output)
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

const args = process.argv.slice(2);
const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];
const jsonMode = args.includes('--json');
const SLUG = slugArg || 'colosseum-roman-forum-palatine-hill-tour';

const sanity = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  token: TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

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

/**
 * Detecta el formato del body:
 *   - MODERN: usa h3 con emojis para cada sección
 *   - LEGACY: usa h2 con numeración "1. ..." para cada sección
 *   - UNKNOWN: no se reconoce ni uno ni otro
 */
function detectFormat(body) {
  if (!Array.isArray(body)) return 'unknown';

  let h2Numbered = 0;
  let h3WithEmoji = 0;

  for (const block of body) {
    if (block?._type !== 'block') continue;
    const text = blockText(block);

    if (block.style === 'h2') {
      // formato legacy: "1. What Makes...", "2. The Experience..."
      if (/^\d+\.\s+/.test(text)) h2Numbered++;
    } else if (block.style === 'h3') {
      // formato modern: emoji + título "💡 Quick Answer", "📊 By the Numbers"
      // detectar emoji al inicio de la línea
      // solo h3 puros sin numeración cuentan como "modern"
      if (!/^\d+\.\s+/.test(text)) {
        h3WithEmoji++;
      }
    }
  }

  if (h2Numbered >= 4) return 'legacy';
  if (h3WithEmoji >= 4) return 'modern';
  return 'unknown';
}

// ========================================
// DETECTOR DE HEADER (modern)
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

// ========================================
// DETECTOR DE HEADER (legacy)
// ========================================

function detectLegacyHeader(block) {
  // Quick Answer en legacy está en h3 (no h2 numerado)
  if (block?.style === 'h3') {
    const text = blockText(block).toLowerCase();
    if (text.includes('quick answer')) return 'quickAnswer';
    return null;
  }

  // Resto de headers en h2 numerado
  if (block?.style !== 'h2') return null;
  const text = blockText(block);
  // remover numeración inicial: "1. What Makes..." → "What Makes..."
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
// AGRUPAMIENTO POR SECCIÓN (multi-formato)
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

      // CASO ESPECIAL legacy: el h3 "Quick Answer" puede tener la respuesta en el mismo bloque
      // Si el h3 tiene texto después de "Quick Answer:", esa porción es la respuesta inline
      if (header === 'quickAnswer' && block?.style === 'h3') {
        const fullText = blockText(block);
        // Quitar emojis y la frase "Quick Answer:"
        const afterColon = fullText.replace(/.*quick answer[:\s]*/i, '').trim();
        if (afterColon.length > 10) {
          // Crear un block sintético con el contenido inline
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
// PARSERS DE SECCIONES
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
      if (m) {
        result.rating = parseFloat(m[1]);
        result.reviews = parseInt(m[2]);
      }
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

/**
 * Parsea Review Snapshot del formato legacy
 * Ej: "With 4.3 stars from over 7,000 reviews, travelers..."
 */
function parseReviewSnapshot(blocks) {
  const text = blocksToText(blocks);
  const result = {};
  // Patrón: "4.3 stars from 7000 reviews" o "4.2/5 rating from 611 reviews"
  const m = text.match(/(\d+\.?\d*)(?:\s*\/\s*5)?\s*stars?\s*(?:from|of|with)?\s*(?:over\s+)?([\d,]+)/i)
       || text.match(/(\d+\.?\d*)\/5\s*rating\s*(?:from)?\s*([\d,]+)/i);
  if (m) {
    result.rating = parseFloat(m[1]);
    result.reviews = parseInt(m[2].replace(/,/g, ''));
  }
  return result;
}

/**
 * Parsea "Final Word" del legacy buscando "Recommended for: ..."
 * Devuelve el array de items recomendados.
 */
function parseFinalWord(blocks) {
  const text = blocksToText(blocks);
  // Buscar "Recommended for: X, Y, Z" al final
  const m = text.match(/recommended\s+for[:\s]+(.+?)(?:\.|$)/i);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
}

// ========================================
// SELF-COMPARISONS
// ========================================

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

// ========================================
// CLAIMS DERIVADOS
// ========================================

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

  // For legacy: detectar free cancellation y best time desde "The Experience"
  // (porque legacy no tiene practicalInfo)
  const itineraryRaw = (extracted.itinerary?.raw || '').toLowerCase();
  if (itineraryRaw.includes('free cancellation') &&
      (itineraryRaw.includes('24 hour') || itineraryRaw.includes('24-hour') || itineraryRaw.includes('24h'))) {
    claims.explicit.push('free_cancellation_24h');
  }
  // detectar morning/evening en Curator's Tip
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

  // TOUR FORMAT (modern) o derivar del whatMakesDifferent (legacy)
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
// MAIN EXTRACTOR (multi-formato)
// ========================================
function extractTour(tour) {
  const format = detectFormat(tour.body);
  const sections = groupBlocksBySection(tour.body, format);

  // === Procesar cada sección ===
  let whatMakesDifferent = null;
  if (sections.whatMakesDifferent) {
    const raw = blocksToText(sections.whatMakesDifferent);
    whatMakesDifferent = { raw, selfComparisons: extractSelfComparisons(raw) };
  }

  // byNumbers: en modern está como sección, en legacy lo derivamos de Review Snapshot
  let byNumbers = null;
  if (sections.byNumbers) {
    byNumbers = parseByNumbers(sections.byNumbers);
  } else if (sections.reviewSnapshot) {
    byNumbers = parseReviewSnapshot(sections.reviewSnapshot);
  }

  // bestFor: en modern es sección directa, en legacy se extrae de Final Word
  let bestForList = [];
  if (sections.bestFor) {
    bestForList = blocksToStrings(sections.bestFor);
  } else if (sections.finalWord) {
    bestForList = parseFinalWord(sections.finalWord);
  }

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

    itinerary: sections.itinerary ? {
      raw: blocksToText(sections.itinerary)
    } : null,

    practicalInfo: sections.practicalInfo ? parsePracticalInfo(sections.practicalInfo) : null,

    tourFormat: sections.tourFormat ? {
      raw: blocksToText(sections.tourFormat)
    } : null,

    bestFor: bestForList,

    insiderTip: sections.insiderTip ? {
      raw: blocksToText(sections.insiderTip)
    } : null,

    // Secciones extra del legacy (info adicional, no esencial pero útil)
    finalWord: sections.finalWord ? {
      raw: blocksToText(sections.finalWord)
    } : null,
    reviewSnapshot: sections.reviewSnapshot ? {
      raw: blocksToText(sections.reviewSnapshot)
    } : null
  };

  const claims = deriveClaims(extracted);

  return {
    slug: tour.slug,
    title: tour.title,
    format,
    sectionsFound: Object.keys(sections),
    extracted,
    claims
  };
}

// ========================================
// FETCH + EXTRACT + OUTPUT
// ========================================
console.log('\n🔬 EXTRACT BODY — Coliseo (test mode v4 multi-formato)');
console.log(`   Tour slug: ${SLUG}\n`);

const tour = await sanity.fetch(
  `*[_type == "post" && slug.current == $slug][0]{
    title,
    "slug": slug.current,
    body
  }`,
  { slug: SLUG }
);

if (!tour) {
  console.error(`❌ Tour '${SLUG}' no encontrado`);
  process.exit(1);
}

const result = extractTour(tour);

if (jsonMode) {
  console.log(JSON.stringify(result, null, 2));
  writeFileSync(`.cache/extract-${SLUG}.json`, JSON.stringify(result, null, 2));
  console.log(`\n💾 Guardado en .cache/extract-${SLUG}.json`);
  process.exit(0);
}

// === Output legible ===
console.log(`📌 Title: ${result.title}`);
console.log(`📋 Format: ${result.format}`);
console.log(`📑 Sections found: ${result.sectionsFound.length}\n`);
console.log(`   ${result.sectionsFound.join(', ')}\n`);

console.log('═══════════════════════════════════════════════════════════════════════');
console.log('  EXTRACTED SECTIONS');
console.log('═══════════════════════════════════════════════════════════════════════');

if (result.extracted.quickAnswer) {
  console.log('\n💡 QUICK ANSWER:');
  const qa = result.extracted.quickAnswer.raw;
  console.log(`   "${qa.slice(0, 250)}${qa.length > 250 ? '...' : ''}"`);
  console.log(`   (${result.extracted.quickAnswer.sentenceCount} sentences)`);
}

if (result.extracted.byNumbers) {
  console.log('\n📊 BY THE NUMBERS:');
  for (const [k, v] of Object.entries(result.extracted.byNumbers)) {
    console.log(`   ${k.padEnd(15)} ${Array.isArray(v) ? v.join(', ') : v}`);
  }
}

if (result.extracted.included.length > 0) {
  console.log(`\n✅ WHAT'S INCLUDED (${result.extracted.included.length}):`);
  result.extracted.included.forEach(i => console.log(`   - ${i}`));
}

if (result.extracted.notIncluded.length > 0) {
  console.log(`\n❌ NOT INCLUDED (${result.extracted.notIncluded.length}):`);
  result.extracted.notIncluded.forEach(i => console.log(`   - ${i}`));
}

if (result.extracted.whatMakesDifferent) {
  console.log('\n🔄 WHAT MAKES DIFFERENT:');
  console.log(`   "${result.extracted.whatMakesDifferent.raw.slice(0, 200)}${result.extracted.whatMakesDifferent.raw.length > 200 ? '...' : ''}"`);

  if (result.extracted.whatMakesDifferent.selfComparisons.length > 0) {
    console.log(`\n   🎯 SELF-COMPARISONS DETECTED (${result.extracted.whatMakesDifferent.selfComparisons.length}):`);
    for (const comp of result.extracted.whatMakesDifferent.selfComparisons) {
      if (comp.type === 'price_references') {
        console.log(`      💰 Price refs: ${comp.values.join(', ')}`);
      } else {
        console.log(`      ${comp.type}: "${comp.raw}"`);
      }
    }
  }
}

if (result.extracted.bestFor.length > 0) {
  console.log(`\n👤 BEST FOR (${result.extracted.bestFor.length}):`);
  result.extracted.bestFor.forEach(i => console.log(`   - ${i}`));
}

if (result.extracted.practicalInfo) {
  console.log('\n🛡️ PRACTICAL INFO:');
  for (const [k, v] of Object.entries(result.extracted.practicalInfo)) {
    console.log(`   ${k.padEnd(20)} ${v.slice(0, 80)}${v.length > 80 ? '...' : ''}`);
  }
}

if (result.extracted.tourFormat) {
  console.log('\n🏷️ TOUR FORMAT:');
  console.log(`   "${result.extracted.tourFormat.raw.slice(0, 150)}${result.extracted.tourFormat.raw.length > 150 ? '...' : ''}"`);
}

if (result.extracted.insiderTip) {
  console.log('\n💡 INSIDER TIP:');
  console.log(`   "${result.extracted.insiderTip.raw.slice(0, 150)}${result.extracted.insiderTip.raw.length > 150 ? '...' : ''}"`);
}

if (result.extracted.reviewSnapshot) {
  console.log('\n💬 REVIEW SNAPSHOT (legacy):');
  console.log(`   "${result.extracted.reviewSnapshot.raw.slice(0, 150)}${result.extracted.reviewSnapshot.raw.length > 150 ? '...' : ''}"`);
}

if (result.extracted.finalWord) {
  console.log('\n🔚 FINAL WORD (legacy):');
  console.log(`   "${result.extracted.finalWord.raw.slice(0, 200)}${result.extracted.finalWord.raw.length > 200 ? '...' : ''}"`);
}

console.log('\n═══════════════════════════════════════════════════════════════════════');
console.log('  DERIVED CLAIMS');
console.log('═══════════════════════════════════════════════════════════════════════');

console.log(`\n✅ EXPLICIT (${result.claims.explicit.length}):`);
result.claims.explicit.forEach(c => console.log(`   ${c}`));

console.log(`\n❌ EXPLICIT NEGATIVE (${result.claims.explicitNegative.length}):`);
result.claims.explicitNegative.forEach(c => console.log(`   ${c}`));

console.log(`\n🟡 INTERPRETIVE (${result.claims.interpretive.length}):`);
result.claims.interpretive.forEach(c => console.log(`   ${c}`));

console.log(`\n💾 Para output JSON: node extract-body.mjs --slug=${SLUG} --json\n`);

writeFileSync(`.cache/extract-${SLUG}.json`, JSON.stringify(result, null, 2));
console.log(`📁 JSON completo guardado en .cache/extract-${SLUG}.json\n`);