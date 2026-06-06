#!/usr/bin/env node
/**
 * clean-reviews.mjs
 *
 * Toma reviews-colosseum.json y produce reviews-colosseum-clean.json
 *  - Deduplica reviews idénticas (mismo text + country, dentro de cada tour)
 *  - Fixea encoding UTF-8 mal codificado (â€™ → ', Ã© → é, etc.)
 *  - Recalcula stats por tour y globales
 *
 * Uso:
 *   node clean-reviews.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import crypto from 'crypto';

const INPUT = './reviews-colosseum.json';
const OUTPUT = './reviews-colosseum-clean.json';

// ========================================
// FIX UTF-8 MAL CODIFICADO
// ========================================
// Cuando UTF-8 se interpreta como Latin-1 y se re-codifica, salen mojibake.
// Estas son las sustituciones más comunes.
const ENCODING_FIXES = [
  // Apóstrofes y comillas
  ['â€™', "'"],
  ['â€˜', "'"],
  ['â€œ', '"'],
  ['â€\u009d', '"'],
  ['â€"', '—'],
  ['â€"', '–'],
  ['â€¦', '…'],
  // Vocales con tilde
  ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'],
  ['Ã\u0081', 'Á'], ['Ã‰', 'É'], ['Ã\u008d', 'Í'], ['Ã"', 'Ó'], ['Ãš', 'Ú'],
  ['Ã±', 'ñ'], ['Ã\u0091', 'Ñ'],
  ['Ã¼', 'ü'], ['Ã„', 'Ä'], ['Ã¶', 'ö'], ['Ã¤', 'ä'],
  // Otros frecuentes
  ['Â°', '°'], ['Â£', '£'], ['Â€', '€'], ['Â', ''],
];

function fixEncoding(text) {
  if (!text || typeof text !== 'string') return text;
  let fixed = text;
  for (const [bad, good] of ENCODING_FIXES) {
    fixed = fixed.split(bad).join(good);
  }
  return fixed;
}

// ========================================
// HASH PARA DEDUP
// ========================================
function reviewHash(review) {
  const key = `${(review.text || '').trim().toLowerCase()}|${(review.country || '').trim().toLowerCase()}`;
  return crypto.createHash('md5').update(key).digest('hex');
}

// ========================================
// MAIN
// ========================================
function main() {
  console.log('━'.repeat(70));
  console.log('🧹 CLEAN REVIEWS — colosseum');
  console.log('━'.repeat(70));

  const raw = JSON.parse(readFileSync(INPUT, 'utf8'));
  console.log(`📥 Input: ${raw.totalReviews} reviews / ${raw.totalTours} tours`);

  let totalDuplicatesRemoved = 0;
  let totalEncodingFixes = 0;
  let totalReviewsAfter = 0;

  const cleanedTours = raw.tours.map(tour => {
    const seen = new Set();
    const cleanReviews = [];
    let duplicatesInThisTour = 0;
    let encodingFixesInThisTour = 0;

    for (const r of tour.reviews) {
      // Fix encoding
      const originalText = r.text || '';
      const cleanText = fixEncoding(originalText);
      const cleanCountry = fixEncoding(r.country || '');
      if (cleanText !== originalText) encodingFixesInThisTour++;

      const cleanReview = {
        rating: r.rating,
        country: cleanCountry,
        date: r.date,
        text: cleanText
      };

      // Dedup
      const h = reviewHash(cleanReview);
      if (seen.has(h)) {
        duplicatesInThisTour++;
        continue;
      }
      seen.add(h);
      cleanReviews.push(cleanReview);
    }

    totalDuplicatesRemoved += duplicatesInThisTour;
    totalEncodingFixes += encodingFixesInThisTour;
    totalReviewsAfter += cleanReviews.length;

    return {
      ...tour,
      reviews: cleanReviews,
      reviewsScraped: cleanReviews.length,
      _duplicatesRemoved: duplicatesInThisTour,
      _encodingFixes: encodingFixesInThisTour
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    sourceFile: INPUT,
    sourceGeneratedAt: raw.generatedAt,
    totalTours: cleanedTours.length,
    totalReviews: totalReviewsAfter,
    cleaning: {
      originalReviews: raw.totalReviews,
      duplicatesRemoved: totalDuplicatesRemoved,
      encodingFixesApplied: totalEncodingFixes,
      uniqueReviewsRetained: totalReviewsAfter
    },
    tours: cleanedTours
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf8');

  console.log('');
  console.log('━'.repeat(70));
  console.log('📊 RESULTADO');
  console.log('━'.repeat(70));
  console.log(`Reviews originales:   ${raw.totalReviews}`);
  console.log(`Duplicados eliminados: ${totalDuplicatesRemoved}`);
  console.log(`Encoding fixes:        ${totalEncodingFixes}`);
  console.log(`Reviews únicas:        ${totalReviewsAfter}`);
  console.log(`Reducción:             ${((totalDuplicatesRemoved/raw.totalReviews)*100).toFixed(1)}%`);
  console.log('');

  // Top 10 tours por reviews únicas
  const sorted = [...cleanedTours].sort((a, b) => b.reviews.length - a.reviews.length);
  console.log('📋 TOP 10 TOURS POR REVIEWS ÚNICAS:');
  sorted.slice(0, 10).forEach((t, i) => {
    console.log(`   ${(i+1).toString().padStart(2)}. ${t.reviews.length.toString().padStart(3)} únicas (${t._duplicatesRemoved} dups removidas) — ${t.title.slice(0, 60)}`);
  });
  console.log('');

  // Tours con pocas reviews (warning)
  const lowReviews = cleanedTours.filter(t => t.reviews.length < 5);
  if (lowReviews.length > 0) {
    console.log(`⚠️  ${lowReviews.length} tours con menos de 5 reviews únicas:`);
    lowReviews.forEach(t => {
      console.log(`   ${t.reviews.length} — ${t.title.slice(0, 70)}`);
    });
    console.log('');
  }

  console.log(`✅ Output: ${OUTPUT}`);
}

main();