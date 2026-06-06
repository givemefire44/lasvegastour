import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import { createClient } from '@sanity/client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// ========================================
// CONFIGURACION
// ========================================
const SITE_NAME = 'colosseumroman.com';
const DELAY_BETWEEN_TOURS = 15000;

// UMBRALES DE SEGURIDAD
const MAX_PRICE_CHANGE_PERCENT = 120;
const MIN_PRICE = 5;
const MAX_PRICE = 2000;
const GLOBAL_FAILURE_THRESHOLD = 50;

// ALERTA POR EMAIL (Resend) - solo cuando hay bajas nuevas
const ALERT_EMAIL = 'damefuego2020@gmail.com';
const ALERT_FROM = 'ColosseumRoman Cron <onboarding@resend.dev>';
// Reintentos antes de confirmar una actividad como muerta
const DEAD_RETRIES = 3;

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const slugArg = args.find(a => !a.startsWith('--'));

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min, max) => delay(min + Math.random() * (max - min));
const activityId = (u) => { const m = (u || '').match(/-t(\d+)/); return m ? m[1] : null; };

// ========================================
// SCRAPE PRECIO + RATING + REVIEWS + DETECCION DE MUERTA
// ========================================
async function scrapeTourData(url) {
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

    // >>> DETECCION DE ACTIVIDAD MUERTA <<<
    // Si la URL final perdio el -t<id>, GYG rebotó a /rome-l33/ = actividad discontinuada.
    const finalUrl = page.url();
    const origId = activityId(url);
    const finalId = activityId(finalUrl);
    const activityDead = !!(origId && origId !== finalId);

    if (activityDead) {
      return { activityDead: true, finalUrl, price: null, rating: null, reviewCount: null, priceSelectorFound: false };
    }

    const result = await page.evaluate(() => {
      // PRECIO - solo selector primario, sin fallbacks
      let price = null;
      const mainPrice = document.querySelector('.price-info-actual-price-explanation ins');
      if (mainPrice) {
        const priceMatch = mainPrice.innerText.match(/\$(\d+[\d,]*)/);
        if (priceMatch) price = parseFloat(priceMatch[1].replace(/,/g, ''));
      }

      // RATING + REVIEW COUNT desde JSON-LD aggregateRating (fuente canonica).
      // El texto "X out of 5" agarra resenas individuales (casi siempre 5), por eso
      // antes daba 5 en vez del agregado. GYG guarda el promedio crudo en JSON-LD
      // (ej 4.7682...); lo redondeamos a 1 decimal para que coincida con lo que muestra (4.8).
      let rating = null;
      let reviewCount = null;
      const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of ldScripts) {
        try {
          const data = JSON.parse(s.textContent);
          const stack = Array.isArray(data) ? [...data] : [data];
          while (stack.length) {
            const o = stack.pop();
            if (!o || typeof o !== 'object') continue;
            if (o.aggregateRating && o.aggregateRating.ratingValue != null) {
              rating = Math.round(parseFloat(o.aggregateRating.ratingValue) * 10) / 10;
              const rc = o.aggregateRating.reviewCount ?? o.aggregateRating.ratingCount;
              if (rc != null) reviewCount = parseInt(String(rc).replace(/,/g, ''), 10);
            }
            for (const v of Object.values(o)) if (v && typeof v === 'object') stack.push(v);
          }
        } catch (e) {}
      }
      // Fallback al texto SOLO si no hubo JSON-LD
      const bodyText = document.body.innerText;
      if (rating === null) {
        const m = bodyText.match(/(\d+\.?\d*)\s*out of 5/i);
        if (m) rating = parseFloat(m[1]);
      }
      if (reviewCount === null) {
        const m = bodyText.match(/(\d+[\d,]*)\s*reviews/i);
        if (m) reviewCount = parseInt(m[1].replace(/,/g, ''), 10);
      }

      return { price, rating, reviewCount, priceSelectorFound: !!mainPrice };
    });

    return { activityDead: false, finalUrl, ...result };
  } catch (error) {
    return { activityDead: false, price: null, rating: null, reviewCount: null, priceSelectorFound: false, error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}

// ========================================
// SCRAPE CON REINTENTOS - confirma MUERTA solo si TODOS los intentos rebotan
// ========================================
// - Si una carga vuelve viva (mantiene el -t<id>) -> devuelve esa data al toque (1 intento).
// - Un rebote (perdio -t<id>) cuenta como "bounce"; un error/timeout NO es bounce.
// - confirmedDead = true SOLO si los N intentos rebotaron (evidencia inequivoca).
// - Cualquier mezcla (rebote + error, o todo error) = inconcluso -> NO se retira,
//   se trata como fallo normal y se rechequea en la proxima corrida.
async function scrapeWithRetries(url, maxAttempts = DEAD_RETRIES) {
  let bounces = 0;
  let lastResult = null;
  let lastBounceUrl = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await scrapeTourData(url);
    lastResult = r;

    if (r.error) {
      console.log(`      intento ${attempt}/${maxAttempts}: error de carga (${r.error})`);
      if (attempt < maxAttempts) await randomDelay(4000, 7000);
      continue;
    }

    if (r.activityDead) {
      bounces++;
      lastBounceUrl = r.finalUrl;
      console.log(`      intento ${attempt}/${maxAttempts}: rebotó -> ${r.finalUrl}`);
      if (attempt < maxAttempts) await randomDelay(4000, 7000);
      continue;
    }

    // Cargó bien y mantuvo el -t<id> => VIVA. Corta y devuelve.
    return { ...r, confirmedDead: false };
  }

  // Ningún intento volvió vivo. Solo confirmamos muerta si los N rebotaron.
  const confirmedDead = bounces === maxAttempts;
  if (!confirmedDead) {
    console.log(`      inconcluso (${bounces}/${maxAttempts} rebotes) -> NO se retira, se rechequea`);
  }
  return { ...lastResult, confirmedDead, bounces, finalUrl: lastBounceUrl || lastResult?.finalUrl };
}

