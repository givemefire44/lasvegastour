import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ========================================
// DIAGNOSTICO DE RATING - GetYourGuide
// ========================================
// Inspecciona de donde sale el rating en una pagina de GYG para arreglar
// el scrape (que hoy agarra el primer "X out of 5" = casi siempre una resena 5*).
// Uso: node check-rating.mjs [urlOpcional]
// ========================================

const DEFAULT_URL = 'https://www.getyourguide.com/rome-l33/rome-small-group-colosseum-arena-and-forum-tour-adults-only-t138191/';
const url = process.argv[2] || DEFAULT_URL;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1920,1080'],
    ignoreHTTPSErrors: true
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    await page.waitForSelector('h1', { timeout: 15000 });

    const diag = await page.evaluate(() => {
      const out = {};
      const bodyText = document.body.innerText;

      out.finalUrl = location.href;
      out.h1 = (document.querySelector('h1')?.innerText || '').slice(0, 100);

      // 1) Lo que hace el cron HOY: el primer "X out of 5"
      const first = bodyText.match(/(\d+\.?\d*)\s*out of 5/i);
      out['1_cron_actual_agarra'] = first ? first[1] : null;

      // 2) TODOS los "X out of 5" en orden (para ver el match falso)
      const all = [...bodyText.matchAll(/(\d+\.?\d*)\s*out of 5/gi)].map(m => m[1]);
      out['2_todos_los_out_of_5'] = all.slice(0, 20);

      // 3) JSON-LD aggregateRating (la fuente confiable que queremos usar)
      const ld = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try {
          const data = JSON.parse(s.textContent);
          const stack = Array.isArray(data) ? [...data] : [data];
          while (stack.length) {
            const o = stack.pop();
            if (!o || typeof o !== 'object') continue;
            if (o.aggregateRating) {
              ld.push({
                type: o['@type'] || null,
                ratingValue: o.aggregateRating.ratingValue ?? null,
                reviewCount: o.aggregateRating.reviewCount ?? o.aggregateRating.ratingCount ?? null
              });
            }
            for (const v of Object.values(o)) {
              if (v && typeof v === 'object') stack.push(v);
            }
          }
        } catch (e) {}
      });
      out['3_json_ld_aggregateRating'] = ld;

      // 4) Selectores/atributos candidatos para el rating visible
      const sel = {};
      ['[itemprop="ratingValue"]', '[data-test-id*="rating"]', '[class*="rating"]', '[aria-label*="out of 5"]', '[aria-label*="Rated"]'].forEach(s => {
        const el = document.querySelector(s);
        sel[s] = el ? (el.getAttribute('aria-label') || el.getAttribute('content') || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90) : null;
      });
      out['4_selectores_candidatos'] = sel;

      return out;
    });

    console.log(JSON.stringify(diag, null, 2));
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await browser.close();
  }
})();