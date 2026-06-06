/**
 * build-corpus.mjs — Script 1 de 3 (v0.3)
 *
 * v0.3 CHANGES:
 *   - Suma Capa 7 (extracted) y Capa 8 (claims) por cada tour
 *   - Soporta 2 formatos de body: MODERN (h3 + emoji) y LEGACY (h2 numerado)
 *   - Mantiene 100% de las capas 1-6 existentes (nada se rompe)
 *
 * v0.2 CHANGES:
 *   - Detección de tower_access también desde el TÍTULO del tour
 *
 * Output: .cache/corpus.json
 */

import { createClient } from '@sanity/client';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// ========================================
// CONFIG
// ========================================
const env = {};
try {
  const envFile = readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const getEnv = (key) => env[key] || process.env[key];

const sanityClient = createClient({
  projectId: getEnv('SANITY_PROJECT_ID') || getEnv('NEXT_PUBLIC_SANITY_PROJECT_ID'),
  dataset: getEnv('SANITY_DATASET') || getEnv('NEXT_PUBLIC_SANITY_DATASET') || 'production',
  apiVersion: '2024-01-01',
  token: getEnv('SANITY_TOKEN'),
  useCdn: false
});

const OUTPUT_PATH = '.cache/corpus.json';

console.log('\n📦 BUILD CORPUS — Script 1 de 3 (v0.3)');
console.log(`   Site: colosseumroman.com`);
console.log(`   Output: ${OUTPUT_PATH}\n`);

// ========================================
// FETCH
// ========================================
async function fetchAllTours() {
  const query = `*[_type == "post" && defined(tourInfo)]{
    _id, title, "slug": slug.current, body, tourInfo, tourFeatures, getYourGuideData
  } | order(title asc)`;
  return await sanityClient.fetch(query);
}

// ========================================
// HELPERS DE PARSING DE BODY
// ========================================
function blockText(block) {
  if (!block || block._type !== 'block') return '';
  return (block.children || []).map(c => c.text || '').join('').trim();
}

function isHeader(block) {
  if (!block || block._type !== 'block') return false;
  if (!block.style) return false;
  return /^h[1-6]$/.test(block.style);
}

function extractSectionBlocks(body, headerMatcher) {
  if (!Array.isArray(body)) return [];
  const blocks = [];
  let inSection = false;
  for (const block of body) {
    if (isHeader(block)) {
      const lower = blockText(block).toLowerCase();
      if (headerMatcher(lower)) { inSection = true; continue; }
      if (inSection) break;
    }
    if (inSection) blocks.push(block);
  }
  return blocks;
}

// ========================================
// CAPA 1 — SPECS
// ========================================
function extractSpecs(tour) {
  const duration = tour.tourInfo?.duration || null;
  return {
    price: tour.tourInfo?.price ?? null,
    currency: tour.tourInfo?.currency || 'USD',
    duration: parseDuration(duration),
    rating: tour.getYourGuideData?.rating ?? null,
    reviewCount: tour.getYourGuideData?.reviewCount ?? null,
    provider: tour.getYourGuideData?.provider || null,
    location: tour.tourInfo?.location || null
  };
}

function parseDuration(raw) {
  if (!raw) return { raw: null, minutes: null, isRange: false, rangeMin: null, rangeMax: null };
  const cleaned = raw.replace(/\s*-\s*/g, '–').trim();
  const rangeMatch = cleaned.match(/^([\d.]+)–([\d.]+)\s*(hour|hours|h|minute|minutes|min)/i);
  if (rangeMatch) {
    const [, low, high, unit] = rangeMatch;
    const isHour = /hour/i.test(unit);
    const lowMin = parseFloat(low) * (isHour ? 60 : 1);
    const highMin = parseFloat(high) * (isHour ? 60 : 1);
    return { raw, minutes: Math.round((lowMin + highMin) / 2), isRange: true, rangeMin: Math.round(lowMin), rangeMax: Math.round(highMin), unit: isHour ? 'hours' : 'minutes' };
  }
  const hourMatch = cleaned.match(/^([\d.]+)\s*(hour|hours|h)$/i);
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1]);
    return { raw, minutes: Math.round(hours * 60), isRange: false, rangeMin: null, rangeMax: null, unit: 'hours' };
  }
  const minMatch = cleaned.match(/^([\d.]+)\s*(minute|minutes|min)$/i);
  if (minMatch) {
    const minutes = parseInt(minMatch[1], 10);
    return { raw, minutes, isRange: false, rangeMin: null, rangeMax: null, unit: 'minutes' };
  }
  return { raw, minutes: null, isRange: false, rangeMin: null, rangeMax: null };
}

// ========================================
// CAPA 2 — FEATURES
// ========================================
function extractFeatures(tour) {
  const fromStructured = featuresFromTourFeatures(tour.tourFeatures);
  const fromBody = featuresFromBody(tour.body);
  const fromTitle = featuresFromTitle(tour.title);
  return {
    structured: Array.from(fromStructured),
    fromBody: Array.from(fromBody),
    fromTitle: Array.from(fromTitle),
    combined: Array.from(new Set([...fromStructured, ...fromBody, ...fromTitle]))
  };
}

function featuresFromTourFeatures(tf) {
  const features = new Set();
  if (!tf) return features;
  if (tf.skipTheLine === true) features.add('skip_line');
  if (tf.wheelchairAccessible === true) features.add('wheelchair_accessible');
  if (tf.smallGroupAvailable === true) features.add('small_group');
  if (tf.freeCancellation === true) features.add('free_cancellation');
  if (typeof tf.hostGuide === 'string' && tf.hostGuide.trim().length > 0) features.add('live_guide');
  if (typeof tf.audioGuide === 'string' && tf.audioGuide.trim().length > 0) features.add('audio_guide');
  return features;
}

function featuresFromBody(body) {
  const features = new Set();
  const includesBlocks = extractSectionBlocks(body, lower =>
    lower.includes("what's included") || lower.includes("what is included") ||
    (lower.includes('included') && !lower.includes('not'))
  );
  for (const block of includesBlocks) {
    const text = blockText(block);
    if (!text || text.length > 300) continue;
    const key = normalizeIncludeText(text);
    if (key) features.add(key);
  }
  return features;
}

function featuresFromTitle(title) {
  const features = new Set();
  if (!title) return features;
  const lower = title.toLowerCase();

  if (/\barena\s+floor\b|\barena\b/.test(lower)) features.add('arena_floor');
  if (/underground|hypogeum|hipogeo/.test(lower)) features.add('underground');
  if (/\battic\b|\bbelvedere\b|\btop[\s-]tier\b|fifth\s+(level|tier)/.test(lower)) features.add('attic');
  if (/\bgladiator/.test(lower)) features.add('gladiator_focus');
  if (/\bforum\b|roman\s+forum/.test(lower)) features.add('roman_forum');
  if (/palatine\s+hill|\bpalatine\b/.test(lower)) features.add('palatine_hill');
  if (/\bvatican\b|sistine|st\.?\s+peter/.test(lower)) features.add('vatican');
  if (/\bpantheon\b/.test(lower)) features.add('pantheon');
  if (/hotel\s+(pickup|pick-up)/.test(lower)) features.add('hotel_pickup');
  if (/\bheadphones?\b/.test(lower)) features.add('headphones');
  if (/\bnight\b|\bevening\b|moonlight|by\s+night/.test(lower)) features.add('night_tour');

  return features;
}

function normalizeIncludeText(text) {
  const lower = text.toLowerCase();
  if (/arena\s+floor|gladiator['']?s\s+gate/.test(lower)) return 'arena_floor';
  if (/underground|hypogeum/.test(lower)) return 'underground';
  if (/\battic\b|\bbelvedere\b|fifth\s+(level|tier)/.test(lower)) return 'attic';
  if (/roman\s+forum|\bforum\b/.test(lower) && !/not\s+included/.test(lower)) return 'roman_forum';
  if (/palatine\s+hill|\bpalatine\b/.test(lower)) return 'palatine_hill';
  if (/\bvatican\b|sistine\s+chapel|st\.?\s+peter/.test(lower)) return 'vatican';
  if (/\bpantheon\b/.test(lower)) return 'pantheon';
  if ((/skip/.test(lower) && /(line|queue)/.test(lower)) || /fast[\s-]track/.test(lower)) return 'skip_line';
  if (/(professional|expert|live|local)\s+(local\s+|expert\s+)?guide/.test(lower)) return 'live_guide';
  if (/audio\s*(guide|tour)/.test(lower) || /audioguide/.test(lower)) return 'audio_guide';
  if (/hotel\s+(pickup|pick-up|transfer|drop)/.test(lower)) return 'hotel_pickup';
  if (/\b(headphone|earpiece|whisper)/.test(lower)) return 'headphones';
  return null;
}

// ========================================
// CAPA 3 — ITINERARY
// ========================================
function extractItinerary(body) {
  const blocks = extractSectionBlocks(body, lower =>
    lower.includes('itinerary') || lower.includes('the itinerary')
  );
  const stops = [];
  for (const block of blocks) {
    const text = blockText(block);
    if (!text || text.length < 10) continue;
    const minMatch = text.match(/\(\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*min(?:utes)?\s*\)/i);
    let minutes = null;
    if (minMatch) {
      minutes = minMatch[2]
        ? Math.round((parseInt(minMatch[1], 10) + parseInt(minMatch[2], 10)) / 2)
        : parseInt(minMatch[1], 10);
    }
    const location = extractLocationFromStop(text);
    stops.push({ text, minutes, location });
  }
  const totalMinutes = stops.reduce((sum, s) => sum + (s.minutes || 0), 0);
  return { stopCount: stops.length, totalMinutes: totalMinutes || null, stops };
}

function extractLocationFromStop(text) {
  const knownLocations = [
    'arena floor', 'arena', 'underground', 'hypogeum',
    'attic', 'belvedere', 'top tier', 'second tier', 'fifth level',
    'Roman Forum', 'Forum', 'Palatine Hill', 'Palatine',
    'Arch of Constantine', 'Arch of Titus',
    'Domus Aurea', 'Mamertine Prison',
    'Vatican', 'Sistine Chapel', "St. Peter's Basilica", 'Pantheon',
    'Trevi Fountain', 'Piazza Navona', 'Piazza del Popolo',
    'amphitheater', 'observation deck'
  ];
  for (const loc of knownLocations) {
    const re = new RegExp(`\\b${loc.replace(/\s+/g, '\\s+').replace(/í/g, '[ií]')}\\b`, 'i');
    if (re.test(text)) return loc;
  }
  return null;
}

// ========================================
// CAPA 4 — RESTRICTIONS
// ========================================
function extractRestrictions(body) {
  const blocks = extractSectionBlocks(body, lower =>
    lower.includes('practical info') || lower.includes('practical information')
  );
  const result = {
    stairs: null, wheelchair: null, reEntry: null, dressCode: null,
    bagRestrictions: null, photography: null, towerAccessNote: null,
    bestTime: null, freeCancellation: null, museumTime: null,
    meetingPoint: null, weather: null, minAge: null
  };

  for (const block of blocks) {
    const text = blockText(block);
    if (!text) continue;
    const lower = text.toLowerCase();

    const stairMatch = text.match(/(\d+)\+?\s*(?:steps?|stairs)/i);
    if (stairMatch) {
      result.stairs = { count: parseInt(stairMatch[1], 10), mandatory: /must|mandatory|required|obligator/i.test(text), text };
    }
    if (/accessibility|wheelchair/i.test(lower)) {
      const isAccessible = /accessible/i.test(lower) && !/not\s+accessible/i.test(lower);
      result.wheelchair = { accessible: isAccessible, viaRamps: /ramp/i.test(lower), towerExcluded: /tower/i.test(lower), text };
    }
    if (/re-?entry/i.test(lower)) result.reEntry = !/not\s+permitted|not\s+allowed/i.test(lower);
    if (/dress\s+code/i.test(lower)) result.dressCode = text;
    if (/bag|backpack|suitcase/i.test(lower) && /restrict|not\s+allowed|prohibited/i.test(lower)) result.bagRestrictions = text;
    if (/tower\s+access/i.test(lower)) result.towerAccessNote = text;
    if (/best\s+time/i.test(lower)) result.bestTime = text;
    if (/free\s+cancellation/i.test(lower)) result.freeCancellation = text;
    const museumTimeMatch = text.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*minutes?\s+of\s+free\s+(?:exploration|museum)/i);
    if (museumTimeMatch) {
      result.museumTime = { min: parseInt(museumTimeMatch[1], 10), max: museumTimeMatch[2] ? parseInt(museumTimeMatch[2], 10) : null, text };
    }
    if (/meeting\s+point/i.test(lower)) result.meetingPoint = text;
    if (/weather/i.test(lower) && /tour\s+operates|rain\s+or\s+shine/i.test(lower)) result.weather = text;
    const ageMatch = text.match(/(?:min(?:imum)?\s+age|ages?\s+(\d+)\+|under\s+(\d+))/i);
    if (ageMatch) result.minAge = parseInt(ageMatch[1] || ageMatch[2], 10);
  }
  return result;
}

// ========================================
// CAPA 5 — INCLUSIONS RAW
// ========================================
function extractInclusionsRaw(body) {
  const blocks = extractSectionBlocks(body, lower =>
    lower.includes("what's included") || lower.includes("what is included") ||
    (lower.includes('included') && !lower.includes('not'))
  );
  return blocks.map(b => blockText(b)).filter(t => t && t.length > 0 && t.length < 300);
}

function extractExclusionsRaw(body) {
  const blocks = extractSectionBlocks(body, lower =>
    lower.includes('not included') || lower.includes("what's not included")
  );
  return blocks.map(b => blockText(b)).filter(t => t && t.length > 0 && t.length < 300);
}

// ========================================
// CAPA 6 — DIFFERENTIATOR
// ========================================
function extractDifferentiator(body) {
  const blocks = extractSectionBlocks(body, lower =>
    lower.includes('what makes this tour different') ||
    lower.includes('what makes it different') ||
    lower.includes('makes this tour special')
  );
  const texts = blocks.map(b => blockText(b)).filter(t => t && t.length > 20);
  return texts.length > 0 ? texts.join(' ') : null;
}

function extractBestFor(body) {
  const blocks = extractSectionBlocks(body, lower => lower.includes('best for'));
  return blocks.map(b => blockText(b)).filter(t => t && t.length > 0);
}

// ========================================
// CAPA 7 — EXTRACTED MULTI-FORMATO (NUEVO v0.3)
// ========================================

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

      // Inline Quick Answer (legacy)
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

function parseByNumbersExtracted(blocks) {
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

function parsePracticalInfoExtracted(blocks) {
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

function parseReviewSnapshotExtracted(blocks) {
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

function parseFinalWordExtracted(blocks) {
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

function buildExtracted(sections) {
  let whatMakesDifferent = null;
  if (sections.whatMakesDifferent) {
    const raw = blocksToText(sections.whatMakesDifferent);
    whatMakesDifferent = { raw, selfComparisons: extractSelfComparisons(raw) };
  }

  let byNumbers = null;
  if (sections.byNumbers) byNumbers = parseByNumbersExtracted(sections.byNumbers);
  else if (sections.reviewSnapshot) byNumbers = parseReviewSnapshotExtracted(sections.reviewSnapshot);

  let bestForList = [];
  if (sections.bestFor) bestForList = blocksToStrings(sections.bestFor);
  else if (sections.finalWord) bestForList = parseFinalWordExtracted(sections.finalWord);

  return {
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
    practicalInfo: sections.practicalInfo ? parsePracticalInfoExtracted(sections.practicalInfo) : null,
    tourFormat: sections.tourFormat ? { raw: blocksToText(sections.tourFormat) } : null,
    bestFor: bestForList,
    insiderTip: sections.insiderTip ? { raw: blocksToText(sections.insiderTip) } : null,
    finalWord: sections.finalWord ? { raw: blocksToText(sections.finalWord) } : null,
    reviewSnapshot: sections.reviewSnapshot ? { raw: blocksToText(sections.reviewSnapshot) } : null
  };
}

// ========================================
// CAPA 8 — CLAIMS DERIVADOS (NUEVO v0.3)
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
// EXTRACCIÓN COMPLETA POR TOUR
// ========================================
function extractTourFacts(tour) {
  // Capas 1-6 (existentes)
  const baseFacts = {
    id: tour._id,
    slug: tour.slug,
    title: tour.title,
    specs: extractSpecs(tour),
    features: extractFeatures(tour),
    itinerary: extractItinerary(tour.body),
    restrictions: extractRestrictions(tour.body),
    inclusionsRaw: extractInclusionsRaw(tour.body),
    exclusionsRaw: extractExclusionsRaw(tour.body),
    differentiator: extractDifferentiator(tour.body),
    bestFor: extractBestFor(tour.body)
  };

  // Capas 7-8 (NUEVO v0.3)
  const format = detectFormat(tour.body);
  const sections = groupBlocksBySection(tour.body, format);
  const extracted = buildExtracted(sections);
  const claims = deriveClaims(extracted);

  return {
    ...baseFacts,
    format,
    extracted,
    claims
  };
}

// ========================================
// MAIN
// ========================================
async function main() {
  console.log('📥 Fetching all tours from Sanity...');
  const tours = await fetchAllTours();
  console.log(`   ✅ ${tours.length} tours fetched\n`);

  console.log('🔍 Extracting facts per tour...');
  const corpus = {
    metadata: {
      site: 'colosseumroman.com',
      monument: 'Colosseum',
      totalTours: tours.length,
      extractedAt: new Date().toISOString(),
      schemaVersion: '0.3'
    },
    tours: tours.map(extractTourFacts)
  };

  // Stats existentes
  const stats = {
    withDuration: corpus.tours.filter(t => t.specs.duration?.minutes).length,
    withItinerary: corpus.tours.filter(t => t.itinerary.stopCount > 0).length,
    withDifferentiator: corpus.tours.filter(t => t.differentiator).length,
    withArenaFloor: corpus.tours.filter(t => t.features.combined.includes('arena_floor')).length,
    withArenaFromTitle: corpus.tours.filter(t => t.features.fromTitle.includes('arena_floor')).length,
    withArenaFromBody: corpus.tours.filter(t => t.features.fromBody.includes('arena_floor')).length,
    withUnderground: corpus.tours.filter(t => t.features.combined.includes('underground')).length,
    withAttic: corpus.tours.filter(t => t.features.combined.includes('attic')).length,
    withRomanForum: corpus.tours.filter(t => t.features.combined.includes('roman_forum')).length,
    withPalatine: corpus.tours.filter(t => t.features.combined.includes('palatine_hill')).length,
    withVatican: corpus.tours.filter(t => t.features.combined.includes('vatican')).length,
    withPantheon: corpus.tours.filter(t => t.features.combined.includes('pantheon')).length
  };

  // NUEVO v0.3 — Stats de Capa 7-8
  const v03Stats = {
    formatModern: corpus.tours.filter(t => t.format === 'modern').length,
    formatLegacy: corpus.tours.filter(t => t.format === 'legacy').length,
    formatUnknown: corpus.tours.filter(t => t.format === 'unknown').length,
    withQuickAnswer: corpus.tours.filter(t => t.extracted.quickAnswer).length,
    withSelfComparisons: corpus.tours.filter(t => t.extracted.whatMakesDifferent?.selfComparisons?.length > 0).length,
    withPriceRefs: corpus.tours.filter(t =>
      t.extracted.whatMakesDifferent?.selfComparisons?.some(c => c.type === 'price_references')
    ).length,
    avgExplicitClaims: (corpus.tours.reduce((s, t) => s + t.claims.explicit.length, 0) / corpus.tours.length).toFixed(1),
    avgNegativeClaims: (corpus.tours.reduce((s, t) => s + t.claims.explicitNegative.length, 0) / corpus.tours.length).toFixed(1),
    avgInterpretiveClaims: (corpus.tours.reduce((s, t) => s + t.claims.interpretive.length, 0) / corpus.tours.length).toFixed(1)
  };

  console.log(`   ✅ ${corpus.tours.length} tours processed\n`);
  console.log('📊 Extraction quality:');
  console.log(`   With duration:        ${stats.withDuration}/${corpus.tours.length}`);
  console.log(`   With itinerary:       ${stats.withItinerary}/${corpus.tours.length}`);
  console.log(`   With differentiator:  ${stats.withDifferentiator}/${corpus.tours.length}`);
  console.log('');
  console.log('🏗️  Premium feature detection (combined):');
  console.log(`   arena_floor:          ${stats.withArenaFloor} tours (body=${stats.withArenaFromBody}, title=${stats.withArenaFromTitle})`);
  console.log(`   underground:          ${stats.withUnderground} tours`);
  console.log(`   attic:                ${stats.withAttic} tours`);
  console.log(`   roman_forum:          ${stats.withRomanForum} tours`);
  console.log(`   palatine_hill:        ${stats.withPalatine} tours`);
  console.log(`   vatican:              ${stats.withVatican} tours`);
  console.log(`   pantheon:             ${stats.withPantheon} tours\n`);

  // NUEVO v0.3
  console.log('🔬 Body extraction (Capa 7-8 v0.3):');
  console.log(`   Format modern:        ${v03Stats.formatModern} tours`);
  console.log(`   Format legacy:        ${v03Stats.formatLegacy} tours`);
  console.log(`   Format unknown:       ${v03Stats.formatUnknown} tours`);
  console.log(`   With Quick Answer:    ${v03Stats.withQuickAnswer} tours`);
  console.log(`   Self-comparisons:     ${v03Stats.withSelfComparisons} tours`);
  console.log(`   With price refs:      ${v03Stats.withPriceRefs} tours`);
  console.log(`   Avg explicit claims:  ${v03Stats.avgExplicitClaims}`);
  console.log(`   Avg negative claims:  ${v03Stats.avgNegativeClaims}`);
  console.log(`   Avg interpretive:     ${v03Stats.avgInterpretiveClaims}\n`);

  const dir = dirname(OUTPUT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(OUTPUT_PATH, JSON.stringify(corpus, null, 2));
  const sizeKB = (Buffer.byteLength(JSON.stringify(corpus)) / 1024).toFixed(1);
  console.log(`✅ Corpus saved to ${OUTPUT_PATH} (${sizeKB} KB)`);
  console.log('\n   Próximo paso: node analyze-corpus.mjs');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
