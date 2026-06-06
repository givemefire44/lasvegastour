import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import { createClient } from '@sanity/client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ========================================
// CONFIGURACIÓN POR COMANDO
// ========================================
// Sin --execute = DRY RUN (solo muestra)
// Con --execute = PRODUCCIÓN (modifica Sanity)
//
// Uso:
//   node fix-prices.mjs slug-del-tour              → DRY RUN un tour
//   node fix-prices.mjs slug-del-tour --execute    → PATCHEA un tour
//   node fix-prices.mjs                            → DRY RUN todos
//   node fix-prices.mjs --execute                  → PATCHEA todos
// ========================================

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const slugArg = args.find(a => !a.startsWith('--'));
const DELAY_BETWEEN_TOURS = 15000;

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(min + Math.random() * (max - min));

async function scrapePrice(url) {
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
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await randomDelay(3000, 5000);
    await page.waitForSelector('h1', { timeout: 15000 });

    const price = await page.evaluate(() => {
      let price = 0;

      const mainPrice = document.querySelector('.price-info-actual-price-explanation ins');
      if (mainPrice) {
        const priceMatch = mainPrice.innerText.match(/\$(\d+[\d,]*)/);
        if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ''));
      }

      if (price === 0) {
        const discountedPrice = document.querySelector('[style*="--label-discounted"]');
        if (discountedPrice) {
          const priceMatch = discountedPrice.innerText.match(/\$(\d+[\d,]*)/);
          if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ''));
        }
      }

      if (price === 0) {
        const headerPrice = document.querySelector('[data-test-id="activity-price"] ins, [data-test-id="booking-price"] ins');
        if (headerPrice) {
          const priceMatch = headerPrice.innerText.match(/\$(\d+[\d,]*)/);
          if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ''));
        }
      }

      return price;
    });

    return price;
  } catch (error) {
    console.error(`   ❌ Error scraping: ${error.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

function fixPriceInBody(body, oldPrice, newPrice) {
  if (!body || !Array.isArray(body)) return { body, changes: 0 };
  const oldStr = `$${oldPrice}`;
  const newStr = `$${newPrice}`;
  let changes = 0;
  const fixedBody = body.map(block => {
    if (!block.children || !Array.isArray(block.children)) return block;
    const fixedChildren = block.children.map(child => {
      if (typeof child.text === 'string' && child.text.includes(oldStr)) {
        changes++;
        return { ...child, text: child.text.replaceAll(oldStr, newStr) };
      }
      return child;
    });
    return { ...block, children: fixedChildren };
  });
  return { body: fixedBody, changes };
}

function fixPriceInText(text, oldPrice, newPrice) {
  if (!text) return { text: null, changed: false };
  const oldStr = `$${oldPrice}`;
  const newStr = `$${newPrice}`;
  if (text.includes(oldStr)) return { text: text.replaceAll(oldStr, newStr), changed: true };
  return { text, changed: false };
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   💰 COLOSSEUM PRICE FIXER — colosseumroman.com     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`🔧 Modo: ${DRY_RUN ? 'DRY RUN (solo muestra, no modifica)' : '⚠️ PRODUCCIÓN (modifica Sanity)'}`);
  console.log(`⏱️  Delay entre tours: ${DELAY_BETWEEN_TOURS / 1000}s\n`);

  let query;
  if (slugArg) {
    query = `*[_type == "post" && slug.current == "${slugArg}" && !(_id in path("drafts.**"))] {
      _id, title, "oldPrice": tourInfo.price, "gygUrl": getYourGuideUrl, seoDescription, editorialReview, body
    }`;
    console.log(`🎯 Modo single: ${slugArg}\n`);
  } else {
    query = `*[_type == "post" && defined(tourInfo.price) && defined(getYourGuideUrl) && !(_id in path("drafts.**"))] | order(_createdAt asc) {
      _id, title, "oldPrice": tourInfo.price, "gygUrl": getYourGuideUrl, seoDescription, editorialReview, body
    }`;
    console.log(`📦 Modo batch: todos los tours\n`);
  }

  console.log('📥 Cargando tours de Sanity...');
  const tours = await sanityClient.fetch(query);
  console.log(`   ${tours.length} tours encontrados\n`);

  if (tours.length === 0) {
    console.log('❌ No se encontraron tours. Verificá el slug.');
    process.exit(1);
  }

  const results = { unchanged: 0, fixed: 0, errors: 0, scrapeFailures: 0 };

  for (let i = 0; i < tours.length; i++) {
    const tour = tours[i];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${i + 1}/${tours.length}] ${tour.title}`);
    console.log(`   Precio Sanity: $${tour.oldPrice}`);
    console.log(`   URL: ${tour.gygUrl}`);

    const newPrice = await scrapePrice(tour.gygUrl);

    if (newPrice === null || newPrice === 0) {
      console.log(`   ❌ No se pudo obtener precio — SKIP`);
      results.scrapeFailures++;
      if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
      continue;
    }

    console.log(`   Precio GYG: $${newPrice}`);

    if (newPrice === tour.oldPrice) {
      console.log(`   ✅ Precio correcto — no hay cambios`);
      results.unchanged++;
      if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
      continue;
    }

    console.log(`   🔄 DIFERENCIA: $${tour.oldPrice} → $${newPrice}`);

    const { body: fixedBody, changes: bodyChanges } = fixPriceInBody(tour.body, tour.oldPrice, newPrice);
    console.log(`   📝 Body: ${bodyChanges} reemplazos`);
    const { text: fixedSeo, changed: seoChanged } = fixPriceInText(tour.seoDescription, tour.oldPrice, newPrice);
    console.log(`   📝 SEO Description: ${seoChanged ? 'corregido' : 'sin cambios'}`);
    const { text: fixedReview, changed: reviewChanged } = fixPriceInText(tour.editorialReview, tour.oldPrice, newPrice);
    console.log(`   📝 Editorial Review: ${reviewChanged ? 'corregido' : 'sin cambios'}`);

    if (!DRY_RUN) {
      try {
        const patch = sanityClient.patch(tour._id).set({ 'tourInfo.price': newPrice });
        if (bodyChanges > 0) patch.set({ body: fixedBody });
        if (seoChanged) patch.set({ seoDescription: fixedSeo });
        if (reviewChanged) patch.set({ editorialReview: fixedReview });
        await patch.commit();
        console.log(`   ✅ Sanity actualizado`);
        results.fixed++;
      } catch (error) {
        console.log(`   ❌ Error patcheando: ${error.message}`);
        results.errors++;
      }
    } else {
      console.log(`   🧪 DRY RUN — no se modificó nada`);
      results.fixed++;
    }

    if (i < tours.length - 1) {
      console.log(`   ⏱️ Esperando ${DELAY_BETWEEN_TOURS / 1000}s...`);
      await delay(DELAY_BETWEEN_TOURS);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                  📊 RESUMEN FINAL                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Precio correcto (sin cambios): ${results.unchanged}`);
  console.log(`🔄 Precios corregidos: ${results.fixed}`);
  console.log(`❌ Errores al patchear: ${results.errors}`);
  console.log(`⚠️ Fallos de scraping: ${results.scrapeFailures}`);
  console.log(`\n📊 Total procesados: ${tours.length}`);
  if (DRY_RUN) console.log(`\n🧪 Esto fue DRY RUN. Para aplicar cambios, agregá --execute`);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });