#!/usr/bin/env node
/**
 * scrape-reviews.mjs
 * 
 * Scrapea reviews de GetYourGuide para todos los tours de Colosseum.
 * Lee URLs de Sanity, abre cada tour, scrollea el modal de reviews,
 * extrae rating, país, fecha, texto.
 * 
 * Uso:
 *   node scrape-reviews.mjs                    # Dry run - muestra tours
 *   node scrape-reviews.mjs --execute          # Scrapea todos
 *   node scrape-reviews.mjs --execute --slug=rome-colosseum-underground  # Solo 1 tour
 *   node scrape-reviews.mjs --execute --max-reviews=50   # Limitar reviews por tour
 * 
 * Output: reviews-colosseum.json
 */

import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import { createClient } from '@sanity/client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync, readFileSync, existsSync } from 'fs';

puppeteer.use(StealthPlugin());

// ========================================
// CONFIGURACIÓN
// ========================================
const MAX_REVIEWS_PER_TOUR = 150;
const MIN_REVIEWS_TO_SCRAPE = 10;
const SCROLL_DELAY = 2500;
const TOUR_DELAY = 15000;
const OUTPUT_FILE = './reviews-colosseum.json';

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1];
const maxReviewsArg = args.find(a => a.startsWith('--max-reviews='))?.split('=')[1];
const MAX_REVIEWS = maxReviewsArg ? parseInt(maxReviewsArg) : MAX_REVIEWS_PER_TOUR;

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(min + Math.random() * (max - min));

// ========================================
// CLASIFICAR TOUR
// ========================================
function classifyTour(title) {
  const t = title.toLowerCase();
  let tourType = 'standard';
  if (t.includes('underground') || t.includes('hypogeum')) tourType = 'underground';
  else if (t.includes('night') || t.includes('after dark') || t.includes('moonlight')) tourType = 'night';
  else if (t.includes('arena')) tourType = 'arena';
  else if (t.includes('vatican') || t.includes('sistine')) tourType = 'combo-vatican';
  else if (t.includes('forum') || t.includes('palatine')) tourType = 'combo-forum';

  let format = 'guided';
  if (t.includes('audio') || t.includes('audioapp') || t.includes('audio guide')) format = 'audio-guide';
  else if (t.includes('private') || t.includes('vip')) format = 'private';
  else if (t.includes('self-guided') || t.includes('self guided')) format = 'self-guided';

  let groupSize = 'standard';
  if (t.includes('small group') || t.includes('small-group')) groupSize = 'small-group';
  else if (t.includes('private') || t.includes('vip')) groupSize = 'private';

  return { tourType, format, groupSize };
}

// ========================================
// EXTRAER GYG TOUR ID DE LA URL
// ========================================
function getGygTourId(url) {
  const match = url.match(/t(\d+)/);
  return match ? match[1] : url;
}

// ========================================
// LIMPIAR REVIEW
// ========================================
function cleanReview(raw) {
  const lines = raw.text.split('\n').map(l => l.trim()).filter(l => l);

  // País: buscar línea con "–" (nombre – país)
  const authorLine = lines.find(l => l.includes('–') && !l.includes('star') && !l.includes('out of'));
  const country = authorLine ? authorLine.split('–').pop().trim() : null;

  // Texto: entre "Verified booking" y "Was this helpful?"
  const textStartIdx = lines.findIndex(l => l.includes('Verified booking'));
  const textEndIdx = lines.findIndex(l => l.includes('Was this helpful'));

  let cleanText;
  if (textStartIdx >= 0) {
    const endIdx = textEndIdx > textStartIdx ? textEndIdx : lines.length;
    cleanText = lines.slice(textStartIdx + 1, endIdx).join(' ').trim();
  } else {
    const filtered = lines.filter(l =>
      !l.match(/^\d$/) &&
      !l.includes('out of 5 stars') &&
      !l.includes('Verified booking') &&
      !l.includes('Was this helpful') &&
      l.length > 1 &&
      !l.match(/^[A-Z]$/) &&
      !(l.includes('–') && l.length < 40)
    );
    cleanText = filtered.join(' ').trim();
  }

  return { rating: raw.rating, country, date: raw.date, text: cleanText };
}

