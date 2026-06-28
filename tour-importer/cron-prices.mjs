// cron-prices.mjs — lasvegastour.com
// Actualiza precios (datos duros) leyendo el CORPUS (Viator), no scrapea.
// Cadena: precio nuevo del corpus -> (1) PROPIO estructurado + prosa de su pagina
//                                   (2) AJENO en paginas que lo citan (via fetchAlternatives = la tabla)
//                                   (3) DERIVADOS recalculados (resta extremos exactos -> floor)
// Uso:
//   node cron-prices.mjs                 (DRY: muestra, no escribe)
//   node cron-prices.mjs --execute       (PRODUCCION: escribe Sanity)
//   node cron-prices.mjs --slug=X         (un solo tour, dry)
//   node cron-prices.mjs --slug=X --execute

import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import { getProduct } from './corpus.js';   // ajustar ruta si corpus.js esta en otro lado

// ── config ──────────────────────────────────────────────
const SITE = 'lasvegastour.com';
const MAX_PRICE_CHANGE_PERCENT = 120;
const MIN_PRICE = 5;
const MAX_PRICE = 2000;
const GLOBAL_FAILURE_THRESHOLD = 50;

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const slugArg = (args.find(a => a.startsWith('--slug=')) || '').split('=')[1] || null;

const sanity = createClient({
  projectId: 'kabmqky1', dataset: 'production',
  apiVersion: '2023-05-03', token: process.env.SANITY_API_TOKEN, useCdn: false,
});

const codeFromUrl = url => (String(url || '').match(/d\d+-([0-9A-Za-z_]+)/) || [])[1] || null;
// code limpio: saca sufijo de tracking pegado con _ (ej 5847NIGHT_TZ -> 5847NIGHT)
const cleanCode = url => { const c = codeFromUrl(url); return c ? c.split('_')[0] : null; };
// tokens significativos del titulo (para verificar matching Sanity<->corpus)
const titleTokens = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3);
// ¿el tour de Sanity matchea al producto del corpus? (>=2 palabras de titulo en comun)
function titlesMatch(sanityTitle, corpusTitle) {
  const a = new Set(titleTokens(sanityTitle));
  return titleTokens(corpusTitle).filter(w => a.has(w)).length >= 2;
}

// ── validacion (umbrales, reusado de Colosseum) ─────────
function validatePrice(oldP, newP) {
  const issues = [];
  if (newP < MIN_PRICE) issues.push(`< $${MIN_PRICE}`);
  if (newP > MAX_PRICE) issues.push(`> $${MAX_PRICE}`);
  if (oldP > 0) {
    const pct = Math.abs(newP - oldP) / oldP * 100;
    if (pct > MAX_PRICE_CHANGE_PERCENT) issues.push(`cambio ${pct.toFixed(0)}% > ${MAX_PRICE_CHANGE_PERCENT}%`);
  }
  return issues;
}

// ── tabla (fetchAlternatives, identica al injector) ─────
async function fetchAlternatives(slug, cat) {
  return sanity.fetch(
    `*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, "price":tourInfo.price }`,
    { cat, slug }
  );
}

// ── reemplazo de precio en un body (preserva marks) ─────
function replacePriceInBody(body, oldP, newP) {
  const reOld = new RegExp('(\\$|USD )' + String(oldP).replace('.', '\\.') + '(?![\\d])', 'g');
  const newStr = String(newP);
  let changes = 0;
  const nb = (body || []).map(b => {
    if (!b.children) return b;
    return { ...b, children: b.children.map(c => {
      if (typeof c.text === 'string' && reOld.test(c.text)) { changes++; return { ...c, text: c.text.replace(reOld, (m, pre) => pre + newStr) }; }
      return c;
    }) };
  });
  return { body: nb, changes };
}

// ── reemplazo de rating + reviews en un body (solo pagina propia) ──
// formas: "X/5" para rating, "(N review" para reviews (cubre review/reviews)
function replaceRatingInBody(body, oldRating, oldReviews, newRating, newReviews) {
  let changes = 0;
  const oldR = `${oldRating}/5`, newR = `${newRating}/5`;
  const oldRev = `(${oldReviews} review`, newRev = `(${newReviews} review`;
  const nb = (body || []).map(b => {
    if (!b.children) return b;
    return { ...b, children: b.children.map(c => {
      if (typeof c.text !== 'string') return c;
      let t = c.text;
      if (oldRating !== newRating && t.includes(oldR)) { t = t.replaceAll(oldR, newR); changes++; }
      if (oldReviews !== newReviews && t.includes(oldRev)) { t = t.replaceAll(oldRev, newRev); changes++; }
      return t !== c.text ? { ...c, text: t } : c;
    }) };
  });
  return { body: nb, changes };
}

// ── recalcular derivados de una pagina (resta extremos -> floor) ──
// busca "$N more/less" ; si el comparado (de la tabla) cambio, recalcula
function recalcDerivados(body, propioPrice, tabla) {
  const reDeriv = /(\$)(\d+(?:\.\d+)?)(\s+(?:more|less)\b)/gi;
  let changes = 0;
  const nb = (body || []).map(b => {
    if (!b.children) return b;
    return { ...b, children: b.children.map(c => {
      if (typeof c.text !== 'string') return c;
      const nuevo = c.text.replace(reDeriv, (m, sign, num, tail) => {
        const n = Number(num);
        // buscar un comparado de la tabla cuya |propio - comparado| floor == n  (el que este derivado usaba)
        const match = tabla.find(a => Math.floor(Math.abs(propioPrice - Number(a.price))) === n
          || Math.round(Math.abs(propioPrice - Number(a.price))) === n);
        if (!match) return m; // no identificamos el comparado -> no tocar
        const real = Math.abs(propioPrice - Number(match.price));
        const recalc = Math.floor(real);
        if (recalc === n) return m;
        changes++;
        return sign + recalc + tail;
      });
      return nuevo !== c.text ? { ...c, text: nuevo } : c;
    }) };
  });
  return { body: nb, changes };
}

// ── procesar UN tour: precio y/o rating/reviews ─────────
async function aplicarCambio(tour, prod) {
  const oldPrice = Number(tour.oldPrice);
  const newPrice = prod.price != null ? Number(prod.price) : oldPrice;
  const oldRating = tour.oldRating, newRating = prod.rating != null ? prod.rating : oldRating;
  const oldReviews = tour.oldReviews, newReviews = prod.reviewCount != null ? prod.reviewCount : oldReviews;

  const priceChanged = Math.abs(newPrice - oldPrice) >= 0.01;
  const ratingChanged = oldRating !== newRating || oldReviews !== newReviews;
  let log = [];

  // patch del estructurado (precio + rating + reviews juntos)
  const setObj = {};
  if (priceChanged) setObj['tourInfo.price'] = newPrice;
  if (oldRating !== newRating) setObj['getYourGuideData.rating'] = newRating;
  if (oldReviews !== newReviews) setObj['getYourGuideData.reviewCount'] = newReviews;

  // (1) PROPIO en su pagina: precio en prosa + rating/reviews en prosa
  let bodyPropio = tour.body;
  if (priceChanged) {
    const r = replacePriceInBody(bodyPropio, oldPrice, newPrice);
    bodyPropio = r.body; log.push(`PRECIO propio: ${r.changes} lugares`);
  }
  if (ratingChanged) {
    const r = replaceRatingInBody(bodyPropio, oldRating, oldReviews, newRating, newReviews);
    bodyPropio = r.body; log.push(`RATING/REVIEWS: ${r.changes} lugares (${oldRating}/5->${newRating}/5, ${oldReviews}->${newReviews})`);
  }
  if (EXECUTE && (priceChanged || ratingChanged)) {
    await sanity.patch(tour._id).set({ ...setObj, body: bodyPropio }).commit();
  }

  // (2) AJENO: solo si cambio el PRECIO (el rating ajeno no se cita en prosa)
  let ajenoPaginas = 0;
  if (priceChanged) {
    const mismaCat = await sanity.fetch(
      `*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)]{ _id, "slug":slug.current, body }`,
      { cat: tour.cat, slug: tour.slug }
    );
    for (const pg of mismaCat) {
      const tabla = await fetchAlternatives(pg.slug, tour.cat);
      if (!tabla.some(tt => tt.slug === tour.slug)) continue;
      const { body: nb, changes } = replacePriceInBody(pg.body, oldPrice, newPrice);
      if (changes) { ajenoPaginas++; if (EXECUTE) await sanity.patch(pg._id).set({ body: nb }).commit(); }
    }
    log.push(`AJENO: ${ajenoPaginas} paginas que lo citan`);

    // (3) DERIVADOS de SU pagina (solo si cambio el precio propio)
    const tablaPropia = await fetchAlternatives(tour.slug, tour.cat);
    const { body: bodyDeriv, changes: cD } = recalcDerivados(bodyPropio, newPrice, tablaPropia);
    if (cD) { log.push(`DERIVADOS: ${cD} recalculados`); if (EXECUTE) await sanity.patch(tour._id).set({ body: bodyDeriv }).commit(); }
  }

  return { log, priceChanged, ratingChanged };
}

// ── IndexNow ────────────────────────────────────────────
async function notifyIndexNow(slugs) {
  if (!slugs.length) return;
  const key = process.env.INDEXNOW_KEY;
  if (!key) { console.log('IndexNow: sin INDEXNOW_KEY, omito'); return; }
  const urlList = slugs.map(s => `https://${SITE}/${s}`);
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: SITE, key, urlList }),
    });
    console.log(`IndexNow: ${urlList.length} URLs -> ${r.status}`);
  } catch (e) { console.log(`IndexNow error: ${e.message}`); }
}

// ── main ────────────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log(`  CRON PRICES — ${SITE}  ${EXECUTE ? '(EXECUTE)' : '(DRY)'}`);
  console.log('========================================\n');

  const q = slugArg
    ? `*[_type=="post" && slug.current=="${slugArg}" && !(_id in path("drafts.**"))]{ _id, title, "slug":slug.current, "cat":category->slug.current, "oldPrice":tourInfo.price, "oldRating":getYourGuideData.rating, "oldReviews":getYourGuideData.reviewCount, "url":getYourGuideUrl, body }`
    : `*[_type=="post" && defined(tourInfo.price) && defined(getYourGuideUrl) && !(_id in path("drafts.**"))]{ _id, title, "slug":slug.current, "cat":category->slug.current, "oldPrice":tourInfo.price, "oldRating":getYourGuideData.rating, "oldReviews":getYourGuideData.reviewCount, "url":getYourGuideUrl, body }`;

  const tours = await sanity.fetch(q);
  console.log(`${tours.length} tours a revisar\n`);

  let changed = 0, unchanged = 0, blocked = 0, noCorpus = 0, skipped = 0;
  const changedSlugs = [];
  const skippedList = [];

  for (const tour of tours) {
    const code = cleanCode(tour.url);
    const prod = code ? getProduct(code) : null;
    if (!prod) { noCorpus++; skippedList.push(`${tour.slug} (code ${code} sin corpus)`); continue; }

    // GUARDRAIL: si el titulo de Sanity no matchea el del corpus, NO tocar (URL sucia / code cruzado)
    if (!titlesMatch(tour.title, prod.title)) {
      skipped++;
      skippedList.push(`${tour.slug}: "${tour.title.slice(0,35)}" != corpus "${(prod.title||'').slice(0,35)}"`);
      continue;
    }

    const newPrice = prod.price != null ? Number(prod.price) : Number(tour.oldPrice);
    const oldPrice = Number(tour.oldPrice);

    const priceChanged = Math.abs(newPrice - oldPrice) >= 0.01;
    const ratingChanged = (prod.rating != null && prod.rating !== tour.oldRating)
      || (prod.reviewCount != null && prod.reviewCount !== tour.oldReviews);

    if (!priceChanged && !ratingChanged) { unchanged++; continue; }

    if (priceChanged) {
      const issues = validatePrice(oldPrice, newPrice);
      if (issues.length) {
        blocked++;
        console.log(`BLOQUEADO ${tour.slug}: ${oldPrice} -> ${newPrice} (${issues.join(', ')})`);
        continue;
      }
    }

    console.log(`--- ${tour.slug}`);
    const { log } = await aplicarCambio(tour, prod);
    log.forEach(l => console.log('    ' + l));
    changed++;
    changedSlugs.push(tour.slug);
  }

  console.log(`\n========================================`);
  console.log(`Cambiados: ${changed} | Sin cambio: ${unchanged} | Bloqueados: ${blocked} | Sin corpus: ${noCorpus} | Salteados (titulo no matchea): ${skipped}`);
  console.log(EXECUTE ? 'ESCRITO en Sanity' : 'DRY — nada escrito');

  if (skippedList.length) {
    console.log(`\n--- SALTEADOS/SIN CORPUS (revisar URL en Sanity) ---`);
    skippedList.forEach(s => console.log('  ' + s));
  }

  if (EXECUTE && changedSlugs.length) await notifyIndexNow(changedSlugs);
}

main().catch(e => { console.error(e); process.exit(1); });

