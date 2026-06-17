// extract-urls.js
// Extrae URLs de tours desde una pagina de busqueda/categoria de GetYourGuide (Las Vegas l58)
// Uso: node extract-urls.js "https://www.getyourguide.com/las-vegas-l58/..." [showMoreClicks] [--fresh]
//   --fresh  => vacia urls.txt antes de escribir (para tirar UNA categoria limpia por vez)
//   sin flag => acumula y deduplica contra lo que ya haya en urls.txt

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function extractUrls(searchUrl, maxClicks, fresh) {
  console.log('\nExtrayendo URLs de GetYourGuide (Las Vegas)...');
  console.log(`URL: ${searchUrl}`);
  console.log(`Modo: ${fresh ? 'FRESH (vacia urls.txt)' : 'ACUMULA + dedup'}\n`);

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

    // Filtrar: SOLO tours de Las Vegas (l58) y descartar productos en espanol (el site es 100% ingles)
    const spanishLocale = /getyourguide\.com\/es(-[a-z]{2})?\//;          // prefijo de locale espanol: /es/ o /es-es/
    const spanishSlug = /(en-espanol|espanol|español|in-spanish|-spanish-|-spanish\/)/; // idioma en el slug del producto

    const vegasUrls = urls.filter(url => {
      const lower = url.toLowerCase();
      // MUST: ser un tour de Las Vegas (location l58)
      if (!lower.includes('las-vegas-l58')) return false;
      // MUST NOT: ser un producto en espanol
      if (spanishLocale.test(lower) || spanishSlug.test(lower)) return false;
      return true;
    });

    const filteredOut = urls.length - vegasUrls.length;
    console.log(`Filtradas: ${vegasUrls.length} tours de Las Vegas (descartadas ${filteredOut}: fuera de l58 o en espanol)`);

    // Leer URLs existentes para evitar duplicados (salvo modo --fresh)
    const outputPath = 'urls.txt';
    let existingUrls = [];

    if (!fresh && fs.existsSync(outputPath)) {
      const existingContent = fs.readFileSync(outputPath, 'utf-8');
      existingUrls = existingContent
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(url => url.trim());
      console.log(`URLs existentes en archivo: ${existingUrls.length}`);
    }

    // Filtrar nuevas URLs (no duplicadas)
    const newUrls = vegasUrls.filter(url => !existingUrls.includes(url));
    const duplicateCount = vegasUrls.length - newUrls.length;

    console.log(`\nResultados:`);
    console.log(`   Total encontradas: ${urls.length}`);
    console.log(`   Filtradas (Las Vegas, sin espanol): ${vegasUrls.length}`);
    if (duplicateCount > 0) {
      console.log(`   Ya existian: ${duplicateCount}`);
    }
    console.log(`   URLs nuevas: ${newUrls.length}\n`);

    // Mostrar las nuevas
    if (newUrls.length > 0) {
      newUrls.forEach((url, i) => {
        console.log(`   ${i + 1}. ${url}`);
      });

      // Escribir: en fresh arranca de cero; si no, mantiene las existentes
      const allUrls = fresh ? newUrls : [...existingUrls, ...newUrls];
      const content = `# URLs de GetYourGuide - Las Vegas Tours\n# Actualizado: ${new Date().toISOString()}\n# Total: ${allUrls.length} tours\n\n${allUrls.join('\n')}\n`;

      fs.writeFileSync(outputPath, content);
      console.log(`\nGuardadas en ${outputPath} (total: ${allUrls.length})`);
    } else {
      console.log('   No hay URLs nuevas para agregar');
      if (fresh) {
        // En fresh, dejar el archivo vacio si no hubo resultados nuevos
        fs.writeFileSync(outputPath, `# URLs de GetYourGuide - Las Vegas Tours\n# Actualizado: ${new Date().toISOString()}\n# Total: 0 tours\n\n`);
      }
    }

    console.log(`\nPara importar: node src/index.js --batch`);

    return vegasUrls;

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
const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const positional = args.filter(a => !a.startsWith('--'));
const searchUrl = positional[0];
const maxClicks = parseInt(positional[1]) || 5;

if (!searchUrl) {
  console.log('Uso: node extract-urls.js "URL_DE_BUSQUEDA_GYG" [showMoreClicks] [--fresh]');
  console.log('');
  console.log('El segundo argumento = cantidad EXACTA de clicks de "show more" (GYG carga ~25 por click).');
  console.log('--fresh = vacia urls.txt antes de escribir (para tirar UNA categoria limpia por vez).');
  console.log('');
  console.log('Ejemplos:');
  console.log('  node extract-urls.js "https://www.getyourguide.com/las-vegas-l58/...helicopter..." 3 --fresh');
  console.log('  node extract-urls.js "https://www.getyourguide.com/las-vegas-l58/...shows..." 5');
  console.log('  (se frena solo antes si se acaba el boton "show more")');
  process.exit(1);
}

extractUrls(searchUrl, maxClicks, fresh);
// vegas-extract-urls
