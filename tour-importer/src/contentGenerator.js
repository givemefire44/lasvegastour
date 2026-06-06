// src/contentGenerator.js - V2 TRANSACTIONAL + GEO OPTIMIZED (Vatican)
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import * as configModule from '../config.js';
import { promptBuilder, getCityDisplayName } from '../templates/post-template.js';

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
  // Protect landmark names (Vatican)
  cleaned = cleaned.replace(/\*\*(?:Vatican Museums|Vatican|Sistine Chapel|St\.? ?Peter[^*]{0,18}|Saint Peter[^*]{0,18}|Michelangelo|Raphael Rooms|Raphael|The Last Judgment|Bernini|Colosseum|Rome|Gallery of Maps)\*\*/g, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  // Protect access types and key features
  cleaned = cleaned.replace(/\*\*(?:skip-the-line|express entry|fast-track|timed entry|priority access|early entry|early access|dome climb|hotel pickup)\*\*/gi, (match) => {
    const placeholder = `__PROTECTED_${protectedItems.length}__`;
    protectedItems.push(match);
    return placeholder;
  });
  // Protect Vatican elements
  cleaned = cleaned.replace(/\*\*(?:Sistine Chapel ceiling|St\.? ?Peter's Dome|Cupola|Pieta|baldachin|Creation of Adam|School of Athens|Pio-Clementino|UNESCO World Heritage)\*\*/gi, (match) => {
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

  // Remove other **bold** and *italic*
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');

  // Restore protected items
  protectedItems.forEach((item, index) => {
    const placeholder = `__PROTECTED_${index}__`;
    cleaned = cleaned.replace(placeholder, item);
  });

  // Remove underscore emphasis
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  console.log('Content cleaned');

  return cleaned;
}

/**
 * Detect combo type from tour data.
 * The Vatican is always in Rome, so what differentiates tours
 * is the combo destination or special format.
 */
function detectCombo(tourData) {
  const text = `${tourData.title || ''} ${tourData.url || ''} ${tourData.description || ''}`.toLowerCase();

  if (text.includes('colosseum') || text.includes('colosseo'))
    return 'Vatican + Colosseum';
  if (text.includes('castel gandolfo') || text.includes('papal palace'))
    return 'Vatican + Castel Gandolfo';
  if (text.includes('garden'))
    return 'Vatican + Gardens';
  if (text.includes('breakfast') || text.includes('brunch'))
    return 'Vatican Breakfast Experience';
  if (text.includes('best of rome') || text.includes('rome in a day')
    || (text.includes('full day') && text.includes('rome')))
    return 'Rome Full Day';
  if (text.includes('dome') || text.includes('cupola'))
    return "Vatican + St. Peter's Dome";

  return 'Vatican';
}

/**
 * Fetch existing tour titles from Sanity (avoid duplicate H1s)
 */
async function fetchExistingTitles() {
  try {
    const titles = await sanityClient.fetch(
      `*[_type == "post"]{title}`
    );
    console.log(`   Found ${titles.length} existing titles`);
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
 * Generate H1 Title — Vatican optimized for maximum variety (LOCAL FALLBACK)
 */
function generateH1Title(tourData) {
  const title = tourData.title || '';
  const lower = title.toLowerCase();

  // --- Group format ---
  const isPrivate     = lower.includes('private');
  const isSmallGroup  = lower.includes('small group') || lower.includes('small-group');
  const isSemiPrivate = lower.includes('semi-private') || lower.includes('semi private');

  // --- Guide type ---
  const isOfficialGuide = lower.includes('official') || lower.includes('certified')
    || lower.includes('expert guide') || lower.includes('art historian') || lower.includes('licensed');
  const isAudioGuide   = lower.includes('audio') || lower.includes('self-guided') || lower.includes('self guided');
  const isTicketOnly   = lower.includes('ticket') && !lower.includes('tour') && !lower.includes('guided');

  // --- Timing ---
  const isExpress  = lower.includes('express') || lower.includes('1-hour') || lower.includes('1 hour');
  const isEarlyAccess = lower.includes('early access') || lower.includes('early entry')
    || lower.includes('early morning') || lower.includes('first entry');
  const isEvening  = lower.includes('evening') || lower.includes('night');
  const isFullDay  = lower.includes('full day') || lower.includes('full-day');
  const isHalfDay  = lower.includes('half day') || lower.includes('half-day');

  // --- Access ---
  const isSkipLine = (lower.includes('skip') && (lower.includes('line') || lower.includes('queue')))
    || lower.includes('fast track') || lower.includes('fast-track');
  const isPriority = lower.includes('priority') || lower.includes('reserved access');
  const isVIP      = lower.includes('vip') || lower.includes('exclusive');

  // --- Audience ---
  const isFamily = lower.includes('family') || lower.includes('kids') || lower.includes('children');

  // --- Features ---
  const hasDome    = lower.includes('dome') || lower.includes('cupola');

  // --- Combos ---
  const hasColosseum    = lower.includes('colosseum') || lower.includes('colosseo');
  const hasCastel       = lower.includes('castel gandolfo');
  const hasGardens      = lower.includes('garden');
  const hasRomeHi       = lower.includes('best of rome') || lower.includes('rome in a day');

  // BUILD H1 with rotated vocabulary
  let parts = [];

  // Base
  parts.push('Vatican');

  // Group format (rotated synonyms)
  if (isPrivate) {
    parts.push(pick(['Private', 'Exclusive', 'Personal']));
  } else if (isSemiPrivate) {
    parts.push('Semi-Private');
  } else if (isSmallGroup) {
    parts.push(pick(['Small Group', 'Intimate Group', 'Boutique']));
  }

  // Access (rotated synonyms)
  if (isSkipLine || isPriority) {
    parts.push(pick(['Skip-the-Line', 'Fast-Track Entry', 'Timed Entry', 'Priority Access']));
  }

  // Timing
  if (isExpress)          parts.push('Express');
  else if (isEarlyAccess) parts.push(pick(['Early Access', 'Early Entry', 'Morning']));
  else if (isEvening)     parts.push('Evening');
  else if (isFullDay)     parts.push('Full-Day');
  else if (isHalfDay)     parts.push('Half-Day');

  // Tour type (rotated synonyms)
  if (isTicketOnly) {
    parts.push('Entry Ticket');
  } else if (isAudioGuide) {
    parts.push(pick(['Self-Guided Audio Tour', 'Audio Guide Visit']));
  } else if (isOfficialGuide) {
    parts.push(pick(['Tour with Official Guide', 'Expert-Led Tour']));
  } else if (isVIP) {
    parts.push('VIP Experience');
  } else {
    parts.push(pick(['Guided Tour', 'Guided Visit', 'Art Tour',
      'Museums Tour', 'Vatican Experience']));
  }

  // Audience
  if (isFamily) parts.push('for Families');

  // Dome access (if not already a combo)
  if (hasDome && !hasColosseum && !hasCastel) {
    parts.push(pick(['+ Dome Climb', '& Cupola Access', '+ Panoramic Dome']));
  }

  // Combo (max 1, prioritized)
  if (hasColosseum)        parts.push('& Colosseum');
  else if (hasCastel)      parts.push('& Castel Gandolfo');
  else if (hasGardens)     parts.push('& Gardens');
  else if (hasRomeHi)      parts.push('— Rome Highlights');

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
 */
export async function generateTourContent(tourData) {
  console.log('\nGenerating content V2 (Transactional + GEO)...');

  try {
    const combo = detectCombo(tourData);
    console.log(`Tour type: ${combo}`);

    // Fetch existing titles to avoid duplicate H1s
    const existingTitles = await fetchExistingTitles();

    // Prepare structured data for Claude
    const structuredData = {
      city: 'Vatican',
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
      existingTitles
    };

    const prompt = promptBuilder(structuredData);

    console.log('Waiting for Claude response...');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
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
      .replace(/\s+[\d.]+-hour/gi, '')      // remove duration from title
      .replace(/\s+\d+\s*hour/gi, '')
      .replace(/\s+\d+-minute/gi, '')
      .replace(/\s+\d+\s*minute/gi, '')
      .trim()
      .substring(0, 60);

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

      const reviewPrompt = `Write an editorial review for a Vatican tour in Rome (Vatican Museums, Sistine Chapel, St. Peter's Basilica). Write as a real editorial team, not an AI template.

      Part 1 (2 sentences): What the tour delivers in practical terms. First sentence: what the visitor gets (access type + guided experience). Second sentence: one specific operational detail from the tour data ONLY — do NOT invent group sizes or visitor counts.

      Part 2 (1-2 sentences): One honest limitation stated naturally — not harshly. Frame it as context, not criticism. Example: "The dome climb is not included and requires a separate ticket, but for most first-time visitors this covers everything needed for a well-structured visit."

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
      - Soften limitations naturally ("is not included, but..." not "The experience lacks...")
      - NO "Smart choice for:" format — use "Best for" naturally in a sentence
      - NO generic phrases: "exceptional value", "authentic experience", "unforgettable", "architectural wonder", "breathtaking", "must-see", "hidden gems"
      - Use correct names: Vatican Museums (museum), Sistine Chapel (chapel, never a "museum"), St. Peter's Basilica.

      OPENING SENTENCE: Must feel natural. Vary each time:
      (a) Lead with access advantage
      (b) Lead with what the visitor avoids
      (c) Lead with the guide's expertise
      (d) Lead with the group format
      (e) Lead with a specific artwork (Sistine ceiling, Raphael Rooms, Pieta)
      (f) Lead with timing advantage
      (g) Lead with the Sistine-to-Basilica connecting door
      (h) Lead with cost-value

      Tour: ${tourData.title}
      Location: Vatican City, Rome
      Price: $${tourData.price || 'N/A'}
      Duration: ${tourData.duration || 'N/A'}
      GYG Rating: ${gygRating}/5 (${tourData.reviewCount || 0} reviews)
      Provider: ${tourData.provider || 'N/A'}

      Respond with ONLY the review text. No quotes, no labels, no "Part 1/2/3" headers.`;

      const reviewMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        temperature: 0.5,
        messages: [{ role: 'user', content: reviewPrompt }]
      });
      editorialReview = reviewMsg.content[0].text.trim();
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
      city: 'Rome',
      rawContent: cleanContent
    };

  } catch (error) {
    console.error('Error generating content:', error.message);
    throw error;
  }
}

/**
 * Generate SEO Description - Vatican
 */
function generateSEODescription(tourData, combo) {
  const { rating, price, duration, title } = tourData;
  const lower = (title || '').toLowerCase();

  let parts = [];

  // Hard data first
  if (price && duration) {
    parts.push(`$${price} ${duration} Vatican tour.`);
  } else if (price) {
    parts.push(`From $${price} — Vatican tour.`);
  } else {
    parts.push(`Vatican guided tour in Rome.`);
  }

  // Rating
  if (rating && rating >= 4.5) {
    parts.push(`Rated ${rating}/5.`);
  }

  // Key feature
  if (lower.includes('private'))              parts.push('Private tour with dedicated guide.');
  else if (lower.includes('small group'))     parts.push('Small group experience.');
  else if (lower.includes('skip'))            parts.push('Skip-the-line timed entry.');
  else if (lower.includes('early'))           parts.push('Early access before crowds.');
  else if (lower.includes('evening') || lower.includes('night')) parts.push('Evening Museums visit.');
  else if (lower.includes('family') || lower.includes('kids'))   parts.push('Family-friendly with kids activities.');
  else if (lower.includes('official'))        parts.push('Led by an official guide.');
  else if (lower.includes('audio') || lower.includes('self-guided')) parts.push('Self-paced audio guide included.');
  else if (lower.includes('dome') || lower.includes('cupola'))   parts.push('Includes St. Peter\'s Dome climb.');

  // Combo
  if (combo.includes('Colosseum'))            parts.push('Includes Colosseum entry.');
  else if (combo.includes('Castel Gandolfo')) parts.push('Includes Castel Gandolfo.');
  else if (combo.includes('Gardens'))         parts.push('Includes Vatican Gardens.');
  else if (combo.includes('Breakfast'))       parts.push('Breakfast in the Vatican included.');
  else if (combo.includes('Dome'))            parts.push('St. Peter\'s Dome access.');

  // CTA
  parts.push('Book now.');

  let description = parts.join(' ');
  if (description.length > 160) description = description.substring(0, 157) + '...';
  return description;
}

/**
 * Generate keywords - Vatican (max 7)
 */
function generateKeywords(tourData, combo) {
  const keywords = [];
  const lower = (tourData.title || '').toLowerCase();

  // Base — always
  keywords.push('vatican tour');
  keywords.push('vatican museums tour');

  // Format
  if (lower.includes('private'))          keywords.push('vatican private tour');
  if (lower.includes('small group'))      keywords.push('vatican small group tour');
  if (lower.includes('skip'))             keywords.push('vatican skip the line');
  if (lower.includes('early'))            keywords.push('vatican early access');
  if (lower.includes('family') || lower.includes('kids')) keywords.push('vatican tour for families');
  if (lower.includes('evening') || lower.includes('night')) keywords.push('vatican evening tour');
  if (lower.includes('audio') || lower.includes('self-guided')) keywords.push('vatican audio guide');
  if (lower.includes('official'))         keywords.push('vatican official guide tour');

  // Features
  if (lower.includes('sistine'))          keywords.push('sistine chapel tour');
  if (lower.includes('dome') || lower.includes('cupola')) keywords.push('st peters dome climb');
  if (lower.includes('basilica') || lower.includes('peter')) keywords.push('st peters basilica tour');

  // Combos
  if (combo.includes('Colosseum'))        keywords.push('vatican colosseum combo');
  if (combo.includes('Castel'))           keywords.push('castel gandolfo tour');

  // General
  keywords.push('vatican tickets');

  return keywords.slice(0, 7);
}