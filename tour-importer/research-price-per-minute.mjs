#!/usr/bin/env node
/**
 * research-price-per-minute.mjs
 * 
 * Extrae datos de precios y duración de todos los sitios
 * para generar estadísticas citables de costo por minuto
 * 
 * Uso: node research-price-per-minute.mjs
 */

import { createClient } from '@sanity/client';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ========================================
// CONFIGURACIÓN DE SITIOS
// ========================================
const SITES = [
  {
    name: 'Colosseum',
    domain: 'colosseumroman.com',
    envPath: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local',
    monument: 'Roman Colosseum',
    city: 'Rome',
    officialTicketPrice: 18,
    officialTicketCurrency: 'EUR'
  },
  {
    name: 'Sagrada Familia',
    domain: 'sagradafamiliatourguide.com',
    envPath: 'C:/Users/Noxi-PC/sagradafamiliatourguide/tour-importer/.env.local',
    monument: 'Sagrada Familia',
    city: 'Barcelona',
    officialTicketPrice: 26,
    officialTicketCurrency: 'EUR'
  },
  {
    name: 'Last Supper',
    domain: 'milanlastsupper.com',
    envPath: 'C:/Users/Noxi-PC/milanlastsupper/tour-importer/.env.local',
    monument: "Leonardo's Last Supper",
    city: 'Milan',
    officialTicketPrice: 15,
    officialTicketCurrency: 'EUR'
  },
  {
    name: 'Louvre',
    domain: 'louvretourguide.com',
    envPath: 'C:/Users/Noxi-PC/louvretourguide/tour-importer/.env.local',
    monument: 'Louvre Museum',
    city: 'Paris',
    officialTicketPrice: 22,
    officialTicketCurrency: 'EUR'
  },
  {
    name: 'Pompeii',
    domain: 'pompeiitourguides.com',
    envPath: 'C:/Users/Noxi-PC/pompeiiguidetours/tour-importer/.env.local',
    monument: 'Pompeii Archaeological Park',
    city: 'Naples',
    officialTicketPrice: 18,
    officialTicketCurrency: 'EUR'
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
      if (match) {
        vars[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    });
    return vars;
  } catch (e) {
    console.log(`   ⚠️ No se pudo leer ${envPath}`);
    return null;
  }
}

// ========================================
// PARSEAR DURACIÓN A MINUTOS
// ========================================
function parseDurationToMinutes(duration) {
  if (!duration) return null;
  
  const d = duration.toLowerCase().trim();
  
  // "3 hours", "2.5 hours", "1.5 hours"
  const hoursMatch = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1]);
    // Check for additional minutes: "2 hours 30 minutes"
    const addMinMatch = d.match(/(\d+)\s*(?:minutes?|mins?|m)/);
    const addMin = addMinMatch ? parseInt(addMinMatch[1]) : 0;
    return Math.round(hours * 60 + addMin);
  }
  
  // "90 minutes", "45 min"
  const minMatch = d.match(/([\d.]+)\s*(?:minutes?|mins?|m)/);
  if (minMatch) return Math.round(parseFloat(minMatch[1]));
  
  // "Full day", "full-day"
  if (d.includes('full day') || d.includes('full-day')) return 480;
  
  // "Half day", "half-day"  
  if (d.includes('half day') || d.includes('half-day')) return 240;
  
  // Range: "1 - 3 hours" → take average
  const rangeMatch = d.match(/([\d.]+)\s*-\s*([\d.]+)\s*(?:hours?|hrs?)/);
  if (rangeMatch) {
    return Math.round(((parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2) * 60);
  }
  
  // Range in minutes: "45 - 90 minutes"
  const rangeMinMatch = d.match(/([\d.]+)\s*-\s*([\d.]+)\s*(?:minutes?|mins?)/);
  if (rangeMinMatch) {
    return Math.round((parseFloat(rangeMinMatch[1]) + parseFloat(rangeMinMatch[2])) / 2);
  }
  
  return null;
}

// ========================================
// FETCH TOURS DE UN SITIO
// ========================================
async function fetchToursFromSite(site) {
  const env = loadEnv(site.envPath);
  if (!env) return null;
  
  const projectId = env.SANITY_PROJECT_ID || env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.SANITY_DATASET || env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = env.SANITY_TOKEN || env.SANITY_API_TOKEN;
  
  if (!projectId) {
    console.log(`   ⚠️ No projectId para ${site.name}`);
    return null;
  }
  
  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: '2024-01-01',
    useCdn: false
  });
  
  const tours = await client.fetch(`
    *[_type == "post" && defined(tourInfo.price) && !(_id in path("drafts.**"))] {
      title,
      "slug": slug.current,
      "price": tourInfo.price,
      "duration": tourInfo.duration,
      "currency": tourInfo.currency,
      "rating": getYourGuideData.rating,
      "reviewCount": getYourGuideData.reviewCount,
      "provider": getYourGuideData.provider,
      "skipTheLine": tourFeatures.skipTheLine,
      "smallGroup": tourFeatures.smallGroupAvailable,
      "private": tourFeatures.freeCancellation
    }
  `);
  
  return tours;
}

// ========================================
// CALCULAR ESTADÍSTICAS
// ========================================
function calculateStats(tours, site) {
  const validTours = tours.filter(t => t.price > 0);
  const toursWithDuration = validTours.filter(t => {
    const min = parseDurationToMinutes(t.duration);
    return min && min > 0;
  });
  
  const prices = validTours.map(t => t.price).sort((a, b) => a - b);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const medianPrice = prices[Math.floor(prices.length / 2)];
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  
  // Costo por minuto
  const pricePerMinute = toursWithDuration.map(t => {
    const minutes = parseDurationToMinutes(t.duration);
    return {
      title: t.title,
      price: t.price,
      duration: t.duration,
      minutes,
      pricePerMinute: t.price / minutes,
      rating: t.rating,
      reviewCount: t.reviewCount,
      provider: t.provider
    };
  }).sort((a, b) => b.pricePerMinute - a.pricePerMinute);
  
  const avgPricePerMinute = pricePerMinute.length > 0
    ? pricePerMinute.reduce((a, b) => a + b.pricePerMinute, 0) / pricePerMinute.length
    : 0;
  
  // Duración promedio
  const durations = toursWithDuration.map(t => parseDurationToMinutes(t.duration));
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;
  
  // Providers
  const providerCounts = {};
  validTours.forEach(t => {
    const p = t.provider || 'Unknown';
    providerCounts[p] = (providerCounts[p] || 0) + 1;
  });
  const topProviders = Object.entries(providerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // Tour más caro por minuto
  const mostExpensivePerMinute = pricePerMinute[0] || null;
  
  // Tour más barato por minuto (excluir full day)
  const cheapestPerMinute = [...pricePerMinute]
    .filter(t => t.minutes <= 240)
    .sort((a, b) => a.pricePerMinute - b.pricePerMinute)[0] || null;
  
  // Ratio vs official ticket
  const officialPricePerMinute = site.officialTicketPrice / avgDuration;
  const tourVsOfficialRatio = avgPrice / site.officialTicketPrice;
  
  return {
    site: site.name,
    monument: site.monument,
    city: site.city,
    domain: site.domain,
    totalTours: validTours.length,
    toursWithDuration: toursWithDuration.length,
    prices: {
      min: minPrice,
      max: maxPrice,
      average: Math.round(avgPrice * 100) / 100,
      median: medianPrice
    },
    duration: {
      averageMinutes: Math.round(avgDuration),
      averageHours: Math.round(avgDuration / 60 * 10) / 10
    },
    pricePerMinute: {
      average: Math.round(avgPricePerMinute * 100) / 100,
      mostExpensive: mostExpensivePerMinute ? {
        title: mostExpensivePerMinute.title,
        value: Math.round(mostExpensivePerMinute.pricePerMinute * 100) / 100,
        price: mostExpensivePerMinute.price,
        duration: mostExpensivePerMinute.duration
      } : null,
      cheapest: cheapestPerMinute ? {
        title: cheapestPerMinute.title,
        value: Math.round(cheapestPerMinute.pricePerMinute * 100) / 100,
        price: cheapestPerMinute.price,
        duration: cheapestPerMinute.duration
      } : null
    },
    officialTicket: {
      price: site.officialTicketPrice,
      currency: site.officialTicketCurrency,
      avgTourVsOfficial: Math.round(tourVsOfficialRatio * 10) / 10
    },
    topProviders,
    topProviderConcentration: topProviders.length > 0
      ? Math.round((topProviders.slice(0, 3).reduce((a, b) => a + b[1], 0) / validTours.length) * 100)
      : 0
  };
}

// ========================================
// MAIN
// ========================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  📊 RESEARCH: Price Per Minute at Europe\'s Top Monuments  ║');
  console.log('║  Data sourced from 5 Intercoper travel sites              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const allStats = [];
  
  for (const site of SITES) {
    console.log(`\n🏛️ ${site.name} (${site.domain})`);
    console.log('─'.repeat(50));
    
    try {
      const tours = await fetchToursFromSite(site);
      if (!tours || tours.length === 0) {
        console.log('   ⚠️ No tours found');
        continue;
      }
      
      console.log(`   📦 ${tours.length} tours loaded`);
      
      const stats = calculateStats(tours, site);
      allStats.push(stats);
      
      console.log(`   💰 Price range: $${stats.prices.min} - $${stats.prices.max}`);
      console.log(`   💰 Average price: $${stats.prices.average}`);
      console.log(`   💰 Median price: $${stats.prices.median}`);
      console.log(`   ⏱️  Average duration: ${stats.duration.averageMinutes} min (${stats.duration.averageHours}h)`);
      console.log(`   📈 Average cost per minute: $${stats.pricePerMinute.average}`);
      if (stats.pricePerMinute.mostExpensive) {
        console.log(`   🔥 Most expensive/min: $${stats.pricePerMinute.mostExpensive.value}/min — ${stats.pricePerMinute.mostExpensive.title}`);
      }
      if (stats.pricePerMinute.cheapest) {
        console.log(`   💚 Cheapest/min: $${stats.pricePerMinute.cheapest.value}/min — ${stats.pricePerMinute.cheapest.title}`);
      }
      console.log(`   🎫 Official ticket: €${stats.officialTicket.price} | Avg tour is ${stats.officialTicket.avgTourVsOfficial}x official price`);
      console.log(`   🏢 Top 3 providers control ${stats.topProviderConcentration}% of tours`);
      
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }
  
  // ========================================
  // RANKING COMPARATIVO
  // ========================================
  if (allStats.length > 1) {
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          🏆 COMPARATIVE RANKING: Cost Per Minute          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const ranked = allStats
      .filter(s => s.pricePerMinute.average > 0)
      .sort((a, b) => b.pricePerMinute.average - a.pricePerMinute.average);
    
    ranked.forEach((s, i) => {
      const bar = '█'.repeat(Math.round(s.pricePerMinute.average * 10));
      console.log(`   ${i + 1}. ${s.monument.padEnd(30)} $${s.pricePerMinute.average.toFixed(2)}/min  ${bar}`);
    });
    
    if (ranked.length >= 2) {
      const most = ranked[0];
      const least = ranked[ranked.length - 1];
      const ratio = Math.round(most.pricePerMinute.average / least.pricePerMinute.average * 10) / 10;
      
      console.log(`\n   📰 KEY FINDING: ${most.monument} costs ${ratio}x more per minute than ${least.monument}`);
      console.log(`      ${most.monument}: $${most.pricePerMinute.average.toFixed(2)}/min (avg $${most.prices.average}, ${most.duration.averageMinutes} min)`);
      console.log(`      ${least.monument}: $${least.pricePerMinute.average.toFixed(2)}/min (avg $${least.prices.average}, ${least.duration.averageMinutes} min)`);
    }
    
    // Tour vs Official comparison
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     💶 TOUR PRICE vs OFFICIAL TICKET: The Real Markup     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const byMarkup = [...allStats].sort((a, b) => b.officialTicket.avgTourVsOfficial - a.officialTicket.avgTourVsOfficial);
    byMarkup.forEach((s, i) => {
      const bar = '█'.repeat(Math.round(s.officialTicket.avgTourVsOfficial));
      console.log(`   ${i + 1}. ${s.monument.padEnd(30)} ${s.officialTicket.avgTourVsOfficial}x markup  (€${s.officialTicket.price} → avg $${s.prices.average})  ${bar}`);
    });
    
    // Provider concentration
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       🏢 MARKET CONCENTRATION: Who Controls Access?       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    allStats.forEach(s => {
      console.log(`   ${s.monument} (${s.totalTours} tours):`);
      s.topProviders.forEach(([provider, count]) => {
        const pct = Math.round(count / s.totalTours * 100);
        const bar = '█'.repeat(Math.round(pct / 5));
        console.log(`      ${provider.padEnd(35)} ${count} tours (${pct}%)  ${bar}`);
      });
      console.log();
    });
  }
  
  // ========================================
  // GUARDAR DATOS
  // ========================================
  const output = {
    generatedAt: new Date().toISOString(),
    methodology: `Data extracted from ${allStats.reduce((a, s) => a + s.totalTours, 0)} tours across ${allStats.length} European monuments. Prices tracked via automated cron jobs scraping GetYourGuide. Duration parsed from tour listings. Cost per minute calculated as tour price divided by tour duration in minutes.`,
    sites: allStats
  };
  
  writeFileSync('./research-data.json', JSON.stringify(output, null, 2));
  console.log('\n📁 Data saved to research-data.json');
  console.log('Done!');
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });