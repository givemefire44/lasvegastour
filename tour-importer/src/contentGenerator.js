// src/contentGenerator.js - V2 TRANSACTIONAL + GEO OPTIMIZED (Las Vegas)
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import * as configModule from '../config.js';
import { promptBuilder, getCityDisplayName } from '../templates/post-template.js';
import { classifyCategory } from './sanityUploader.js';

const config = configModule.config || configModule.default;

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey
});

const sanityClient = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false
});

/**
 * Clean generated content - format for template
 */
function cleanGeneratedContent(content) {
  console.log('Cleaning content format...');

  let cleaned = content;

  // Replace asterisk lists
  cleaned = cleaned.replace(/^\* /gm, '- ');
  cleaned = cleaned.replace(/^\*\s*\*\*/gm, '- **');
  cleaned = cleaned.replace(/^\*([^*])/gm, '- $1');

  // Protect bold labels (like **Rating:** **Duration:** etc)
  const protectedItems = [];

  // Protect FAQ questions: **Q: ... ?**
  cleaned = cleaned.replace(/\*\*Q:\s*[^?]+\?\*\*/g, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  // Protect bold prices and durations (Quick Answer)
  cleaned = cleaned.replace(/\*\*\$[\d,.]+[^*]*\*\*/g, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  cleaned = cleaned.replace(/\*\*[\d]+-(?:hour|minute|day)[^*]*\*\*/g, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  // Protect durations with space (e.g., **3 hours**, **75 minutes**)
  cleaned = cleaned.replace(/\*\*\d+\s*(?:minutes?|hours?|days?)\*\*/g, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  // Protect landmark names (Las Vegas)
  cleaned = cleaned.replace(/\*\*(?:Grand Canyon|West Rim|South Rim|Skywalk|Hoover Dam|Lake Mead|Colorado River|Antelope Canyon|Horseshoe Bend|Zion(?: National Park)?|Bryce Canyon|Death Valley|Red Rock(?: Canyon)?|Valley of Fire|Mojave(?: Desert)?|Eagle Point|Guano Point|Fremont Street|Bellagio|Las Vegas Strip|the Strip|The Strip|Las Vegas)\*\*/gi, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  // Protect access types and key features
  cleaned = cleaned.replace(/\*\*(?:skip-the-line|line skip|express entry|fast-track|priority access|vip entry|vip access|hotel pickup|round-trip transport)\*\*/gi, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  // Protect Las Vegas elements / experiences
  cleaned = cleaned.replace(/\*\*(?:Fremont Street Experience|Neon Museum|Bellagio fountains|champagne landing|night flight|party bus|bottle service|Cirque du Soleil|Welcome to Fabulous Las Vegas)\*\*/gi, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });

  // Protect data labels: **Label:** value
  cleaned = cleaned.replace(/\*\*([A-Z][^*]{1,30}):\*\*/g, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });

  // Protect data labels: **Label:** value
  cleaned = cleaned.replace(/\*\*([A-Z][^*]{1,30}):\*\*/g, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });

  // Restore protected items
  protectedItems.forEach((item, index) => {
    const placeholder = `__PROTECTED_${index}__`;
    cleaned = cleaned.replace(placeholder, item);
  });

  // Remove underscore emphasis
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  // Normalize the site's core term against doubled-s typos (e.g. "Vegass" -> "Vegas").
  // Runs on the whole content, so the H1/H2/SEO extracted from it are corrected too.
  cleaned = cleaned.replace(/\bVegas{2,}\b/gi, 'Vegas');

  console.log('Content cleaned');

  return cleaned;
}

/**
 * Detect tour type from tour data.
 * Las Vegas is a city with diverse tour types, so the axis is the category
 * assigned by the classifier (same logic as the uploader — single source of truth).
 * Returns the category slug (e.g. 'grand-canyon-tours').
 */
function detectCombo(tourData) {
  return classifyCategory(tourData.title || '');
}

/**
 * Fetch existing tour titles from Sanity (avoid duplicate H1s).
 * If a categorySlug is passed, only titles from THAT category are returned —
 * canibalization happens between same-type tours, so that's where the H1 must differ.
 */
async function fetchExistingTitles(categorySlug) {
  try {
    const query = categorySlug
      ? `*[_type == "post" && category->slug.current == $categorySlug]{title}`
      : `*[_type == "post"]{title}`;
    const titles = await sanityClient.fetch(query, { categorySlug });
    console.log(`   Found ${titles.length} existing titles${categorySlug ? ` in "${categorySlug}"` : ''}`);
    return titles.map(t => t.title);
  } catch (e) {
    console.log(`   Could not fetch existing titles: ${e.message}`);
    return [];
  }
}

/**
 * Pick a random item from an array — used for synonym rotation in H1 titles
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate H1 Title — Las Vegas optimized for maximum variety (LOCAL FALLBACK)
 */
function generateH1Title(tourData) {
  const title = tourData.title || '';
  const lower = title.toLowerCase();
  const category = classifyCategory(title);

  // --- Group format ---
  const isPrivate     = lower.includes('private');
  const isSmallGroup  = lower.includes('small group') || lower.includes('small-group');
  const isSemiPrivate = lower.includes('semi-private') || lower.includes('semi private');

  // --- Access ---
  const isSkipLine = (lower.includes('skip') && (lower.includes('line') || lower.includes('queue')))
    || lower.includes('vip entry') || lower.includes('line skip') || lower.includes('fast track');
  const isVIP      = lower.includes('vip') || lower.includes('exclusive');

  // --- Audience ---
  const isFamily = lower.includes('family') || lower.includes('kids') || lower.includes('children');

  // --- Air ---
  const isHelicopter = lower.includes('helicopter') || lower.includes('chopper') || /\bheli\b/.test(lower);
  const isAirplane   = lower.includes('airplane') || lower.includes('air tour') || lower.includes('fixed-wing');
  const isLanding    = lower.includes('landing') || lower.includes('champagne');

  // --- Grand Canyon ---
  const isWestRim  = lower.includes('west rim');
  const isSouthRim = lower.includes('south rim');
  const isSkywalk  = lower.includes('skywalk');

  // --- Combos / extras ---
  const hasHoover   = lower.includes('hoover dam');
  const hasLakeMead = lower.includes('lake mead');
  const isNight     = lower.includes('night');

  let parts = [];

  // Anchor by category
  switch (category) {
    case 'grand-canyon-tours':
      parts.push('Grand Canyon');
      if (isWestRim) parts.push('West Rim');
      else if (isSouthRim) parts.push('South Rim');
      break;
    case 'hoover-dam-tours':
      parts.push('Hoover Dam');
      break;
    case 'day-trips':
      if (lower.includes('antelope'))            parts.push('Antelope Canyon');
      else if (lower.includes('death valley'))   parts.push('Death Valley');
      else if (lower.includes('zion'))           parts.push('Zion');
      else if (lower.includes('bryce'))          parts.push('Bryce Canyon');
      else if (lower.includes('valley of fire')) parts.push('Valley of Fire');
      else if (lower.includes('red rock'))       parts.push('Red Rock Canyon');
      else                                       parts.push('Las Vegas');
      break;
    default: // adventure / helicopter / nightlife / shows / strip
      parts.push('Las Vegas');
  }

  // Group format
  if (isPrivate)          parts.push(pick(['Private', 'Exclusive']));
  else if (isSemiPrivate) parts.push('Semi-Private');
  else if (isSmallGroup)  parts.push(pick(['Small Group', 'Intimate Group']));

  // Air format
  if (isHelicopter)     parts.push(pick(['Helicopter Tour', 'Heli Flight', 'Aerial Tour']));
  else if (isAirplane)  parts.push(pick(['Airplane Tour', 'Air Tour']));

  // Skip line / VIP entry
  if (isSkipLine) parts.push(pick(['Skip-the-Line', 'VIP Entry', 'Line Skip']));

  // Type-specific descriptor (only when not already an air tour)
  if (!isHelicopter && !isAirplane) {
    if (category === 'nightlife') {
      parts.push(pick(['Club Crawl', 'Nightclub Crawl', 'VIP Nightlife Tour', 'Party Bus Tour']));
    } else if (category === 'shows') {
      parts.push(pick(['Show Tickets', 'Show']));
    } else if (category === 'adventure-tours') {
      if (lower.includes('atv') || lower.includes('off-road') || lower.includes('dune buggy')) parts.push('ATV Adventure');
      else if (lower.includes('zip')) parts.push('Zip-Line Adventure');
      else if (lower.includes('shooting') || lower.includes('gun') || lower.includes('machine gun')) parts.push('Shooting Experience');
      else parts.push(pick(['Adventure Tour', 'Outdoor Adventure']));
    } else if (category === 'strip-tours') {
      if (isNight) parts.push('Night');
      parts.push(pick(['Strip Tour', 'City Tour', 'Sightseeing Tour']));
    } else {
      // grand-canyon / hoover-dam / day-trips ground tour
      parts.push(pick(['Tour', 'Day Trip', 'Excursion']));
    }
  }

  // Skywalk add-on
  if (isSkywalk && category === 'grand-canyon-tours') parts.push(pick(['+ Skywalk', 'with Skywalk']));

  // Landing
  if (isLanding) parts.push(pick(['with Landing', '+ Champagne Landing']));

  // Combo (max 1)
  if (hasHoover && category !== 'hoover-dam-tours')                                 parts.push('& Hoover Dam');
  else if (hasLakeMead && category !== 'hoover-dam-tours' && category !== 'day-trips') parts.push('& Lake Mead');

  // Audience
  if (isFamily) parts.push('for Families');

  // "from Las Vegas" for out-of-town destinations (if not already present)
  if (['grand-canyon-tours', 'hoover-dam-tours', 'day-trips'].includes(category)
    && !parts.join(' ').toLowerCase().includes('las vegas')) {
    parts.push('from Las Vegas');
  }

  let h1 = parts.join(' ');
  if (h1.length > 60) h1 = h1.substring(0, 57) + '...';
  return h1;
}

/**
 * Parse FAQs from Claude output
 */
function parseFaqsFromContent(content) {
  const faqs = [];
  const lines = content.split('\n');
  let inFaqSection = false;
  let currentQuestion = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('Frequently Asked Questions') || trimmed.match(/^###.*FAQ/i)
      || trimmed.match(/^###.*\?/)) {
      inFaqSection = true;
      continue;
    }
    if (inFaqSection && trimmed.startsWith('###') && !trimmed.includes('FAQ')
      && !trimmed.includes('?') && !trimmed.includes('Question')) {
      break;
    }
    if (!inFaqSection) continue;

    const qMatch = trimmed.match(/\*?\*?Q:\s*(.+?\?)\*?\*?/);
    if (qMatch) {
      currentQuestion = qMatch[1].trim();
      continue;
    }
    const aMatch = trimmed.match(/^A:\s*(.+)/);
    if (aMatch && currentQuestion) {
      faqs.push({
        _type: 'faq',
        _key: Math.random().toString(36).substring(2, 11),
        question: currentQuestion,
        answer: aMatch[1].trim()
      });
      currentQuestion = null;
    }
  }
  return faqs;
}

/**
 * Remove FAQ section from body content
 */
function removeFaqSectionFromContent(content) {
  const lines = content.split('\n');
  let faqStart = -1;
  let faqEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.includes('Frequently Asked Questions') || trimmed.match(/^###.*FAQ/i)) {
      faqStart = i;
      continue;
    }
    if (faqStart >= 0 && trimmed.startsWith('###') && !trimmed.includes('FAQ')
      && !trimmed.includes('Question')) {
      faqEnd = i;
      break;
    }
  }

  if (faqStart >= 0) {
    const endIdx = faqEnd >= 0 ? faqEnd : lines.length;
    lines.splice(faqStart, endIdx - faqStart);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  return content;
}

/**
 * Generate tour content using Claude
 * @param {object} tourData
 * @param {Array} relatedTours - recent tours for the comparison table (wired through; table activation pending)
 */
export async function generateTourContent(tourData, relatedTours = []) {
  console.log('\nGenerating content V2 (Transactional + GEO)...');

  try {
    const combo = detectCombo(tourData);
    console.log(`Tour type: ${combo}`);

  // Fetch existing titles to avoid duplicate H1s (same category only — where canibalization happens)
  const existingTitles = await fetchExistingTitles(config.forcedCategory || combo);

    // Prepare structured data for Claude
    const structuredData = {
      city: 'Las Vegas',
      combo,
      title: tourData.title,
      rating: tourData.rating,
      reviewCount: tourData.reviewCount,
      price: tourData.price,
      duration: tourData.duration,
      groupSize: tourData.groupSize || tourData.features?.groupSize || 'N/A',
      description: tourData.description,
      highlights: tourData.highlights,
      includes: tourData.includes,
      languages: tourData.languages,
      provider: tourData.provider,
      reviewQuotes: tourData.reviewQuotes,
      features: tourData.features,
      url: tourData.url,
      relatedTours,
      existingTitles
    };

    const prompt = promptBuilder(structuredData);

    console.log('Waiting for Claude response...');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const rawContent = message.content[0].text;

    // Clean content
    const content = cleanGeneratedContent(rawContent);

    console.log('Content V2 generated');
    console.log(`   Tokens used: ${message.usage.input_tokens + message.usage.output_tokens}`);

    // Extract metadata generated by Claude
    const h1TitleMatch = content.match(/H1_?TITLE:\s*(.+)/i);
    const h2TitleMatch = content.match(/H2_?TITLE:\s*(.+)/i);
    const seoDescMatch = content.match(/SEO_?DESCRIPTION:\s*(.+)/i);
    const keywordsMatch = content.match(/KEYWORDS:\s*(.+)/i);

    // H1: prefer Claude's, fallback to local generation
    const finalH1 = (h1TitleMatch
      ? h1TitleMatch[1].trim()
      : generateH1Title(tourData))
      .replace(/\s+by\s+[\w\s]+$/i, '')   // remove provider name
      .replace(/\s*\(\d[^)]*\)/g, '')       // remove parenthetical numbers
      .replace(/\s+[\d.]+(?:\s*[-–]\s*[\d.]+)?\s*-?\s*hours?\b/gi, '')   // remove duration (ranges + plural)
      .replace(/\s+\d+(?:\s*[-–]\s*\d+)?\s*-?\s*minutes?\b/gi, '')        // remove duration (ranges + plural)
      .replace(/\s*[-–—:,]+\s*$/, '')        // strip any trailing dash/colon/comma left over
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 60)
      .replace(/\s*[-–—:,]+\s*$/, '')        // and again after the 60-char cut
      .trim();

    const finalH2 = h2TitleMatch
      ? h2TitleMatch[1].trim()
      : tourData.title;

    // SEO Title = H1 without emojis
    const seoTitle = finalH1.replace(/^[\u{1F300}-\u{1FFFF}]\s*/u, '').trim().substring(0, 60);

    const seoDescription = seoDescMatch
      ? seoDescMatch[1].trim().substring(0, 160)
      : generateSEODescription(tourData, combo);

    const seoKeywords = keywordsMatch
      ? keywordsMatch[1].split(',').map(k => k.trim()).slice(0, 7)
      : generateKeywords(tourData, combo);

    // Validation
    console.log(`H1 Title: ${finalH1.length} chars ${finalH1.length > 60 ? 'WARNING: LONG' : 'OK'}`);
    console.log(`SEO Title: ${seoTitle.length} chars ${seoTitle.length > 60 ? 'WARNING: EXCEEDED' : 'OK'}`);
    console.log(`SEO Desc: ${seoDescription.length} chars ${seoDescription.length > 160 ? 'WARNING: EXCEEDED' : 'OK'}`);

    // Remove metadata lines from content
    let cleanContent = content
      .replace(/H1_?TITLE:.*\n?/gi, '')
      .replace(/H2_?TITLE:.*\n?/gi, '')
      .replace(/SEO_?TITLE:.*\n?/gi, '')
      .replace(/SEO_?DESCRIPTION:.*\n?/gi, '')
      .replace(/KEYWORDS:.*\n?/gi, '')
      .trim();

    // Parse FAQs from content and remove from body
    cleanContent = await enforceSourceGrounding(cleanContent, tourData);
    const faqs = parseFaqsFromContent(cleanContent);
    cleanContent = removeFaqSectionFromContent(cleanContent);

    // Generate editorial review
    let editorialRating = null;
    let editorialReview = null;
    const gygRating = tourData.rating || 0;

    if (gygRating > 0) {
      const offset = Math.random() > 0.5 ? 0.1 : -0.1;
      const rawRating = Math.max(1, Math.min(5, gygRating + offset));
      editorialRating = Math.round(rawRating * 2) / 2;

      const reviewPrompt = `Write an editorial review for a Las Vegas tour. Write as a real editorial team, not an AI template.

      Part 1 (2 sentences): What the tour delivers in practical terms. First sentence: what the visitor gets (the experience + how it is run). Second sentence: one specific operational detail from the tour data ONLY — do NOT invent group sizes, drive times, or visitor counts.

      Part 2 (1-2 sentences): One honest limitation stated naturally — not harshly. Frame it as context, not criticism. This is only a FORMAT example — pick the limitation that genuinely fits THIS tour from its data, do not copy it: "It is a long day with several hours on the road, though the route is far shorter than the alternative."

      Part 3: "Best for" followed by specific audience and concrete benefit in one sentence. Never use "Smart choice for:" — sounds robotic.

      FORMAT RULES:
      - Keep the TOTAL review under 60 words.
      - Separate each part with a line break — do NOT write a single dense block.
      - Short sentences only (under 20 words each).
      - Part 1: max 2 sentences. Part 2: max 1 sentence. Part 3: max 1 sentence.

      STYLE RULES:
      - Sound like a real travel editorial team, not a prompt output
      - Vary rhythm — mix short and longer sentences
      - Integrate data naturally: "With a 4.8-star rating from more than 1,200 reviews" not "rated 4.8/5 (1,200 reviews), reflecting consistently solid execution"
      - Avoid corporate language: "consistently well received" not "reflecting solid execution"
      - Keep sentences under 30 words each — if a sentence is heavy, split it
      - The review should sound like a person wrote it after researching, not like a template filled in data
      - Soften limitations naturally ("is not included, but..." not "The tour lacks...")
      - NO "Smart choice for:" format — use "Best for" naturally in a sentence
      - NO generic phrases: "exceptional value", "authentic experience", "unforgettable", "trip of a lifetime", "breathtaking", "must-see", "hidden gems", "world-class"

      OPENING SENTENCE: Must feel natural. Vary each time:
      (a) Lead with what is included or the access advantage
      (b) Lead with what the visitor avoids (the long drive, the queue, the planning)
      (c) Lead with the guide's or pilot's role
      (d) Lead with the group format
      (e) Lead with a specific stop or sight (West Rim, Skywalk, the Strip skyline, the venue)
      (f) Lead with timing (night flight, early departure)
      (g) Lead with the transport or logistics handled for the visitor
      (h) Lead with cost-value

      Tour: ${tourData.title}
      Location: Las Vegas, Nevada
      Price: $${tourData.price || 'N/A'}
      Duration: ${tourData.duration || 'N/A'}
      GYG Rating: ${gygRating}/5 (${tourData.reviewCount || 0} reviews)
      Provider: ${tourData.provider || 'N/A'}
      Included: ${(tourData.includes || []).join('; ') || 'Not specified'}
      Highlights: ${(tourData.highlights || []).join('; ') || 'Not specified'}

      ACCURACY: Base any claim about what is included or costs extra ONLY on the "Included" list above. If something appears in Included, NEVER call it an add-on or an extra cost. If it is not listed, do NOT claim it is included. Highlights describe the experience and do not by themselves mean something is included.

      Respond with ONLY the review text. No quotes, no labels, no "Part 1/2/3" headers.`;

      const reviewMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        temperature: 0.5,
        messages: [{ role: 'user', content: reviewPrompt }]
      });
      editorialReview = reviewMsg.content[0].text.trim().replace(/\bVegas{2,}\b/gi, 'Vegas');
      console.log(`   Editorial: ${editorialRating}/5 — ${editorialReview.substring(0, 60)}...`);
    }

    return {
      title: finalH1,
      bodyTitle: finalH2,
      originalTitle: tourData.title,
      seoTitle,
      seoDescription,
      seoKeywords,
      body: cleanContent,
      faqs,
      editorialRating,
      editorialReview,
      city: 'Las Vegas',
      rawContent: cleanContent
    };

  } catch (error) {
    console.error('Error generating content:', error.message);
    throw error;
  }
}

/**
 * Generate SEO Description - Las Vegas
 */
function generateSEODescription(tourData, category) {
  const { rating, price, duration, title } = tourData;
  const lower = (title || '').toLowerCase();

  let parts = [];

  // Hard data first
  if (price && duration) {
    parts.push(`$${price} ${duration} Las Vegas tour.`);
  } else if (price) {
    parts.push(`From $${price} — Las Vegas tour.`);
  } else {
    parts.push(`Las Vegas guided tour.`);
  }

  // Rating
  if (rating && rating >= 4.5) {
    parts.push(`Rated ${rating}/5.`);
  }

  // Key feature by category
  switch (category) {
    case 'grand-canyon-tours':
      if (lower.includes('west rim'))       parts.push('Grand Canyon West Rim with optional Skywalk.');
      else if (lower.includes('south rim')) parts.push('Grand Canyon South Rim viewpoints.');
      else if (lower.includes('helicopter')) parts.push('Grand Canyon helicopter tour.');
      else                                  parts.push('Grand Canyon tour from Las Vegas.');
      break;
    case 'hoover-dam-tours':
      parts.push('Hoover Dam tour with photo stops.');
      break;
    case 'adventure-tours':
      parts.push('Outdoor adventure with gear included.');
      break;
    case 'day-trips':
      if (lower.includes('antelope'))           parts.push('Antelope Canyon & Horseshoe Bend day trip.');
      else if (lower.includes('death valley'))  parts.push('Death Valley day trip from Las Vegas.');
      else if (lower.includes('zion'))          parts.push('Zion National Park day trip.');
      else                                      parts.push('National park day trip from Las Vegas.');
      break;
    case 'helicopter-tours':
      parts.push('Las Vegas Strip helicopter flight.');
      break;
    case 'nightlife':
      parts.push('VIP nightlife with club entry.');
      break;
    case 'shows':
      parts.push('Las Vegas show tickets.');
      break;
    default:
      parts.push('Las Vegas Strip sightseeing.');
  }

  // Format extras
  if (lower.includes('private'))                                   parts.push('Private tour available.');
  else if (lower.includes('hotel pickup') || lower.includes('pickup')) parts.push('Hotel pickup included.');

  // CTA
  parts.push('Book now.');

  let description = parts.join(' ');
  if (description.length > 160) description = description.substring(0, 157) + '...';
  return description;
}

/**
 * Generate keywords - Las Vegas (max 7)
 */
function generateKeywords(tourData, category) {
  const keywords = [];
  const lower = (tourData.title || '').toLowerCase();

  // Base — always
  keywords.push('las vegas tours');

  // Category-driven
  switch (category) {
    case 'grand-canyon-tours':
      keywords.push('grand canyon tour from las vegas');
      if (lower.includes('west rim'))   keywords.push('grand canyon west rim tour');
      if (lower.includes('south rim'))  keywords.push('grand canyon south rim tour');
      if (lower.includes('skywalk'))    keywords.push('grand canyon skywalk');
      if (lower.includes('helicopter')) keywords.push('grand canyon helicopter tour');
      break;
    case 'hoover-dam-tours':
      keywords.push('hoover dam tour');
      keywords.push('hoover dam tour from las vegas');
      break;
    case 'adventure-tours':
      keywords.push('las vegas adventure tour');
      if (lower.includes('atv'))  keywords.push('las vegas atv tour');
      if (lower.includes('zip'))  keywords.push('las vegas zipline');
      break;
    case 'day-trips':
      keywords.push('las vegas day trip');
      if (lower.includes('antelope'))      keywords.push('antelope canyon tour from las vegas');
      if (lower.includes('death valley'))  keywords.push('death valley tour from las vegas');
      if (lower.includes('zion'))          keywords.push('zion national park tour');
      break;
    case 'helicopter-tours':
      keywords.push('las vegas helicopter tour');
      keywords.push('las vegas strip helicopter');
      break;
    case 'nightlife':
      keywords.push('las vegas club crawl');
      keywords.push('las vegas nightlife tour');
      break;
    case 'shows':
      keywords.push('las vegas show tickets');
      break;
    default: // strip-tours
      keywords.push('las vegas strip tour');
      keywords.push('las vegas city tour');
  }

  // Format
  if (lower.includes('private'))     keywords.push('private las vegas tour');
  if (lower.includes('small group')) keywords.push('small group las vegas tour');

  return keywords.slice(0, 7);
}
// vegas-h1-duration-fix
// ============================================================================
// SOURCE-GROUNDING ENFORCEMENT
// Catches proper-noun / entity invention that survives the prompt rules.
//   1) Detect WATCHED entities that are NOT in the tour source.
//   2) If any found, do ONE corrective regeneration that names them explicitly
//      and asks for a clean rewrite (keeps prose grammatical).
//   3) Final deterministic net: drop What-You'll-See bullets whose subject is an
//      unsourced entity, and neutralize known inline phrases.
// Pure cleanup: never adds content, only removes/neutralizes unsourced claims.
// Grows during audit by adding entries to GROUNDING_WATCHLIST.
// ============================================================================

const GROUNDING_WATCHLIST = [
  // term      = canonical lowercase string checked against the source text
  // pattern   = how it appears in the generated markdown
  // replace   = inline replacement when it appears mid-sentence
  // bulletDrop= drop the whole What-You'll-See bullet if this is its subject
  { term: 'mercedes sprinter', pattern: /\b(luxury\s+)?mercedes(?:[-\s]benz)?\s+sprinter\b/gi, replace: 'ground transport' },
  { term: 'sprinter',          pattern: /\b(luxury\s+)?sprinter\s+(van|coach|bus|shuttle)\b/gi, replace: 'ground transport' },
  { term: 'joshua tree',       pattern: /\bjoshua\s+trees?(\s+(forest|national\s+park))?\b/gi,   replace: 'the desert', bulletDrop: true },
  { term: 'bypass bridge',     pattern: /\b(hoover\s+dam\s+)?bypass\s+bridge\b/gi,               replace: '', bulletDrop: true },
  { term: "o'callaghan",       pattern: /\bmike\s+o['’]?callaghan[^.,;\n]*?bridge\b/gi,           replace: '', bulletDrop: true },
  { term: 'cable-stayed',      pattern: /\bcable[-\s]stayed\s*/gi,                                replace: '' },
  { term: 'largest reservoir', pattern: /\b(nevada'?s\s+)?largest\s+reservoir\b/gi,              replace: 'reservoir' },
];

function _reFresh(re) { return new RegExp(re.source, re.flags); }

function _buildSourceText(tourData) {
  return [
    tourData.title || '',
    tourData.description || '',
    ...(tourData.includes || []),
    ...(tourData.highlights || []),
  ].join(' \n ').toLowerCase();
}

function _detectViolations(markdown, sourceText) {
  return GROUNDING_WATCHLIST.filter(w =>
    !sourceText.includes(w.term) && _reFresh(w.pattern).test(markdown)
  );
}

async function _correctiveRegen(markdown, tourData, violations) {
  const banned = [...new Set(violations.map(v => v.term))];
  const sourceBlock = [
    `TITLE: ${tourData.title || ''}`,
    `DESCRIPTION: ${tourData.description || ''}`,
    `INCLUDED: ${(tourData.includes || []).join('; ') || 'Not specified'}`,
    `HIGHLIGHTS: ${(tourData.highlights || []).join('; ') || 'Not specified'}`,
  ].join('\n');

  const prompt = `You are a fact-checking editor. The DRAFT below describes a tour, but it names specific entities that DO NOT appear anywhere in the SOURCE. These are hallucinations and must be removed.

ENTITIES TO REMOVE COMPLETELY (not in the source — every mention, in any section, including bullets and FAQ answers):
${banned.map(t => `- ${t}`).join('\n')}

RULES:
- Remove each banned entity and any clause or sentence that exists only to describe it.
- Do NOT swap a removed entity for a different invented name. If a word is needed for flow, use a neutral one ("ground transport", "the route", "the area").
- Change NOTHING else. Keep every other sentence, heading, number, table and bullet exactly as written. Same markdown structure, same section order, same FAQ questions.
- Do not add any new facts, places, vehicles, or color.
- Return ONLY the corrected markdown, with no preamble or commentary.

SOURCE (the only ground truth):
${sourceBlock}

DRAFT:
${markdown}`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });
  return (msg.content?.[0]?.text || markdown).trim();
}

function _deterministicStrip(markdown, violations) {
  const lines = markdown.split('\n');
  const out = [];
  for (const line of lines) {
    const isBullet = /^\s*[-*]\s+/.test(line);
    let drop = false;
    let newLine = line;
    for (const v of violations) {
      if (!_reFresh(v.pattern).test(newLine)) continue;
      if (v.bulletDrop && isBullet) {
        const bold = newLine.match(/\*\*(.+?)\*\*/);
        if (bold && _reFresh(v.pattern).test(bold[1])) { drop = true; break; }
      }
      newLine = newLine.replace(_reFresh(v.pattern), v.replace);
    }
    if (drop) continue;
    out.push(newLine);
  }
  return out.join('\n')
    // tidy grammar artifacts left by inline removals (line-safe: never touch newlines)
    .replace(/\b(through|over|past|via|across|around|along)\s+and\s+(through|over|past|via|across|around|along)\b/gi, '$2')
    .replace(/\b(through|over|past|via|across|around|along)\s+the\s+(in|on|back|to|and)\b/gi, '$2')
    .replace(/\b(through|over|past|via|across|around|along)\s+(and\s+)?(back|to|toward|towards)\b/gi, '$3')
    .replace(/\bground transport\s+ground transport\b/gi, 'ground transport')
    .replace(/\b(in|on|by|via)\s+(a\s+|an\s+)?ground transport\b/gi, 'by ground transport')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')         // collapse runs of spaces/tabs only
    .replace(/[ \t]+([.,;:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]+\n/g, '\n')          // trim trailing spaces on lines
    .replace(/\n{3,}/g, '\n\n');         // cap blank lines (preserves structure)
}

/**
 * Runs after generation, with the source data in hand. Returns cleaned markdown.
 * Safe to call on body+FAQ markdown together.
 */
export async function enforceSourceGrounding(markdown, tourData) {
  console.log('Source-grounding activo: revisando ' + markdown.length + ' chars del body...');
  const sourceText = _buildSourceText(tourData);
  let violations = _detectViolations(markdown, sourceText);
  if (violations.length === 0) return markdown;

  console.log(`Source-grounding: ${violations.length} unsourced entit${violations.length > 1 ? 'ies' : 'y'} -> ${violations.map(v => v.term).join(', ')}`);

  try {
    const corrected = await _correctiveRegen(markdown, tourData, violations);
    const stillBad = _detectViolations(corrected, sourceText);
    if (stillBad.length === 0) {
      console.log('   Corrective regen: clean');
      return corrected;
    }
    markdown = corrected;
    violations = stillBad;
    console.log(`   Corrective regen left ${violations.length} -> deterministic strip`);
  } catch (e) {
    console.log(`   Corrective regen failed (${e.message}); deterministic strip only`);
  }

  const stripped = _deterministicStrip(markdown, violations);
  const residual = _detectViolations(stripped, sourceText);
  if (residual.length) console.log(`   WARNING residual after strip: ${residual.map(v => v.term).join(', ')}`);
  return stripped;
}