// ========================================
// SCRAPEAR REVIEWS DE UN TOUR
// ========================================
async function scrapeReviews(gygUrl, maxReviews) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1920,1080'],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    });

    // Bloquear imágenes para acelerar
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`      🌐 Loading page...`);
    await page.goto(gygUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await randomDelay(4000, 6000);

    // Buscar y clickear el botón de reviews
    console.log(`      🔍 Looking for reviews button...`);

    const modalOpened = await page.evaluate(() => {
      const elements = document.querySelectorAll('button, a, [role="button"], span');
      for (const el of elements) {
        const text = el.innerText?.toLowerCase() || '';
        if ((text.includes('see all') && text.includes('review')) ||
            (text.includes('read all') && text.includes('review')) ||
            (text.includes('read') && text.includes('reviews'))) {
          el.click();
          return true;
        }
      }
      const ratingLinks = document.querySelectorAll('a[href*="review"], button[class*="review"]');
      for (const el of ratingLinks) {
        el.click();
        return true;
      }
      return false;
    });

    if (!modalOpened) {
      console.log(`      ⚠️ Could not find reviews button`);
      return { reviews: [], error: 'Reviews button not found' };
    }

    console.log(`      ✅ Reviews button clicked`);

    // Esperar a que el modal/dialog aparezca
    try {
      await page.waitForSelector('[role="dialog"], [class*="modal"]', { timeout: 10000 });
      console.log(`      ✅ Reviews modal detected`);
    } catch (e) {
      console.log(`      ℹ️ Waiting for reviews to load...`);
      await delay(3000);
    }

    await randomDelay(2000, 3000);

    // Scrollear y extraer
    let previousCount = 0;
    let sameCountStreak = 0;
    let allReviews = [];

    for (let scroll = 0; scroll < 100; scroll++) {
      let currentReviews = [];
      try {
        currentReviews = await page.evaluate(() => {
          const reviewCards = document.querySelectorAll('[class*="review-card"]');
          const reviews = [];

          reviewCards.forEach(card => {
            try {
              const fullText = card.innerText?.trim() || '';
              if (!fullText || fullText.length < 20) return;

              // Rating
              let rating = null;
              const ratingEl = card.querySelector('[aria-label*="star"], [aria-label*="rating"]');
              if (ratingEl) {
                const match = ratingEl.getAttribute('aria-label').match(/([\d.]+)/);
                if (match) rating = parseFloat(match[1]);
              }
              if (!rating) {
                const firstLine = fullText.split('\n')[0]?.trim();
                if (firstLine && firstLine.match(/^[1-5]$/)) {
                  rating = parseInt(firstLine);
                }
              }

              // Fecha
              let date = '';
              const dateMatch = fullText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
              if (dateMatch) date = dateMatch[0];

              if (rating && fullText.length > 30) {
                reviews.push({ rating, country: null, date, text: fullText });
              }
            } catch (e) {}
          });

          return reviews;
        });
      } catch (e) {
        // Si el contexto se destruyó, esperar y reintentar una vez
        console.log(`      ⚠️ Context lost, retrying...`);
        await delay(3000);
        try {
          currentReviews = await page.evaluate(() => {
            const reviewCards = document.querySelectorAll('[class*="review-card"]');
            return Array.from(reviewCards).map(card => {
              const fullText = card.innerText?.trim() || '';
              const firstLine = fullText.split('\n')[0]?.trim();
              const rating = firstLine?.match(/^[1-5]$/) ? parseInt(firstLine) : null;
              const dateMatch = fullText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
              return { rating, country: null, date: dateMatch?.[0] || '', text: fullText };
            }).filter(r => r.rating && r.text.length > 30);
          });
        } catch (e2) {
          console.log(`      ❌ Failed to recover: ${e2.message.substring(0, 60)}`);
          break;
        }
      }

      // Limpiar
      const cleaned = currentReviews.map(r => cleanReview(r));
      allReviews = cleaned;

      console.log(`      📜 Scroll ${scroll + 1}: ${allReviews.length} reviews loaded`);

      if (allReviews.length >= maxReviews) {
        console.log(`      ✅ Reached max reviews (${maxReviews})`);
        break;
      }

      if (allReviews.length === previousCount) {
        sameCountStreak++;
        if (sameCountStreak >= 4) {
          console.log(`      ✅ No more reviews to load (${allReviews.length} total)`);
          break;
        }
      } else {
        sameCountStreak = 0;
      }
      previousCount = allReviews.length;

      // Scrollear
      try {
        await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (dialog) {
            const scrollables = dialog.querySelectorAll('div');
            for (const div of scrollables) {
              if (div.scrollHeight > div.clientHeight + 50) {
                div.scrollTop = div.scrollHeight;
                return;
              }
            }
            dialog.scrollTop = dialog.scrollHeight;
            return;
          }
          const modal = document.querySelector('[class*="modal"], [class*="overlay"]');
          if (modal) {
            modal.scrollTop = modal.scrollHeight;
            return;
          }
          window.scrollTo(0, document.body.scrollHeight);
        });
      } catch (e) {
        console.log(`      ⚠️ Scroll error, waiting...`);
        await delay(3000);
      }

      await delay(SCROLL_DELAY);
    }

    return { reviews: allReviews.slice(0, maxReviews), error: null };

  } catch (error) {
    return { reviews: [], error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

// ========================================
// MAIN
// ========================================
async function main() {
  const startTime = Date.now();

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  📝 REVIEW SCRAPER — Colosseum Tours from GetYourGuide        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN (shows tours only)' : '⚠️ EXECUTE (scraping reviews)'}`);
  console.log(`📊 Max reviews per tour: ${MAX_REVIEWS}`);
  console.log(`⏱️  Delay between tours: ${TOUR_DELAY / 1000}s\n`);

  let query;
  if (slugArg) {
    query = `*[_type == "post" && slug.current == "${slugArg}" && !(_id in path("drafts.**"))] {
      title, "slug": slug.current, "gygUrl": getYourGuideUrl,
      "price": tourInfo.price, "duration": tourInfo.duration,
      "rating": getYourGuideData.rating, "reviewCount": getYourGuideData.reviewCount,
      "provider": getYourGuideData.provider
    }`;
  } else {
    query = `*[_type == "post" && defined(getYourGuideUrl) && !(_id in path("drafts.**"))] | order(getYourGuideData.reviewCount desc) {
      title, "slug": slug.current, "gygUrl": getYourGuideUrl,
      "price": tourInfo.price, "duration": tourInfo.duration,
      "rating": getYourGuideData.rating, "reviewCount": getYourGuideData.reviewCount,
      "provider": getYourGuideData.provider
    }`;
  }

  const tours = await sanityClient.fetch(query);
  console.log(`📦 ${tours.length} tours found in Sanity\n`);

  const toursWithReviews = tours.filter(t => (t.reviewCount || 0) >= MIN_REVIEWS_TO_SCRAPE);
  const toursSkipped = tours.length - toursWithReviews.length;

  // Deduplicar por GYG URL
  const seenGygIds = new Set();
  const toursToScrape = [];
  const duplicatesSkipped = [];

  for (const tour of toursWithReviews) {
    const gygId = getGygTourId(tour.gygUrl);
    if (seenGygIds.has(gygId)) {
      duplicatesSkipped.push(tour.title);
      continue;
    }
    seenGygIds.add(gygId);
    toursToScrape.push(tour);
  }

  console.log(`🎯 ${toursToScrape.length} unique tours to scrape`);
  console.log(`   ${toursSkipped} skipped (< ${MIN_REVIEWS_TO_SCRAPE} reviews)`);
  console.log(`   ${duplicatesSkipped.length} skipped (duplicate GYG URLs)\n`);

  if (DRY_RUN) {
    console.log('─── TOURS TO SCRAPE ───\n');
    toursToScrape.forEach((t, i) => {
      const { tourType, format } = classifyTour(t.title);
      const gygId = getGygTourId(t.gygUrl);
      console.log(`   ${(i + 1 + '.').padEnd(4)} [${tourType}] [${format}] ${t.title}`);
      console.log(`        ⭐ ${t.rating}/5 (${t.reviewCount} reviews) | $${t.price} | GYG: t${gygId}\n`);
    });
    if (duplicatesSkipped.length > 0) {
      console.log('─── DUPLICATES SKIPPED ───\n');
      duplicatesSkipped.forEach(t => console.log(`   ⏭️ ${t}`));
    }
    console.log(`\n🧪 DRY RUN. To scrape: node scrape-reviews.mjs --execute`);
    return;
  }

  // Resume
  let existingData = { tours: [] };
  if (existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
      console.log(`📂 Resuming: ${existingData.tours.length} tours already scraped\n`);
    } catch (e) {
      console.log(`📂 Starting fresh\n`);
    }
  }

  const scrapedSlugs = new Set(existingData.tours.map(t => t.slug));
  const results = [...existingData.tours];

  let scraped = 0;
  let failed = 0;
  let skippedExisting = 0;

  for (let i = 0; i < toursToScrape.length; i++) {
    const tour = toursToScrape[i];

    if (scrapedSlugs.has(tour.slug)) {
      skippedExisting++;
      console.log(`[${i + 1}/${toursToScrape.length}] ⏭️ Already scraped: ${tour.title}`);
      continue;
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${i + 1}/${toursToScrape.length}] ${tour.title}`);
    console.log(`   ⭐ ${tour.rating}/5 (${tour.reviewCount} reviews) | $${tour.price}`);

    const { tourType, format, groupSize } = classifyTour(tour.title);
    console.log(`   🏷️ Type: ${tourType} | Format: ${format} | Group: ${groupSize}`);

    const reviewsToGet = Math.min(MAX_REVIEWS, tour.reviewCount || MAX_REVIEWS);
    console.log(`   🎯 Target: ${reviewsToGet} reviews`);

    const result = await scrapeReviews(tour.gygUrl, reviewsToGet);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
      failed++;
    } else if (result.reviews.length === 0) {
      console.log(`   ⚠️ No reviews extracted`);
      failed++;
    } else {
      console.log(`   ✅ Scraped ${result.reviews.length} reviews`);
      scraped++;

      const gygId = getGygTourId(tour.gygUrl);
      const relatedSlugs = tours
        .filter(t => getGygTourId(t.gygUrl) === gygId && t.slug !== tour.slug)
        .map(t => t.slug);

      results.push({
        title: tour.title,
        slug: tour.slug,
        relatedSlugs,
        gygUrl: tour.gygUrl,
        gygTourId: gygId,
        price: tour.price,
        duration: tour.duration,
        rating: tour.rating,
        reviewCount: tour.reviewCount,
        provider: tour.provider,
        tourType,
        format,
        groupSize,
        scrapedAt: new Date().toISOString(),
        reviewsScraped: result.reviews.length,
        reviews: result.reviews
      });

      // Guardar progreso
      const output = {
        generatedAt: new Date().toISOString(),
        totalTours: results.length,
        totalReviews: results.reduce((a, t) => a + t.reviews.length, 0),
        tours: results
      };
      writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    }

    if (i < toursToScrape.length - 1) {
      console.log(`   ⏱️ Waiting ${TOUR_DELAY / 1000}s...`);
      await delay(TOUR_DELAY);
    }
  }

  // Resumen
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const totalReviews = results.reduce((a, t) => a + t.reviews.length, 0);

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 SCRAPING SUMMARY                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`   ✅ Tours scraped: ${scraped}`);
  console.log(`   ⏭️ Already done: ${skippedExisting}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📝 Total reviews: ${totalReviews.toLocaleString()}`);
  console.log(`   ⏱️ Time: ${elapsed} min`);
  console.log(`   📁 Saved to: ${OUTPUT_FILE}`);

  console.log('\n─── REVIEWS BY TOUR TYPE ───');
  const byType = {};
  results.forEach(t => {
    if (!byType[t.tourType]) byType[t.tourType] = { tours: 0, reviews: 0 };
    byType[t.tourType].tours++;
    byType[t.tourType].reviews += t.reviews.length;
  });
  Object.entries(byType).sort((a, b) => b[1].reviews - a[1].reviews).forEach(([type, data]) => {
    console.log(`   ${type.padEnd(20)} ${data.tours} tours, ${data.reviews} reviews`);
  });

  console.log('\n─── REVIEWS BY FORMAT ───');
  const byFormat = {};
  results.forEach(t => {
    if (!byFormat[t.format]) byFormat[t.format] = { tours: 0, reviews: 0 };
    byFormat[t.format].tours++;
    byFormat[t.format].reviews += t.reviews.length;
  });
  Object.entries(byFormat).sort((a, b) => b[1].reviews - a[1].reviews).forEach(([fmt, data]) => {
    console.log(`   ${fmt.padEnd(20)} ${data.tours} tours, ${data.reviews} reviews`);
  });

  console.log('\n─── TOP COUNTRIES ───');
  const byCountry = {};
  results.forEach(t => {
    t.reviews.forEach(r => {
      const c = r.country || 'Unknown';
      byCountry[c] = (byCountry[c] || 0) + 1;
    });
  });
  Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([country, count]) => {
      const pct = (count / totalReviews * 100).toFixed(1);
      console.log(`   ${country.padEnd(25)} ${count} (${pct}%)`);
    });
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });