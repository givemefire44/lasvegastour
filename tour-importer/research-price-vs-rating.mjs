#!/usr/bin/env node
/**
 * research-price-vs-rating.mjs
 * 
 * ¿Los tours más caros tienen mejores reviews?
 * Cruza precio vs rating en 505+ tours de 5 monumentos europeos.
 * 
 * Uso: node research-price-vs-rating.mjs
 */

import { createClient } from '@sanity/client';
import { readFileSync, writeFileSync } from 'fs';

// ========================================
// CONFIGURACIÓN DE SITIOS
// ========================================
const SITES = [
  {
    name: 'Colosseum',
    domain: 'colosseumroman.com',
    envPath: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local',
    monument: 'Roman Colosseum',
    city: 'Rome'
  },
  {
    name: 'Sagrada Familia',
    domain: 'sagradafamiliatourguide.com',
    envPath: 'C:/Users/Noxi-PC/sagradafamiliatourguide/tour-importer/.env.local',
    monument: 'Sagrada Familia',
    city: 'Barcelona'
  },
  {
    name: 'Last Supper',
    domain: 'milanlastsupper.com',
    envPath: 'C:/Users/Noxi-PC/milanlastsupper/tour-importer/.env.local',
    monument: "Leonardo's Last Supper",
    city: 'Milan'
  },
  {
    name: 'Louvre',
    domain: 'louvretourguide.com',
    envPath: 'C:/Users/Noxi-PC/louvretourguide/tour-importer/.env.local',
    monument: 'Louvre Museum',
    city: 'Paris'
  },
  {
    name: 'Pompeii',
    domain: 'pompeiitourguides.com',
    envPath: 'C:/Users/Noxi-PC/pompeiiguidetours/tour-importer/.env.local',
    monument: 'Pompeii Archaeological Park',
    city: 'Naples'
  }
];

// ========================================
// LEER .env.local
// ========================================
function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, 'utf-8');
    const vars = {};
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) vars[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    });
    return vars;
  } catch (e) {
    return null;
  }
}

// ========================================
// FETCH TOURS
// ========================================
async function fetchTours(site) {
  const env = loadEnv(site.envPath);
  if (!env) return [];

  const projectId = env.SANITY_PROJECT_ID || env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.SANITY_DATASET || env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = env.SANITY_TOKEN || env.SANITY_API_TOKEN;

  const client = createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });

  return await client.fetch(`
    *[_type == "post" && defined(tourInfo.price) && defined(getYourGuideData.rating) && !(_id in path("drafts.**"))] {
      title,
      "slug": slug.current,
      "price": tourInfo.price,
      "rating": getYourGuideData.rating,
      "reviewCount": getYourGuideData.reviewCount,
      "duration": tourInfo.duration,
      "provider": getYourGuideData.provider
    }
  `);
}

// ========================================
// ANÁLISIS ESTADÍSTICO
// ========================================
function analyzePriceVsRating(allTours) {
  // Filtrar tours con datos completos
  const valid = allTours.filter(t => t.price > 0 && t.rating > 0 && t.reviewCount > 0);

  // Dividir en rangos de precio
  const ranges = [
    { label: 'Budget ($0–$50)', min: 0, max: 50 },
    { label: 'Mid-range ($51–$100)', min: 51, max: 100 },
    { label: 'Premium ($101–$200)', min: 101, max: 200 },
    { label: 'Luxury ($201–$500)', min: 201, max: 500 },
    { label: 'Ultra-luxury ($500+)', min: 501, max: Infinity }
  ];

  const rangeStats = ranges.map(range => {
    const tours = valid.filter(t => t.price >= range.min && t.price <= range.max);
    if (tours.length === 0) return { ...range, count: 0, avgRating: 0, avgReviews: 0, medianRating: 0 };

    const ratings = tours.map(t => t.rating).sort((a, b) => a - b);
    const reviews = tours.map(t => t.reviewCount).sort((a, b) => a - b);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const avgReviews = reviews.reduce((a, b) => a + b, 0) / reviews.length;
    const medianRating = ratings[Math.floor(ratings.length / 2)];

    return {
      ...range,
      count: tours.length,
      avgRating: Math.round(avgRating * 100) / 100,
      medianRating,
      avgReviews: Math.round(avgReviews),
      medianReviews: reviews[Math.floor(reviews.length / 2)]
    };
  });

  // Correlación de Pearson entre precio y rating
  const n = valid.length;
  const sumX = valid.reduce((a, t) => a + t.price, 0);
  const sumY = valid.reduce((a, t) => a + t.rating, 0);
  const sumXY = valid.reduce((a, t) => a + t.price * t.rating, 0);
  const sumX2 = valid.reduce((a, t) => a + t.price * t.price, 0);
  const sumY2 = valid.reduce((a, t) => a + t.rating * t.rating, 0);
  const correlation = (n * sumXY - sumX * sumY) /
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  // Top 10 mejor rating con más de 50 reviews
  const topRated = valid
    .filter(t => t.reviewCount >= 50)
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 10);

  // Top 10 peor rating con más de 50 reviews
  const worstRated = valid
    .filter(t => t.reviewCount >= 50)
    .sort((a, b) => a.rating - b.rating || b.reviewCount - a.reviewCount)
    .slice(0, 10);

  // Mejor valor: alto rating + bajo precio (con mínimo 50 reviews)
  const bestValue = valid
    .filter(t => t.reviewCount >= 50 && t.rating >= 4.5)
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);

  // Peor valor: bajo rating + alto precio (con mínimo 20 reviews)
  const worstValue = valid
    .filter(t => t.reviewCount >= 20 && t.rating <= 4.2)
    .sort((a, b) => b.price - a.price)
    .slice(0, 10);

  // Tours con más reviews (volumen = popularidad)
  const mostReviewed = valid
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 10);

  // Por monumento: precio promedio vs rating promedio
  const bySite = {};
  valid.forEach(t => {
    if (!bySite[t.site]) bySite[t.site] = [];
    bySite[t.site].push(t);
  });

  const siteComparison = Object.entries(bySite).map(([site, tours]) => ({
    site,
    count: tours.length,
    avgPrice: Math.round(tours.reduce((a, t) => a + t.price, 0) / tours.length),
    avgRating: Math.round(tours.reduce((a, t) => a + t.rating, 0) / tours.length * 100) / 100,
    avgReviews: Math.round(tours.reduce((a, t) => a + t.reviewCount, 0) / tours.length)
  }));

  return {
    totalTours: valid.length,
    correlation: Math.round(correlation * 1000) / 1000,
    rangeStats,
    topRated,
    worstRated,
    bestValue,
    worstValue,
    mostReviewed,
    siteComparison
  };
}

// ========================================
// MAIN
// ========================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  📊 RESEARCH: Do More Expensive Tours Get Better Reviews?     ║');
  console.log('║  Price vs Rating analysis across 5 European monuments         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  let allTours = [];

  for (const site of SITES) {
    console.log(`🏛️ Loading ${site.name}...`);
    const tours = await fetchTours(site);
    const enriched = tours.map(t => ({ ...t, site: site.name, monument: site.monument }));
    allTours = allTours.concat(enriched);
    console.log(`   ✅ ${tours.length} tours loaded`);
  }

  console.log(`\n📦 Total tours with price + rating: ${allTours.filter(t => t.price > 0 && t.rating > 0).length}\n`);

  const results = analyzePriceVsRating(allTours);

  // ========================================
  // CORRELACIÓN
  // ========================================
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          📈 CORRELATION: Price vs Rating                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const corrText = results.correlation > 0.3 ? 'POSITIVE (more expensive = better rated)'
    : results.correlation < -0.3 ? 'NEGATIVE (more expensive = worse rated)'
    : 'WEAK/NONE (price does not predict rating)';
  console.log(`   Pearson correlation: ${results.correlation}`);
  console.log(`   Interpretation: ${corrText}`);
  console.log(`   Based on ${results.totalTours} tours with valid price + rating data\n`);

  // ========================================
  // RATING POR RANGO DE PRECIO
  // ========================================
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     ⭐ AVERAGE RATING BY PRICE RANGE                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  results.rangeStats.forEach(r => {
    if (r.count === 0) return;
    const stars = '★'.repeat(Math.round(r.avgRating)) + '☆'.repeat(5 - Math.round(r.avgRating));
    console.log(`   ${r.label.padEnd(25)} ${stars} ${r.avgRating}/5  (${r.count} tours, avg ${r.avgReviews} reviews)`);
  });

  // ========================================
  // POR MONUMENTO
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     🏛️ PRICE vs RATING BY MONUMENT                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  results.siteComparison
    .sort((a, b) => b.avgRating - a.avgRating)
    .forEach(s => {
      console.log(`   ${s.site.padEnd(20)} ⭐ ${s.avgRating}/5  |  💰 avg $${s.avgPrice}  |  📝 avg ${s.avgReviews} reviews  (${s.count} tours)`);
    });

  // ========================================
  // TOP 10 MEJOR RATING (50+ reviews)
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     🏆 TOP 10 HIGHEST RATED TOURS (50+ reviews)               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  results.topRated.forEach((t, i) => {
    console.log(`   ${(i + 1 + '.').padEnd(4)} ⭐ ${t.rating}/5 (${t.reviewCount} reviews) | $${t.price} | ${t.site}`);
    console.log(`        ${t.title}`);
  });

  // ========================================
  // TOP 10 PEOR RATING (50+ reviews)
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     ⚠️ TOP 10 LOWEST RATED TOURS (50+ reviews)                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  results.worstRated.forEach((t, i) => {
    console.log(`   ${(i + 1 + '.').padEnd(4)} ⭐ ${t.rating}/5 (${t.reviewCount} reviews) | $${t.price} | ${t.site}`);
    console.log(`        ${t.title}`);
  });

  // ========================================
  // BEST VALUE: Alto rating + bajo precio
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     💚 BEST VALUE: Highest rated under lowest price (50+ rev) ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  results.bestValue.forEach((t, i) => {
    console.log(`   ${(i + 1 + '.').padEnd(4)} $${t.price} | ⭐ ${t.rating}/5 (${t.reviewCount} reviews) | ${t.site}`);
    console.log(`        ${t.title}`);
  });

  // ========================================
  // WORST VALUE: Bajo rating + alto precio
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     🚫 WORST VALUE: Lowest rated at highest price (20+ rev)   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  results.worstValue.forEach((t, i) => {
    console.log(`   ${(i + 1 + '.').padEnd(4)} $${t.price} | ⭐ ${t.rating}/5 (${t.reviewCount} reviews) | ${t.site}`);
    console.log(`        ${t.title}`);
  });

  // ========================================
  // MOST REVIEWED (popularidad)
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     📊 MOST REVIEWED TOURS (popularity ranking)               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  results.mostReviewed.forEach((t, i) => {
    console.log(`   ${(i + 1 + '.').padEnd(4)} ${t.reviewCount.toLocaleString()} reviews | ⭐ ${t.rating}/5 | $${t.price} | ${t.site}`);
    console.log(`        ${t.title}`);
  });

  // ========================================
  // KEY FINDINGS
  // ========================================
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     📰 KEY FINDINGS FOR ARTICLE                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const budget = results.rangeStats.find(r => r.label.includes('Budget'));
  const luxury = results.rangeStats.find(r => r.label.includes('Luxury'));
  const ultra = results.rangeStats.find(r => r.label.includes('Ultra'));

  if (budget && luxury) {
    console.log(`   1. Budget tours ($0-$50) average ${budget.avgRating}/5 vs Luxury ($201-$500) at ${luxury.avgRating}/5`);
    if (budget.avgRating >= luxury.avgRating) {
      console.log(`      → FINDING: Cheaper tours are rated EQUAL OR HIGHER than expensive ones`);
    } else {
      console.log(`      → FINDING: Expensive tours are rated higher, but by only ${(luxury.avgRating - budget.avgRating).toFixed(2)} stars`);
    }
  }

  console.log(`   2. Correlation coefficient: ${results.correlation} — ${corrText}`);
  console.log(`   3. Most reviewed tour has ${results.mostReviewed[0]?.reviewCount.toLocaleString()} reviews at $${results.mostReviewed[0]?.price}`);

  if (results.bestValue[0]) {
    console.log(`   4. Best value: "${results.bestValue[0].title}" — $${results.bestValue[0].price}, ${results.bestValue[0].rating}/5 (${results.bestValue[0].reviewCount} reviews)`);
  }

  // ========================================
  // GUARDAR
  // ========================================
  const output = {
    generatedAt: new Date().toISOString(),
    methodology: `Price vs rating analysis of ${results.totalTours} tours across 5 European monuments. Rating and review data sourced from GetYourGuide via automated biweekly tracking. Pearson correlation calculated between tour price and average rating. Tours grouped by price range for comparative analysis.`,
    correlation: results.correlation,
    rangeStats: results.rangeStats,
    siteComparison: results.siteComparison,
    topRated: results.topRated,
    worstRated: results.worstRated,
    bestValue: results.bestValue,
    worstValue: results.worstValue,
    mostReviewed: results.mostReviewed
  };

  writeFileSync('./research-price-vs-rating.json', JSON.stringify(output, null, 2));
  console.log('\n📁 Data saved to research-price-vs-rating.json');
  console.log('Done!');
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });