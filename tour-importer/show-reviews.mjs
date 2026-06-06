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

async function main() {
  const query = `*[_type == "post" && defined(editorialReview) && defined(editorialRating)] | order(title asc) {
    title,
    editorialRating,
    editorialReview,
    editorialDate,
    getYourGuideData {
      rating,
      reviewCount
    },
    category->{
      title
    }
  }`;

  const tours = await sanityClient.fetch(query);

  console.log('');
  console.log('ColosseumRoman EDITORIAL REVIEWS — FULL ANALYSIS');
  console.log('Total: ' + tours.length + ' reviews');
  console.log('='.repeat(70));

  // Stats
  const ratings = { '4': 0, '4.5': 0, '5': 0 };
  const phrases = {};

  for (let i = 0; i < tours.length; i++) {
    const t = tours[i];
    const cat = t.category?.title || 'Uncategorized';

    console.log('');
    console.log('[' + (i + 1) + '] ' + t.title);
    console.log('    Category: ' + cat + ' | Rating: ' + t.editorialRating + '/5 | Date: ' + (t.editorialDate || 'N/A'));
    console.log('    GYG: ' + (t.getYourGuideData?.rating || 'N/A') + '/5 (' + (t.getYourGuideData?.reviewCount || 0) + ' reviews)');
    console.log('    "' + t.editorialReview + '"');
    console.log('    Chars: ' + t.editorialReview.length);
    console.log('-'.repeat(70));

    // Count ratings
    const rKey = String(t.editorialRating);
    ratings[rKey] = (ratings[rKey] || 0) + 1;

    // Track phrases for repetition detection
    const words = t.editorialReview.toLowerCase();
    const checkPhrases = [
      'quality depends on which guide',
      'the kind of tour that',
      'more highlight reel',
      'covers serious ground',
      'comfortable shoes',
      'peak-season slots',
      'stairs and uneven terrain',
      'early morning departure',
      'larger groups dilute',
      'ruins into living',
      'guide variability',
      'built around',
      'standing where gladiators',
      'arena-level access',
      'ground-level perspective',
      'best for:',
      'ideal match:',
      'suited to:',
      'a strong pick for:',
      'the right call for:',
      'book this if',
      'this one belongs to:',
      'made for:',
      'where it clicks:',
      'lands best with:',
    ];

    for (const p of checkPhrases) {
      if (words.includes(p)) {
        phrases[p] = (phrases[p] || 0) + 1;
      }
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(70));
  console.log('RATING DISTRIBUTION');
  for (const [r, count] of Object.entries(ratings).sort()) {
    const bar = '#'.repeat(count);
    console.log('  ' + r + '/5: ' + bar + ' (' + count + ')');
  }

  console.log('');
  console.log('PHRASE FREQUENCY (sorted by count)');
  const sorted = Object.entries(phrases).sort((a, b) => b[1] - a[1]);
  for (const [phrase, count] of sorted) {
    const flag = count > 3 ? ' <-- REPETITIVE' : '';
    console.log('  ' + count + 'x  "' + phrase + '"' + flag);
  }

  console.log('');
  console.log('='.repeat(70));
}

main().catch(console.error);