// rescrape-all.js — Re-scrape + regenerate all existing ColosseumRoman tours

import { scrapeGetYourGuideTour, cleanAffiliateUrl } from './src/scraper.js';
import { processImages, cleanupTempFiles } from './src/imageProcessor.js';
import { generateTourContent } from './src/contentGenerator.js';
import { rescrapeToSanity } from './src/sanityUploader.js';
import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn: false,
});

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = args.find(a => a.startsWith('--limit='))?.split('=')[1];

// ─── Done tracking ───────────────────────────────────────────────────────────
const DONE_FILE = './rescrape-done.json';
const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE)) : [];

async function fetchRelatedTours(excludeSlug) {
  try {
    const tours = await sanity.fetch(`
      *[_type == "post" && slug.current != $slug] | order(_createdAt desc)[0...4] {
        title,
        "slug": slug.current,
        "price": tourInfo.price,
        "duration": tourInfo.duration,
        "rating": getYourGuideData.rating,
        "reviewCount": getYourGuideData.reviewCount
      }
    `, { slug: excludeSlug });
    return tours || [];
  } catch (e) {
    return [];
  }
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║     🏛️  ColosseumRoman - RESCRAPE ALL TOURS 🏛️           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
if (LIMIT) console.log(`Limit: ${LIMIT} tours`);
console.log(`Already done: ${done.length} tours`);
console.log('');

let tours = await sanity.fetch(`
  *[_type == "post"] | order(_createdAt asc) [0...500] {
    _id,
    title,
    "slug": slug.current,
    getYourGuideUrl,
    getYourGuideTourId
  }
`);

if (!tours.length) {
  console.error('❌ No tours found with getYourGuideUrl');
  process.exit(1);
}

if (LIMIT) tours = tours.slice(0, parseInt(LIMIT));
console.log(`Found ${tours.length} tours to process\n`);

let success = 0;
let errors = 0;

for (const tour of tours) {
  const url = tour.getYourGuideUrl;
  if (!url) {
    console.log(`⏭️  ${tour.slug} — no GYG URL, skipping`);
    continue;
  }

  if (done.includes(tour.slug)) {
    console.log(`⏭️  ${tour.slug} — already done, skipping`);
    continue;
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`🔄 Processing: ${tour.slug}`);
  console.log(`   URL: ${url}`);

  try {
    // PASO 1: Scrape
    console.log('   📥 Scraping GYG...');
    const tourData = await scrapeGetYourGuideTour(url);
    if (!tourData.title) throw new Error('Could not extract title');
    if (!tourData.images?.length) throw new Error('No images found');

    const baseUrl = url.split('?')[0];
    const rawBookingUrl = `${baseUrl}?partner_id=${config.affiliate.partnerId}&utm_medium=${config.affiliate.utmMedium}`;
    tourData.bookingUrl = cleanAffiliateUrl(rawBookingUrl);
    console.log(`   ✅ Scraped: ${tourData.images.length} images, $${tourData.price}, ${tourData.duration}`);

    // PASO 2: Imágenes
    console.log('   🖼️  Processing images...');
    const processedImages = await processImages(tourData.images.slice(0, 15));
    console.log(`   ✅ ${processedImages.length} images processed`);

    // PASO 3: Tours relacionados
    const relatedTours = await fetchRelatedTours(tour.slug);

    // PASO 4: Generar contenido
    console.log('   ✍️  Generating content with Claude...');
    const contentData = await generateTourContent(tourData, relatedTours);
    console.log('   ✅ Content generated');

    if (DRY_RUN) {
      console.log(`   📋 DRY RUN — would patch _id: ${tour._id}`);
      success++;
      cleanupTempFiles();
      continue;
    }

    // PASO 5: Upload imágenes + patch en Sanity
    await rescrapeToSanity(tour._id, tourData, contentData, processedImages);
    console.log(`   ✅ Patched successfully`);

    // Guardar como done
    done.push(tour.slug);
    fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2));

    success++;
    cleanupTempFiles();
    await new Promise(r => setTimeout(r, 3000));

  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    errors++;
    try { cleanupTempFiles(); } catch (e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log('\n═══════════════════════════════');
console.log(`✅ Success: ${success}`);
console.log(`❌ Errors:  ${errors}`);
console.log(`📋 Total done: ${done.length}`);