// ========================================
// VALIDAR PRECIO
// ========================================
function validatePrice(oldPrice, newPrice) {
  const issues = [];
  if (newPrice < MIN_PRICE) issues.push(`Precio $${newPrice} menor al minimo $${MIN_PRICE}`);
  if (newPrice > MAX_PRICE) issues.push(`Precio $${newPrice} mayor al maximo $${MAX_PRICE}`);
  if (oldPrice > 0) {
    const changePercent = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
    if (changePercent > MAX_PRICE_CHANGE_PERCENT) issues.push(`Cambio de ${changePercent.toFixed(1)}% excede umbral de ${MAX_PRICE_CHANGE_PERCENT}% ($${oldPrice} -> $${newPrice})`);
  }
  if (!Number.isFinite(newPrice) || newPrice <= 0) issues.push(`Precio invalido: ${newPrice}`);
  return { valid: issues.length === 0, issues };
}

// ========================================
// REEMPLAZAR PRECIO EN PORTABLE TEXT BODY
// ========================================
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

// ========================================
// REEMPLAZAR RATING Y REVIEWS EN BODY
// ========================================
function fixRatingInBody(body, oldRating, oldReviews, newRating, newReviews) {
  if (!body || !Array.isArray(body)) return { body, changes: 0 };
  let changes = 0;
  const oldRatingStr = `${oldRating}/5`;
  const newRatingStr = `${newRating}/5`;
  const oldReviewStr = `(${oldReviews} review`;
  const newReviewStr = `(${newReviews} review`;

  const fixedBody = body.map(block => {
    if (!block.children || !Array.isArray(block.children)) return block;
    const fixedChildren = block.children.map(child => {
      if (typeof child.text !== 'string') return child;
      let newText = child.text;
      let changed = false;
      if (oldRating !== newRating && newText.includes(oldRatingStr)) {
        newText = newText.replaceAll(oldRatingStr, newRatingStr);
        changed = true;
      }
      if (oldReviews !== newReviews && newText.includes(oldReviewStr)) {
        newText = newText.replaceAll(oldReviewStr, newReviewStr);
        changed = true;
      }
      if (changed) { changes++; return { ...child, text: newText }; }
      return child;
    });
    return { ...block, children: fixedChildren };
  });
  return { body: fixedBody, changes };
}

