import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import { createClient } from '@sanity/client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ========================================
// CONFIGURACIÓN
// ========================================
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const DELAY_BETWEEN = 5000;

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ========================================
// RESOLVER URL CORTA → URL COMPLETA DE GYG
// ========================================
async function resolveShortUrl(shortUrl) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navegar a la URL corta — Puppeteer sigue redirecciones automáticamente
    await page.goto(shortUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // La URL final después de redirecciones
    const finalUrl = page.url();

    // Validar que llegamos a GYG
    if (!finalUrl.includes('getyourguide.com')) {
      return { url: null, error: `Redirigió a URL no-GYG: ${finalUrl}` };
    }

    // Limpiar: quedarnos solo con la URL base sin parámetros de tracking
    const urlObj = new URL(finalUrl);
    const cleanUrl = urlObj.origin + urlObj.pathname;

    // Quitar trailing slash si lo tiene
    const normalizedUrl = cleanUrl.endsWith('/') ? cleanUrl : cleanUrl + '/';

    return { url: normalizedUrl, error: null };
  } catch (error) {
    return { url: null, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

// ========================================
// SCRIPT PRINCIPAL
// ========================================
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   🔗 GYG URL RESOLVER — colosseumroman.com          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`🔧 Modo: ${DRY_RUN ? 'DRY RUN (solo muestra)' : '⚠️ PRODUCCIÓN (modifica Sanity)'}\n`);

  // Buscar tours con bookingUrl pero sin getYourGuideUrl
  const tours = await sanityClient.fetch(`
    *[_type == "post" && defined(bookingUrl) && !defined(getYourGuideUrl) && !(_id in path("drafts.**"))]{
      _id, title, "slug": slug.current, bookingUrl
    }
  `);

  console.log(`📥 Tours sin getYourGuideUrl: ${tours.length}\n`);

  if (tours.length === 0) {
    console.log('✅ Todos los tours tienen getYourGuideUrl. Nada que hacer.');
    return;
  }

  let resolved = 0;
  let errors = 0;

  for (let i = 0; i < tours.length; i++) {
    const tour = tours[i];
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${i + 1}/${tours.length}] ${tour.title}`);
    console.log(`   Short URL: ${tour.bookingUrl}`);

    const result = await resolveShortUrl(tour.bookingUrl);

    if (!result.url) {
      console.log(`   ❌ Error: ${result.error}`);
      errors++;
      if (i < tours.length - 1) await delay(DELAY_BETWEEN);
      continue;
    }

    console.log(`   ✅ GYG URL: ${result.url}`);

    if (!DRY_RUN) {
      try {
        await sanityClient.patch(tour._id)
          .set({ getYourGuideUrl: result.url })
          .commit();
        console.log(`   ✅ Sanity actualizado`);
        resolved++;
      } catch (error) {
        console.log(`   ❌ Error patcheando: ${error.message}`);
        errors++;
      }
    } else {
      console.log(`   🧪 DRY RUN — no se modificó`);
      resolved++;
    }

    if (i < tours.length - 1) await delay(DELAY_BETWEEN);
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                  📊 RESUMEN                          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`✅ URLs resueltas: ${resolved}`);
  console.log(`❌ Errores: ${errors}`);
  console.log(`📊 Total: ${tours.length}`);
  if (DRY_RUN) console.log(`\n🧪 DRY RUN. Para aplicar: agregar --execute`);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });