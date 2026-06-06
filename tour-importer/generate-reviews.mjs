import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@sanity/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ========================================
// CONFIGURACIÓN
// ========================================
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
const LIMIT = parseInt(process.env.LIMIT) || 999;
const DELAY_MS = 2000;


// ========================================
// FETCH ALL TOURS FROM SANITY
// ========================================
async function fetchAllTours() {
  const query = `*[_type == "post"] | order(title asc) {
    _id,
    title,
    slug,
    seoTitle,
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
// GENERATE EDITORIAL REVIEW WITH CLAUDE
// ========================================
async function generateReview(tour, index, total) {
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
  const price = tour.tourInfo?.price ? ('$' + tour.tourInfo.price) : 'N/A';
  const duration = tour.tourInfo?.duration || 'N/A';
  const location = tour.tourInfo?.location || 'Rome';
  const category = tour.category?.title || 'Rome';

  const openingStyles = [
    'Start with what makes this tour unique compared to alternatives.',
    'Start with who this tour is best suited for.',
    'Start with the standout experience or highlight of this tour.',
    'Start with the value proposition.',
    'Start with a practical insight that helps travelers decide.',
    'Start with what surprised you most about this tour offering.',
    'Start with the key differentiator from similar tours.',
    'Start by addressing the most common question travelers have about this type of tour.',
  ];

  const openingStyle = openingStyles[index % openingStyles.length];

  const openingForm = (index % 6) + 1;
  const tradeoffCat = (index % 8) + 1;
  const travelerType = (index % 20) + 1;
  const addEmotion = (index % 5 === 2 || index % 5 === 4);

  const arenaDescriptions = [
    'ground-level perspective',
    'arena-level access',
    'sand-level vantage point',
    'the view from the combat floor',
    'on the arena platform itself',
    'the reconstructed floor section',
  ];
  const arenaDesc = arenaDescriptions[index % arenaDescriptions.length];

  const verdictPhrases = [
    'Best for:', 'Ideal match:', 'Suited to:', 'A strong pick for:',
    'The right call for:', 'Book this if you are:', 'This one belongs to:',
    'Made for:', 'Where it clicks:', 'Lands best with:',
  ];
  const verdictPhrase = verdictPhrases[index % verdictPhrases.length];

  const emotionLine = addEmotion
    ? 'Drop ONE human/emotional line like "The kind of tour that actually makes the Colosseum feel alive" or "We have walked this route dozens of times and this guide made us stop and look up." Just one.'
    : 'Stay analytical and editorial. No emotional lines.';

  const prompt = [
    'Senior travel editor, colosseumroman.com. Micro-review #' + (index + 1) + ' of ' + total + '.',
    '',
    'TOUR: ' + tour.title,
    'CONTEXT: ' + category + ' | ' + duration + ' | ' + provider,
    'TRAVELERS SAY: ' + gygRating + '/5 across ' + gygReviews + ' reviews',
    'FEATURES: ' + (features.length > 0 ? features.join(', ') : 'Standard guided tour'),
    'ABOUT: ' + (tour.seoDescription || 'Guided tour in Rome'),
    '',
    'YOUR ANGLE: ' + openingStyle,
    '',
    'IMPORTANT: Do NOT default to mentioning arena floor access. Only mention it if the tour explicitly includes it AND only in ~1 out of every 4 reviews. Most reviews should focus on other differentiators: guide quality, narrative depth, pacing, group size control, route design, provider reputation, scheduling advantage, or crowd management.',
    '',
    'STRUCTURE (3-4 sentences, invisible framework):',
    '',
    '1. OPENING — Use form #' + openingForm + ' from this list:',
    '   1: Conditional — "If [situation], this is where to look"',
    '   2: Problem-first — name a frustration this solves',
    '   3: Provider-led — what the operator does differently',
    '   4: Scope statement — "Prioritizes [X] over [Y]" / "Designed around [X], less about [Y]"',
    '   5: Contrarian — challenge an assumption',
    '   6: Mid-thought — jump in casually, no setup',
    '   HARD BAN: "Built around", "Most assume", "Most Rome tours", "Most visitors"',
    '',
    '2. DIFFERENTIATOR + TRADE-OFF — Use trade-off category #' + tradeoffCat + ':',
    '   1: Walking intensity ("Covers serious ground — comfortable shoes mandatory")',
    '   2: Availability ("Peak-season slots vanish fast")',
    '   3: Crowd reality ("Skip-the-line gets you in, not away from groups inside")',
    '   4: Guide variability ("Quality depends on which guide you draw")',
    '   5: Time allocation ("More highlight reel than deep study")',
    '   6: Physical access ("Stairs and uneven terrain rule out some travelers")',
    '   7: Scheduling ("Early morning departure is not for everyone")',
    '   8: Group dynamics ("Larger groups dilute the intimacy")',
    '   HARD BAN: "feels compressed", "feels rushed", "skims surface", "Forum coverage"',
    '',
    '3. VERDICT — End with a closing line for this specific traveler profile:',
    '   "' + [
      'couples on a short Rome stopover',
      'repeat visitors who already know the highlights',
      'architecture and engineering enthusiasts',
      'photo-focused travelers chasing golden hour',
      'families with teens old enough to engage',
      'budget-conscious travelers maximizing access',
      'history deep-divers who read before they travel',
      'travelers with only one day in Rome',
      'small groups wanting a semi-private feel',
      'solo travelers who prefer structured itineraries',
      'educators or students studying Roman history',
      'elderly travelers who need a manageable pace',
      'cruise passengers on a tight port-day schedule',
      'archaeology buffs who want below-surface access',
      'art lovers connecting Roman and Renaissance periods',
      'travelers who already did a basic Colosseum visit and want more',
      'parents with kids under 10 who need engagement',
      'corporate groups looking for a cultural team outing',
      'night owls who prefer evening atmosphere over daytime crowds',
      'skeptics who think all Rome tours are interchangeable',
    ][index % 20] + '"',
    '   Use varied phrasing — for THIS review use exactly: "' + verdictPhrase + '"',
    '   NEVER use "Best for:" two reviews in a row. NEVER use "Perfect for".',
    '',
    'VOICE:',
    '- Confident, dry, editorial. No hype.',
    '- ' + emotionLine,
    '- ZERO prices, dollar amounts, cost references',
    '- No platform names',
    '- Almost no "we"',
    '',
    'HARD BANNED:',
    '"Built around", "solid half-day", "unlike standard", "elevates", "sets apart",',
    '"perfect for", "premium pick", "outstanding", "exceptional", "must-see",',
    '"hidden gem", "unique experience", "cattle herding", "Most assume",',
    '"first-time visitors" (use specific profiles instead),',
    '"standing where gladiators fought", "walk where gladiators", "stood where gladiators",',
    '"step where gladiators", "ground-level perspective", "arena-level access" — if you must',
    'reference arena floor, use fresh language each time, but prefer other angles entirely.',
    '"Covers serious ground", "comfortable shoes mandatory", "Peak-season slots vanish fast",',
    '"Quality depends on which guide you draw", "ruins into living stories",',
    'any price/dollar, any platform name, "we appreciate/recommend/love"',
    '',
    'MAX 350 characters. English only.',
    '',
    'RATING:',
    '- 4.0 = good, real trade-off (~30%)',
    '- 4.5 = strong differentiator (~50%)',
    '- 5.0 = category-best, max 2 per 10',
    '',
    'RESPOND EXACTLY:',
    'RATING: [number]',
    'REVIEW: [text]',
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
      console.error('   Response: ' + response);
      return null;
    }

    let rating = parseFloat(ratingMatch[1]);
    const review = reviewMatch[1].trim().replace(/\n/g, ' ');

    // Clamp rating to 0.5 increments, min 4.0
    rating = Math.max(4, Math.min(5, Math.round(rating * 2) / 2));

    return { rating, review };
  } catch (error) {
    console.error('   API error for ' + tour.title + ': ' + error.message);
    return null;
  }
}


// ========================================
// UPDATE TOUR IN SANITY
// ========================================
async function updateTourReview(tourId, rating, review) {
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
    console.error('   Sanity update error: ' + error.message);
    return false;
  }
}


// ========================================
// MAIN
// ========================================
async function main() {
  console.log('');
  console.log('ColosseumRoman Editorial Review Generator');
  console.log('Mode: ' + (DRY_RUN ? 'DRY RUN (no writes)' : 'PRODUCTION'));
  console.log('Limit: ' + (LIMIT === 999 ? 'ALL' : LIMIT));
  console.log('─'.repeat(60));

  const tours = await fetchAllTours();
  console.log('\nFound ' + tours.length + ' tours total');

  const toursNeedingReview = tours.filter(t => {
    if (t.editorialReview && t.editorialRating) return false;
    if (!t.tourInfo?.price && !t.tourInfo?.duration && !t.getYourGuideData?.rating) {
      console.log('   Skipping "' + t.title + '" — no price, duration, or rating data');
      return false;
    }
    return true;
  });

  const toursWithReview = tours.filter(t => t.editorialReview && t.editorialRating);

  console.log(toursWithReview.length + ' tours already have reviews');
  console.log(toursNeedingReview.length + ' tours need reviews');

  if (toursNeedingReview.length === 0) {
    console.log('\nAll tours already have editorial reviews!');
    return;
  }

  const toProcess = toursNeedingReview.slice(0, LIMIT);
  console.log('\nProcessing ' + toProcess.length + ' of ' + toursNeedingReview.length + '\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const tour = toProcess[i];

    console.log('[' + (i + 1) + '/' + toProcess.length + '] ' + tour.title);

    const result = await generateReview(tour, i, toProcess.length);

    if (result) {
      console.log('   Rating: ' + result.rating + '/5');
      console.log('   "' + result.review + '"');

      const updated = await updateTourReview(tour._id, result.rating, result.review);
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

    if (i < toProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('─'.repeat(60));
  console.log('SUMMARY');
  console.log('   Success: ' + success);
  console.log('   Failed:  ' + failed);
  console.log('   Total:   ' + (success + failed));
  console.log('─'.repeat(60));
}

main().catch(console.error);