// extract-urls.js
// Extrae URLs de tours desde una pagina de busqueda de GetYourGuide
// Uso: node extract-urls.js "https://www.getyourguide.com/s?q=vatican+tours" [showMoreClicks]

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function extractUrls(searchUrl, maxClicks) {
  console.log('\nExtrayendo URLs de GetYourGuide...');
  console.log(`URL: ${searchUrl}\n`);

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navegando a la pagina...');
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(3000);

    // Cargar resultados clickeando "show more" la cantidad EXACTA de veces indicada
    console.log(`Cargando resultados (hasta ${maxClicks} clicks de "show more")...`);

    // Scroll inicial para disparar el lazy-load y revelar el boton
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(2000);

    let clicks = 0;
    while (clicks < maxClicks) {
      // Traer el boton a la vista
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1200);

      const beforeCount = await page.evaluate(() =>
        document.querySelectorAll('a[href*="-t"]').length
      );

      const clicked = await page.evaluate(() => {
        const els = document.querySelectorAll('button, a[role="button"]');
        for (const el of els) {
          const text = (el.innerText || '').toLowerCase();
          if (text.includes('load more') || text.includes('show more')
            || text.includes('ver mas') || text.includes('ver más')
            || text.includes('mostrar mas') || text.includes('mostrar más')) {
            el.click();
            return true;
          }
        }
        return false;
      });

      if (!clicked) {
        console.log(`\n   No hay mas boton "show more" — se acabaron los resultados tras ${clicks} clicks.`);
        break;
      }

      clicks++;
      await delay(2500); // esperar que carguen los nuevos resultados

      let afterCount = await page.evaluate(() =>
        document.querySelectorAll('a[href*="-t"]').length
      );

      // Reintento corto si todavia no cargo nada
      if (afterCount === beforeCount) {
        await delay(2000);
        afterCount = await page.evaluate(() =>
          document.querySelectorAll('a[href*="-t"]').length
        );
      }

      process.stdout.write(`\r   Show more ${clicks}/${maxClicks}: ${afterCount} links cargados...`);

      if (afterCount === beforeCount) {
        console.log(`\n   El click ${clicks} no cargo nuevos resultados — corto aca.`);
        break;
      }
    }
    console.log('');

    console.log('\n\nExtrayendo URLs de tours...');

    // Extraer URLs de tours
    const urls = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="-t"]');
      const tourUrls = [];

      for (const link of links) {
        let href = link.href;
        if (!href) continue;

        if (!href.includes('getyourguide.com')) continue;
        if (!/\-t\d+/.test(href)) continue;

        const cleanUrl = href.split('?')[0].replace(/\/$/, '') + '/';

        if (!tourUrls.includes(cleanUrl)) {
          tourUrls.push(cleanUrl);
        }
      }

      return tourUrls;
    });

    console.log(`Total URLs encontradas: ${urls.length}`);

    // Filtrar solo tours del Vatican (descartar actividades no relacionadas)
    const vaticanUrls = urls.filter(url => {
      const lower = url.toLowerCase();
      // MUST contain a Vatican-related term
      const include = ['vatican', 'sistine', 'st-peter', 'saint-peter', 'peters', 'basilica', 'museums'];
      if (!include.some(word => lower.includes(word))) return false;
      // MUST NOT be these types (non-museum/basilica activities)
      const excluded = [
        'segway', 'bike', 'bicycle', 'cycling',
        'scooter', 'vespa', 'tuk-tuk', 'tuktuk',
        'hop-on', 'hop-off', 'bus-tour',
        'pub-crawl', 'bar-crawl', 'nightlife',
        'airport', 'transfer',
        'escape-game', 'escape-room',
        'cooking', 'baking', 'pizza-making', 'pasta-making',
        'flamenco', 'cabaret',
        'kayak', 'sailing', 'boat-party',
        'running-tour', 'jogging',
        'photo-shoot', 'photoshoot',
        'limousine', 'ferrari',
        'theme-park'
      ];
      return !excluded.some(word => lower.includes(word));
    });

    const filteredOut = urls.length - vaticanUrls.length;
    console.log(`Filtradas: ${vaticanUrls.length} tours del Vatican (descartadas ${filteredOut} no relevantes)`);

    // Leer URLs existentes para evitar duplicados
    const outputPath = 'urls.txt';
    let existingUrls = [];

    if (fs.existsSync(outputPath)) {
      const existingContent = fs.readFileSync(outputPath, 'utf-8');
      existingUrls = existingContent
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(url => url.trim());
      console.log(`URLs existentes en archivo: ${existingUrls.length}`);
    }

    // Filtrar nuevas URLs (no duplicadas)
    const newUrls = vaticanUrls.filter(url => !existingUrls.includes(url));
    const duplicateCount = vaticanUrls.length - newUrls.length;

    console.log(`\nResultados:`);
    console.log(`   Total encontradas: ${urls.length}`);
    console.log(`   Filtradas (solo Vatican): ${vaticanUrls.length}`);
    if (duplicateCount > 0) {
      console.log(`   Ya existian: ${duplicateCount}`);
    }
    console.log(`   URLs nuevas: ${newUrls.length}\n`);

    // Mostrar las nuevas
    if (newUrls.length > 0) {
      newUrls.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });

      // Agregar nuevas URLs al archivo (mantener las existentes)
      const allUrls = [...existingUrls, ...newUrls];
      const content = `# URLs de GetYourGuide - Vatican Tours\n# Actualizado: ${new Date().toISOString()}\n# Total: ${allUrls.length} tours\n\n${allUrls.join('\n')}\n`;

      fs.writeFileSync(outputPath, content);
      console.log(`\nGuardadas en ${outputPath} (total: ${allUrls.length})`);
    } else {
      console.log('   No hay URLs nuevas para agregar');
    }

    console.log(`\nPara importar: node src/index.js --batch`);

    return vaticanUrls;

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main
const searchUrl = process.argv[2];
const maxClicks = parseInt(process.argv[3]) || 5;

if (!searchUrl) {
  console.log('Uso: node extract-urls.js "URL_DE_BUSQUEDA" [showMoreClicks]');
  console.log('');
  console.log('El segundo argumento = cantidad EXACTA de clicks de "show more" (GYG carga ~25 por click).');
  console.log('Ejemplos:');
  console.log('  node extract-urls.js "https://www.getyourguide.com/s?q=vatican+tours" 5     # ~150 tours (5 show more)');
  console.log('  node extract-urls.js "https://www.getyourguide.com/s?q=vatican+tours" 10    # ~275 tours (10 show more)');
  console.log('  (se frena solo antes si se acaba el boton "show more")');
  process.exit(1);
}

extractUrls(searchUrl, maxClicks);
