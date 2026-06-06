import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DRY_RUN = process.env.DRY_RUN === 'true';
const DELAY_MS = 2000;

// ========================================
// PHRASES THAT APPEAR 3+ TIMES — NEED FIXING
// ========================================
const REPEATED_PHRASES = [
  // Guide quality (appears 10+ times in various forms)
  'narrator consistency varies',
  'guide rotation means uneven delivery',
  'some narrators shine brighter',
  'quality depends on which guide',
  'guide variability',
  // Physical demands (appears 6+ times)
  'bring walking stamina',
  'sturdy footwear essential',
  'comfortable shoes mandatory',
  'covers serious ground',
  // Depth language (appears 8+ times)
  'survey course rather than seminar',
  'more highlight reel than deep study',
  'storytelling depth',
  // "To life" pattern (appears 6+ times)
  'ancient stones into',
  'brings ancient stones',
  'bring ancient stones',
  'stones to life',
  'stones into vivid',
  'to vivid life',
  'come to life',
  'comes to life',
  // Availability (appears 5+ times)
  'summer availability disappears',
  'summer bookings fill',
  'peak-season slots',
  'fill quickly',
  'fills fast',
  'disappears quickly',
  'book weeks ahead',
  // Group size (appears 4+ times)
  'bigger groups water down',
  'larger groups dilute',
  'intimacy fades above',
  // Perfect for pattern (appears 15+ times)
  'perfect for:',
  'perfect match for:',
  'perfect fit:',
  // Other repeated structures
  'without sharing your guide',
  'the kind of tour that',
  'ruins into living stories',
  'most assume',
  'built around',
  'best for:',
  // New patterns from cleanup v1
  'smart choice for:',
  'smart choice for',
  'some sessions outperform others',
  'guide assignment is a lottery',
  'advance booking matters',
  'hits the highlights briskly',
  'vertical terrain ahead',
];


// ========================================
// FETCH ALL REVIEWED TOURS
// ========================================
async function fetchReviewedTours() {
  const query = `*[_type == "post" && defined(editorialReview) && defined(editorialRating)] | order(title asc) {
    _id,
    title,
    slug,
    seoDescription,
    editorialRating,
    editorialReview,
    editorialDate,
    tourInfo { duration, price, currency, location },
    tourFeatures { freeCancellation, skipTheLine, wheelchairAccessible, smallGroupAvailable, hostGuide, audioGuide },
    getYourGuideData { rating, reviewCount, provider },
    category->{ title }
  }`;
  return await sanityClient.fetch(query);
}


// ========================================
// DETECT REPETITIONS
// ========================================
function detectRepetitions(tours) {
  // First pass: count how many times each phrase appears across ALL reviews
  const globalCounts = {};
  for (const phrase of REPEATED_PHRASES) {
    globalCounts[phrase] = 0;
    for (const tour of tours) {
      if (tour.editorialReview.toLowerCase().includes(phrase)) {
        globalCounts[phrase]++;
      }
    }
  }

  // Only flag phrases that appear 3+ times globally
  const problematicPhrases = Object.entries(globalCounts)
    .filter(([_, count]) => count >= 3)
    .map(([phrase]) => phrase);

  console.log('PROBLEMATIC PHRASES (3+ occurrences):');
  for (const phrase of problematicPhrases) {
    console.log('  ' + globalCounts[phrase] + 'x  "' + phrase + '"');
  }
  console.log('');

  // Second pass: for each problematic phrase, only flag reviews BEYOND the first 2 occurrences
  // This keeps some natural repetition but eliminates the template feel
  const phraseSeen = {};
  for (const phrase of problematicPhrases) {
    phraseSeen[phrase] = 0;
  }

  const flagged = [];
  for (const tour of tours) {
    const reviewLower = tour.editorialReview.toLowerCase();
    const matchesInThisTour = [];

    for (const phrase of problematicPhrases) {
      if (reviewLower.includes(phrase)) {
        phraseSeen[phrase]++;
        // Allow first 2 uses, flag the rest
        if (phraseSeen[phrase] > 2) {
          matchesInThisTour.push(phrase);
        }
      }
    }

    if (matchesInThisTour.length > 0) {
      flagged.push({ tour, matches: matchesInThisTour });
    }
  }

  return flagged;
}


// ========================================
// COLLECT ALL EXISTING REVIEWS FOR CONTEXT
// ========================================
function buildExistingReviewsList(tours, excludeId) {
  // Send a sample of other reviews so Claude knows what to avoid
  const others = tours
    .filter(t => t._id !== excludeId)
    .slice(0, 10)
    .map(t => '- "' + t.editorialReview.substring(0, 100) + '..."');
  return others.join('\n');
}


// ========================================
// RE-GENERATE REVIEW
// ========================================
async function regenerateReview(tour, matches, allTours) {
  const features = [];
  if (tour.tourFeatures?.skipTheLine) features.push('skip-the-line access');
  if (tour.tourFeatures?.freeCancellation) features.push('free cancellation');
  if (tour.tourFeatures?.smallGroupAvailable) features.push('small group option');
  if (tour.tourFeatures?.wheelchairAccessible) features.push('wheelchair accessible');
  if (tour.tourFeatures?.hostGuide) features.push('guide in ' + tour.tourFeatures.hostGuide);
  if (tour.tourFeatures?.audioGuide) features.push('audio guide in ' + tour.tourFeatures.audioGuide);

  const gygRating = tour.getYourGuideData?.rating || 'N/A';
  const gygReviews = tour.getYourGuideData?.reviewCount || 0;
  const provider = tour.getYourGuideData?.provider || 'Unknown';
  const duration = tour.tourInfo?.duration || 'N/A';
  const category = tour.category?.title || 'Rome';

  const bannedExact = matches.map(m => '"' + m + '"').join(', ');
  const otherReviews = buildExistingReviewsList(allTours, tour._id);

  const prompt = [
    'You are rewriting a Rome tour micro-review for colosseumroman.com.',
    'The current review has overused phrases shared with other reviews on the site.',
    '',
    'TOUR: ' + tour.title,
    'CONTEXT: ' + category + ' | ' + duration + ' | ' + provider,
    'TRAVELERS SAY: ' + gygRating + '/5 across ' + gygReviews + ' reviews',
    'FEATURES: ' + (features.length > 0 ? features.join(', ') : 'Standard guided tour'),
    'ABOUT: ' + (tour.seoDescription || 'Guided tour in Rome'),
    '',
    'CURRENT REVIEW: "' + tour.editorialReview + '"',
    'CURRENT RATING: ' + tour.editorialRating,
    '',
    'OVERUSED PHRASES TO ELIMINATE: ' + bannedExact,
    '',
    'SAMPLE OF OTHER REVIEWS ON THE SITE (avoid sounding like these):',
    otherReviews,
    '',
    'GLOBAL BAN LIST — none of these may appear:',
    '"narrator consistency varies", "guide rotation means uneven delivery",',
    '"some narrators shine brighter", "quality depends on which guide",',
    '"bring walking stamina", "sturdy footwear essential", "comfortable shoes",',
    '"survey course rather than seminar", "more highlight reel than deep study",',
    '"storytelling depth", "ancient stones into", "stones to life", "to vivid life",',
    '"summer availability disappears", "summer bookings fill", "fill quickly",',
    '"fills fast", "disappears quickly", "book weeks ahead", "peak-season slots",',
    '"bigger groups water down", "larger groups dilute", "intimacy fades above",',
    '"perfect for:", "perfect match for:", "perfect fit:",',
    '"the kind of tour that", "ruins into living", "built around", "most assume",',
    '"outstanding", "exceptional", "must-see", "hidden gem", "unique experience",',
    '"we appreciate", "we recommend", "we love",',
    '"smart choice for:", "smart choice for",',
    '"some sessions outperform others", "guide assignment is a lottery",',
    '"advance booking matters", "hits the highlights briskly", "vertical terrain ahead",',
    'any dollar amount, any booking platform name',
    '',
    'REWRITE RULES:',
    '- Keep the SAME rating: ' + tour.editorialRating,
    '- Keep the same general angle and meaning',
    '- 3-4 sentences, max 350 characters',
    '- End with a traveler verdict. Pick ONE from this list, never reuse across reviews:',
    '  "Ideal match:", "Suited to:", "A strong pick for:",',
    '  "The right call for:", "Made for:", "Where it clicks:",',
    '  "Lands best with:", "Prime pick:", "Tailored for:",',
    '  "Built for:", "Aimed at:", "Works best for:"',
    '- Confident editorial voice, dry, no hype',
    '- Use COMPLETELY FRESH language — imagine you have never written a tour review before',
    '- For guide quality: try "not every guide delivers equally", "your narrator shapes the experience",',
    '  "guide roster is uneven", "depends entirely on who leads your group"',
    '- For physical demands: try "not a flat stroll", "expect inclines and rough ground",',
    '  "prepare for ancient terrain", "demanding on the legs"',
    '- For depth: try "overview pace, not a lecture", "broad strokes rather than fine detail",',
    '  "designed for breadth", "coverage over immersion"',
    '- For availability: try "high demand narrows options", "reserve early during tourist season",',
    '  "last-minute bookings rarely work", "popular dates fill ahead of time"',
    '- For group size: try "crowd density affects quality", "numbers matter here",',
    '  "fewer people equals sharper focus", "headcount shapes the experience"',
    '',
    'RESPOND EXACTLY:',
    'RATING: [same number]',
    'REVIEW: [rewritten text]',
  ].join('\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const response = message.content[0].text;
    const ratingMatch = response.match(/RATING:\s*([\d.]+)/);
    const reviewMatch = response.match(/REVIEW:\s*(.+)/s);

    if (!ratingMatch || !reviewMatch) {
      console.error('   Failed to parse response');
      return null;
    }

    let rating = parseFloat(ratingMatch[1]);
    const review = reviewMatch[1].trim().replace(/\n/g, ' ');
    rating = Math.max(4, Math.min(5, Math.round(rating * 2) / 2));

    // Check for remaining banned phrases
    const reviewLower = review.toLowerCase();
    const stillBanned = REPEATED_PHRASES.filter(p => reviewLower.includes(p));
    if (stillBanned.length > 0) {
      console.log('   WARNING: Still contains: ' + stillBanned.join(', '));
    }

    return { rating, review };
  } catch (error) {
    console.error('   API error: ' + error.message);
    return null;
  }
}


// ========================================
// UPDATE SANITY
// ========================================
async function updateReview(tourId, rating, review) {
  const today = new Date().toISOString().split('T')[0];
  if (DRY_RUN) {
    console.log('   DRY RUN — would update');
    return true;
  }
  try {
    await sanityClient.patch(tourId)
      .set({ editorialRating: rating, editorialReview: review, editorialDate: today })
      .commit();
    return true;
  } catch (error) {
    console.error('   Sanity error: ' + error.message);
    return false;
  }
}


// ========================================
// MAIN
// ========================================
async function main() {
  console.log('');
  console.log('ColosseumRoman Review Cleanup v2');
  console.log('Mode: ' + (DRY_RUN ? 'DRY RUN' : 'PRODUCTION'));
  console.log('='.repeat(60));

  const tours = await fetchReviewedTours();
  console.log('\nFound ' + tours.length + ' reviews\n');

  const flagged = detectRepetitions(tours);
  console.log('Flagged ' + flagged.length + ' reviews for rewriting\n');

  if (flagged.length === 0) {
    console.log('All reviews are clean!');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < flagged.length; i++) {
    const { tour, matches } = flagged[i];

    console.log('[' + (i + 1) + '/' + flagged.length + '] ' + tour.title);
    console.log('   FIXING: ' + matches.join(' | '));
    console.log('   OLD: "' + tour.editorialReview.substring(0, 90) + '..."');

    const result = await regenerateReview(tour, matches, tours);

    if (result) {
      console.log('   NEW: "' + result.review.substring(0, 90) + '..."');

      const updated = await updateReview(tour._id, result.rating, result.review);
      if (updated) {
        success++;
        console.log('   OK\n');
      } else {
        failed++;
      }
    } else {
      failed++;
      console.log('   FAILED\n');
    }

    if (i < flagged.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('='.repeat(60));
  console.log('DONE — Fixed: ' + success + ' | Failed: ' + failed);
  console.log('='.repeat(60));
  console.log('');
  console.log('Run again to check for remaining repetitions.');
}

main().catch(console.error);