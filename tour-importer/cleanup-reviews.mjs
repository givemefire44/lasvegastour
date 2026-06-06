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
// REPEATED PHRASES TO DETECT
// ========================================
const REPEATED_PHRASES = [
  'quality depends on which guide you draw',
  'the kind of tour that actually makes',
  'the kind of tour that makes',
  'more highlight reel than deep study',
  'covers serious ground',
  'comfortable shoes mandatory',
  'peak-season slots vanish fast',
  'peak-season slots disappear',
  'stairs and uneven terrain rule out',
  'early morning departure is not for everyone',
  'larger groups dilute the intimacy',
  'ruins into living stories',
  'guide variability means',
];


// ========================================
// FETCH ALL TOURS WITH REVIEWS
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
    tourInfo {
      duration,
      price,
      currency,
      location
    },
    tourFeatures {
      freeCancellation,
      skipTheLine,
      wheelchairAccessible,
      smallGroupAvailable,
      hostGuide,
      audioGuide
    },
    getYourGuideData {
      rating,
      reviewCount,
      provider
    },
    category->{
      title
    }
  }`;

  return await sanityClient.fetch(query);
}


// ========================================
// DETECT WHICH REVIEWS NEED FIXING
// ========================================
function detectRepetitions(tours) {
  const flagged = [];

  for (const tour of tours) {
    const review = tour.editorialReview.toLowerCase();
    const matches = REPEATED_PHRASES.filter(phrase => review.includes(phrase));

    if (matches.length > 0) {
      flagged.push({
        tour,
        matches,
      });
    }
  }

  return flagged;
}


// ========================================
// RE-GENERATE A SINGLE REVIEW
// ========================================
async function regenerateReview(tour, matches, index) {
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

  const bannedList = matches.map(m => '"' + m + '"').join(', ');

  const prompt = [
    'Senior travel editor rewriting a tour review for colosseumroman.com.',
    '',
    'TOUR: ' + tour.title,
    'CONTEXT: ' + category + ' | ' + duration + ' | ' + provider,
    'TRAVELERS SAY: ' + gygRating + '/5 across ' + gygReviews + ' reviews',
    'FEATURES: ' + (features.length > 0 ? features.join(', ') : 'Standard guided tour'),
    'ABOUT: ' + (tour.seoDescription || 'Guided tour in Rome'),
    '',
    'CURRENT REVIEW (needs rewriting):',
    '"' + tour.editorialReview + '"',
    '',
    'CURRENT RATING: ' + tour.editorialRating,
    '',
    'PROBLEM: This review contains overused phrases that appear across multiple reviews.',
    'These EXACT phrases are BANNED and must NOT appear in the rewrite:',
    bannedList,
    '',
    'Also globally banned:',
    '"quality depends on which guide", "the kind of tour that", "more highlight reel",',
    '"covers serious ground", "comfortable shoes mandatory", "peak-season slots",',
    '"stairs and uneven terrain", "early morning departure is not for everyone",',
    '"larger groups dilute", "ruins into living stories", "guide variability means",',
    '"outstanding", "exceptional", "must-see", "hidden gem", "unique experience",',
    '"we appreciate", "we recommend", "we love", "Built around", "Most assume",',
    'any dollar amount, any platform name',
    '',
    'REWRITE the review keeping:',
    '- Same rating (' + tour.editorialRating + ')',
    '- Same general meaning and angle',
    '- Same length (3-4 sentences, max 350 chars)',
    '- Same "Best for" / verdict style ending',
    '- Editorial voice: confident, dry, no hype',
    '',
    'Use FRESH language. Find new ways to express:',
    '- Guide quality issues -> "narrator consistency varies", "some guides shine brighter", "guide rotation means uneven delivery"',
    '- Tour pace -> "moves at a clip", "brisk but not breathless", "keeps energy up without sprinting"',
    '- Physical demands -> "expect elevation changes", "bring walking stamina", "not a flat stroll"',
    '- Crowd issues -> "morning timing helps dodge the masses", "timed entry thins the herd"',
    '- Depth vs breadth -> "overview format, not a deep cut", "survey course rather than seminar"',
    '- Scheduling -> "not built for late risers", "requires an early alarm"',
    '- Group size -> "bigger groups water down the experience", "intimacy fades above 15 people"',
    '',
    'RESPOND EXACTLY:',
    'RATING: [same as current]',
    'REVIEW: [rewritten text]',
  ].join('\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const response = message.content[0].text;

    const ratingMatch = response.match(/RATING:\s*([\d.]+)/);
    const reviewMatch = response.match(/REVIEW:\s*(.+)/s);

    if (!ratingMatch || !reviewMatch) {
      console.error('   Failed to parse response for: ' + tour.title);
      return null;
    }

    let rating = parseFloat(ratingMatch[1]);
    const review = reviewMatch[1].trim().replace(/\n/g, ' ');

    rating = Math.max(4, Math.min(5, Math.round(rating * 2) / 2));

    // Verify no banned phrases remain
    const reviewLower = review.toLowerCase();
    const stillBanned = REPEATED_PHRASES.filter(p => reviewLower.includes(p));
    if (stillBanned.length > 0) {
      console.log('   WARNING: Still contains banned phrases: ' + stillBanned.join(', '));
    }

    return { rating, review };
  } catch (error) {
    console.error('   API error: ' + error.message);
    return null;
  }
}


// ========================================
// UPDATE IN SANITY
// ========================================
async function updateReview(tourId, rating, review) {
  const today = new Date().toISOString().split('T')[0];

  if (DRY_RUN) {
    console.log('   DRY RUN — would update ' + tourId);
    return true;
  }

  try {
    await sanityClient.patch(tourId)
      .set({
        editorialRating: rating,
        editorialReview: review,
        editorialDate: today,
      })
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
  console.log('ColosseumRoman Review Cleanup Script');
  console.log('Mode: ' + (DRY_RUN ? 'DRY RUN' : 'PRODUCTION'));
  console.log('─'.repeat(60));

  // 1. Fetch all reviewed tours
  const tours = await fetchReviewedTours();
  console.log('\nFound ' + tours.length + ' tours with reviews');

  // 2. Detect repetitions
  const flagged = detectRepetitions(tours);
  console.log('Flagged ' + flagged.length + ' reviews with repeated phrases\n');

  if (flagged.length === 0) {
    console.log('All reviews are clean!');
    return;
  }

  // 3. Show what needs fixing
  console.log('REVIEWS TO FIX:');
  console.log('─'.repeat(60));
  for (const item of flagged) {
    console.log('  ' + item.tour.title);
    console.log('  Repeated: ' + item.matches.join(' | '));
    console.log('');
  }
  console.log('─'.repeat(60));

  // 4. Re-generate
  let success = 0;
  let failed = 0;

  for (let i = 0; i < flagged.length; i++) {
    const { tour, matches } = flagged[i];

    console.log('[' + (i + 1) + '/' + flagged.length + '] ' + tour.title);
    console.log('   OLD: "' + tour.editorialReview.substring(0, 80) + '..."');
    console.log('   Fixing: ' + matches.join(', '));

    const result = await regenerateReview(tour, matches, i);

    if (result) {
      console.log('   NEW: "' + result.review.substring(0, 80) + '..."');
      console.log('   Rating: ' + result.rating + '/5');

      const updated = await updateReview(tour._id, result.rating, result.review);
      if (updated) {
        success++;
        console.log('   Saved!\n');
      } else {
        failed++;
        console.log('   Failed to save\n');
      }
    } else {
      failed++;
      console.log('   Failed to generate\n');
    }

    if (i < flagged.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // 5. Summary
  console.log('─'.repeat(60));
  console.log('CLEANUP SUMMARY');
  console.log('   Fixed:  ' + success);
  console.log('   Failed: ' + failed);
  console.log('   Total:  ' + (success + failed));
  console.log('─'.repeat(60));
}

main().catch(console.error);