// ========================================
// REEMPLAZAR EN TEXTO PLANO
// ========================================
function fixPriceInText(text, oldPrice, newPrice) {
  if (!text) return { text: null, changed: false };
  const oldStr = `$${oldPrice}`;
  const newStr = `$${newPrice}`;
  if (text.includes(oldStr)) return { text: text.replaceAll(oldStr, newStr), changed: true };
  return { text, changed: false };
}

function fixRatingInText(text, oldRating, oldReviews, newRating, newReviews) {
  if (!text) return { text: null, changed: false };
  let newText = text;
  let changed = false;
  if (oldRating !== newRating && newText.includes(`${oldRating}/5`)) {
    newText = newText.replaceAll(`${oldRating}/5`, `${newRating}/5`);
    changed = true;
  }
  if (oldReviews !== newReviews && newText.includes(`${oldReviews} review`)) {
    newText = newText.replaceAll(`${oldReviews} review`, `${newReviews} review`);
    changed = true;
  }
  return { text: newText, changed };
}

// ========================================
// INDEXNOW - Notificar a Bing
// ========================================
async function notifyIndexNow(updatedSlugs) {
  if (updatedSlugs.length === 0) {
    console.log('\nIndexNow: sin URLs para notificar');
    return;
  }

  const urlList = updatedSlugs.map(slug => `https://${SITE_NAME}/tour/${slug}`);

  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: SITE_NAME,
        key: '5748a39a308b48b8a6b5d5bdbe288a9d',
        urlList: urlList.slice(0, 100)
      })
    });
    console.log(`\nIndexNow: ${urlList.length} URLs enviadas -> ${response.status} ${response.statusText}`);
  } catch (error) {
    console.log(`\nIndexNow: error -> ${error.message}`);
  }
}

// ========================================
// EMAIL DE BAJAS - Resend (solo cuando hay tours discontinuados nuevos)
// ========================================
async function notifyDeadByEmail(deadList) {
  if (!deadList || deadList.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('\nEmail: RESEND_API_KEY no configurada -> se omite el aviso');
    return;
  }

  const rows = deadList.map(t => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #e2e2e2;font-family:monospace">${t.slug}</td>
      <td style="padding:8px 12px;border:1px solid #e2e2e2">${t.title}</td>
      <td style="padding:8px 12px;border:1px solid #e2e2e2"><a href="${t.finalUrl}">rebote</a></td>
    </tr>`).join('');

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:640px">
      <h2 style="color:#b91c1c;margin:0 0 4px">🔴 ${deadList.length} tour(es) discontinuado(s) en ${SITE_NAME}</h2>
      <p style="color:#444;margin:0 0 16px">
        El cron detectó que estas actividades ya no existen en GetYourGuide (rebotaron ${DEAD_RETRIES}/${DEAD_RETRIES} veces).
        Quedaron marcadas <strong>activeOnGyg = false</strong> y excluidas del scrapeo de precios.
        Para retirarlas (301 al hub + fuera de sitemap/listados), poné <strong>discontinued = true</strong> en Sanity Studio.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;border:1px solid #e2e2e2;text-align:left">slug</th>
            <th style="padding:8px 12px;border:1px solid #e2e2e2;text-align:left">título</th>
            <th style="padding:8px 12px;border:1px solid #e2e2e2;text-align:left">link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px">Aviso automático — ${new Date().toISOString()}</p>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: [ALERT_EMAIL],
        subject: `🔴 ${deadList.length} tour(es) discontinuado(s) en ${SITE_NAME}`,
        html
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`\nEmail enviado a ${ALERT_EMAIL} (${deadList.length} bajas) -> id ${data.id || '?'}`);
    } else {
      console.log(`\nEmail: error ${res.status} -> ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.log(`\nEmail: excepción -> ${error.message}`);
  }
}

// ========================================
// SCRIPT PRINCIPAL
// ========================================
async function main() {
  const startTime = Date.now();
  console.log('========================================');
  console.log(`  PRICE & RATING CRON - ${SITE_NAME}`);
  console.log('========================================\n');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (solo muestra)' : 'PRODUCCION (modifica Sanity)'}`);
  console.log(`Umbrales: max cambio ${MAX_PRICE_CHANGE_PERCENT}%, rango $${MIN_PRICE}-$${MAX_PRICE}, abort si >${GLOBAL_FAILURE_THRESHOLD}% falla`);
  console.log(`Delay: ${DELAY_BETWEEN_TOURS / 1000}s\n`);

  let query;
  if (slugArg) {
    query = `*[_type == "post" && slug.current == "${slugArg}" && !(_id in path("drafts.**"))] {
      _id, title, "slug": slug.current,
      "oldPrice": tourInfo.price,
      "oldRating": getYourGuideData.rating,
      "oldReviews": getYourGuideData.reviewCount,
      "gygUrl": getYourGuideUrl,
      seoDescription, editorialReview, body
    }`;
    console.log(`Modo single: ${slugArg}\n`);
  } else {
    // Ignora las ya marcadas como muertas (activeOnGyg == false)
    query = `*[_type == "post" && defined(tourInfo.price) && defined(getYourGuideUrl) && (activeOnGyg != false) && !(_id in path("drafts.**"))] | order(_createdAt asc) {
      _id, title, "slug": slug.current,
      "oldPrice": tourInfo.price,
      "oldRating": getYourGuideData.rating,
      "oldReviews": getYourGuideData.reviewCount,
      "gygUrl": getYourGuideUrl,
      seoDescription, editorialReview, body
    }`;
    console.log(`Modo batch: todos los tours activos\n`);
  }

  console.log('Cargando tours de Sanity...');
  const tours = await sanityClient.fetch(query);
  console.log(`   ${tours.length} tours encontrados\n`);

  if (tours.length === 0) { console.log('No se encontraron tours.'); process.exit(1); }

  const results = {
    unchanged: 0, priceFixed: 0, ratingFixed: 0, errors: 0,
    scrapeFailures: 0, selectorMissing: 0, validationBlocked: 0, deadActivities: 0,
    details: { changed: [], blocked: [], failed: [], dead: [] }
  };

  for (let i = 0; i < tours.length; i++) {
    const tour = tours[i];
    console.log(`----------------------------------------`);
    console.log(`[${i + 1}/${tours.length}] ${tour.title}`);
    console.log(`   Sanity: $${tour.oldPrice} | ${tour.oldRating}/5 (${tour.oldReviews} reviews)`);

    // El abort por fallas NO cuenta las muertas (son esperadas, no fallas de HTML)
    const totalProcessed = results.unchanged + results.priceFixed + results.ratingFixed + results.errors + results.scrapeFailures + results.selectorMissing + results.validationBlocked;
    if (totalProcessed > 10) {
      const failRate = (results.scrapeFailures + results.selectorMissing) / totalProcessed * 100;
      if (failRate > GLOBAL_FAILURE_THRESHOLD) {
        console.log(`\nABORT: ${failRate.toFixed(0)}% fallaron. Posible cambio en HTML de GYG.`);
        break;
      }
    }

    const scrapeResult = await scrapeWithRetries(tour.gygUrl, DEAD_RETRIES);

    // >>> RAMA NUEVA: ACTIVIDAD MUERTA CONFIRMADA (los 3 intentos rebotaron) <<<
    if (scrapeResult.confirmedDead) {
      console.log(`   MUERTA confirmada (${scrapeResult.bounces}/${DEAD_RETRIES}) -> ${scrapeResult.finalUrl}`);
      results.deadActivities++;
      results.details.dead.push({ title: tour.title, slug: tour.slug, finalUrl: scrapeResult.finalUrl });
      if (!DRY_RUN) {
        try {
          await sanityClient.patch(tour._id)
            .setIfMissing({ deadSince: new Date().toISOString().split('T')[0] })
            .set({ activeOnGyg: false })
            .commit();
          console.log(`   Marcada activeOnGyg=false (no se toca precio/reviews)`);
        } catch (error) {
          console.log(`   Error marcando: ${error.message}`);
          results.errors++;
        }
      } else {
        console.log(`   DRY RUN -> marcaria activeOnGyg=false`);
      }
      if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
      continue;
    }

    if (!scrapeResult.priceSelectorFound) {
      console.log(`   SELECTOR NO ENCONTRADO - no se toca`);
      if (scrapeResult.error) console.log(`   Error: ${scrapeResult.error}`);
      results.selectorMissing++;
      results.details.failed.push({ title: tour.title, slug: tour.slug, reason: 'Selector no encontrado' });
      if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
      continue;
    }

    if (scrapeResult.price === null) {
      console.log(`   NO SE PUDO PARSEAR PRECIO - no se toca`);
      results.scrapeFailures++;
      results.details.failed.push({ title: tour.title, slug: tour.slug, reason: 'Precio no parseado' });
      if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
      continue;
    }

    const newPrice = scrapeResult.price;
    const newRating = scrapeResult.rating || tour.oldRating;
    const newReviews = scrapeResult.reviewCount || tour.oldReviews;

    console.log(`   GYG:    $${newPrice} | ${newRating}/5 (${newReviews} reviews)`);

    const priceChanged = newPrice !== tour.oldPrice;
    const ratingChanged = newRating !== tour.oldRating;
    const reviewsChanged = newReviews !== tour.oldReviews;

    if (!priceChanged && !ratingChanged && !reviewsChanged) {
      console.log(`   Todo correcto`);
      results.unchanged++;
      if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
      continue;
    }

    if (priceChanged) {
      const validation = validatePrice(tour.oldPrice, newPrice);
      if (!validation.valid) {
        console.log(`   PRECIO BLOQUEADO:`);
        validation.issues.forEach(issue => console.log(`      - ${issue}`));
        results.validationBlocked++;
        results.details.blocked.push({ title: tour.title, slug: tour.slug, oldPrice: tour.oldPrice, newPrice, issues: validation.issues });
        if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
        continue;
      }
    }

    if (priceChanged) console.log(`   Precio: $${tour.oldPrice} -> $${newPrice}`);
    if (ratingChanged) console.log(`   Rating: ${tour.oldRating} -> ${newRating}`);
    if (reviewsChanged) console.log(`   Reviews: ${tour.oldReviews} -> ${newReviews}`);

    let currentBody = tour.body;
    let totalBodyChanges = 0;

    if (priceChanged) {
      const { body: fixedBody, changes } = fixPriceInBody(currentBody, tour.oldPrice, newPrice);
      currentBody = fixedBody;
      totalBodyChanges += changes;
      console.log(`   Body precio: ${changes} reemplazos`);
    }

    if (ratingChanged || reviewsChanged) {
      const { body: fixedBody, changes } = fixRatingInBody(currentBody, tour.oldRating, tour.oldReviews, newRating, newReviews);
      currentBody = fixedBody;
      totalBodyChanges += changes;
      console.log(`   Body rating/reviews: ${changes} reemplazos`);
    }

    let currentSeo = tour.seoDescription;
    let seoChanged = false;
    if (priceChanged) { const r = fixPriceInText(currentSeo, tour.oldPrice, newPrice); if (r.changed) { currentSeo = r.text; seoChanged = true; } }
    if (ratingChanged || reviewsChanged) { const r = fixRatingInText(currentSeo, tour.oldRating, tour.oldReviews, newRating, newReviews); if (r.changed) { currentSeo = r.text; seoChanged = true; } }
    console.log(`   SEO: ${seoChanged ? 'corregido' : 'sin cambios'}`);

    let currentReview = tour.editorialReview;
    let reviewTextChanged = false;
    if (priceChanged) { const r = fixPriceInText(currentReview, tour.oldPrice, newPrice); if (r.changed) { currentReview = r.text; reviewTextChanged = true; } }
    if (ratingChanged || reviewsChanged) { const r = fixRatingInText(currentReview, tour.oldRating, tour.oldReviews, newRating, newReviews); if (r.changed) { currentReview = r.text; reviewTextChanged = true; } }
    console.log(`   Review: ${reviewTextChanged ? 'corregido' : 'sin cambios'}`);

    if (!DRY_RUN) {
      try {
        const patch = sanityClient.patch(tour._id);
        if (priceChanged) patch.set({ 'tourInfo.price': newPrice });
        if (ratingChanged) patch.set({ 'getYourGuideData.rating': newRating });
        if (reviewsChanged) patch.set({ 'getYourGuideData.reviewCount': newReviews });
        if (totalBodyChanges > 0) patch.set({ body: currentBody });
        if (seoChanged) patch.set({ seoDescription: currentSeo });
        if (reviewTextChanged) patch.set({ editorialReview: currentReview });
        await patch.commit();
        console.log(`   Sanity actualizado`);
        if (priceChanged) results.priceFixed++;
        if (ratingChanged || reviewsChanged) results.ratingFixed++;
        results.details.changed.push({ title: tour.title, slug: tour.slug, price: priceChanged ? `$${tour.oldPrice}->$${newPrice}` : '-', rating: ratingChanged ? `${tour.oldRating}->${newRating}` : '-', reviews: reviewsChanged ? `${tour.oldReviews}->${newReviews}` : '-' });
      } catch (error) {
        console.log(`   Error: ${error.message}`);
        results.errors++;
      }
    } else {
      console.log(`   DRY RUN - no se modifico`);
      if (priceChanged) results.priceFixed++;
      if (ratingChanged || reviewsChanged) results.ratingFixed++;
      results.details.changed.push({ title: tour.title, slug: tour.slug, price: priceChanged ? `$${tour.oldPrice}->$${newPrice}` : '-', rating: ratingChanged ? `${tour.oldRating}->${newRating}` : '-', reviews: reviewsChanged ? `${tour.oldReviews}->${newReviews}` : '-' });
    }

    if (i < tours.length - 1) await delay(DELAY_BETWEEN_TOURS);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n========================================');
  console.log(`  RESUMEN - ${SITE_NAME}`);
  console.log('========================================\n');
  console.log(`Sin cambios: ${results.unchanged}`);
  console.log(`Precios actualizados: ${results.priceFixed}`);
  console.log(`Rating/reviews actualizados: ${results.ratingFixed}`);
  console.log(`Bloqueados: ${results.validationBlocked}`);
  console.log(`Selector missing: ${results.selectorMissing}`);
  console.log(`Fallos: ${results.scrapeFailures}`);
  console.log(`Errores: ${results.errors}`);
  console.log(`ACTIVIDADES MUERTAS: ${results.deadActivities}`);
  console.log(`\nTotal: ${tours.length} | ${elapsed} min`);

  if (results.details.changed.length > 0) {
    console.log('\n--- ACTUALIZADOS ---');
    results.details.changed.forEach(t => console.log(`   ${t.title} | ${t.price} | ${t.rating} | ${t.reviews}`));
  }
  if (results.details.dead.length > 0) {
    console.log('\n--- MUERTAS (a retirar) ---');
    results.details.dead.forEach(t => console.log(`   ${t.slug} | ${t.title}`));
  }
  if (results.details.blocked.length > 0) {
    console.log('\n--- BLOQUEADOS ---');
    results.details.blocked.forEach(t => { console.log(`   $${t.oldPrice}->$${t.newPrice} | ${t.title}`); t.issues.forEach(i => console.log(`      ${i}`)); });
  }
  if (results.details.failed.length > 0) {
    console.log('\n--- FALLOS ---');
    results.details.failed.forEach(t => console.log(`   ${t.title} | ${t.reason}`));
  }

  // Notificar IndexNow con las URLs actualizadas
  if (!DRY_RUN && results.details.changed.length > 0) {
    await notifyIndexNow(results.details.changed.map(t => t.slug));
  }

  // Email SOLO si hay bajas nuevas en esta corrida
  if (!DRY_RUN && results.details.dead.length > 0) {
    await notifyDeadByEmail(results.details.dead);
  } else if (DRY_RUN && results.details.dead.length > 0) {
    console.log(`\nDRY RUN -> mandaría email a ${ALERT_EMAIL} con ${results.details.dead.length} baja(s)`);
  }

  if (DRY_RUN) console.log(`\nDRY RUN. Para aplicar: agregar --execute`);
  if (results.errors > 0 || results.selectorMissing > tours.length * 0.5) process.exit(1);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });
