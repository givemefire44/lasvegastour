// ============================================================================
//  profile-viator.mjs — Radiografía del contenido Viator sobre TU catálogo.
//  No inventa nada: tabula lo que Viator realmente devuelve.
//
//  Para qué: ver de un vistazo QUÉ ofrece Viator y CÓMO lo enmarca, antes de
//  decidir qué tomar. Distribución de tipos de itinerario, cobertura de cada
//  campo, los `type` de additionalInfo, y las claves de nivel superior que ni
//  siquiera estamos leyendo (oportunidades).
//
//  Uso:
//    node profile-viator.mjs                 # muestrea 25 tours desde Sanity (en vivo)
//    node profile-viator.mjs --sample=60     # muestrea 60
//    node profile-viator.mjs --from=corpus   # lee del corpus ya ingestado (sin red)
//    node profile-viator.mjs --code=5516P7   # un solo producto, a fondo
//  Escribe profile-viator-report.json con el detalle.
// ============================================================================
import fs from 'fs';
import * as configModule from './config.js';
import { createClient } from '@sanity/client';
import { fetchViatorTour } from './src/viator-client.js';

const config = configModule.config || configModule.default || configModule;
const args = process.argv.slice(2);
const FROM = args.find(a => a.startsWith('--from='))?.split('=')[1] || 'sanity';
const SAMPLE = parseInt(args.find(a => a.startsWith('--sample='))?.split('=')[1] || '25', 10);
const ONE = args.find(a => a.startsWith('--code='))?.split('=')[1] || null;

// Acumulador compartido: así un parcial (cada 10) o un Ctrl+C imprimen lo que haya.
const collected = [];
process.on('SIGINT', () => {
  console.log('\n\n[interrumpido] reporte con lo recolectado hasta ahora:');
  if (collected.length) {
    const p = profile(collected);
    printReport(p);
    printDeepExamples(collected);
    try { fs.writeFileSync('./profile-viator-report.json', JSON.stringify(p, null, 2)); } catch { /* noop */ }
  } else { console.log('  (nada recolectado todavía)'); }
  process.exit(0);
});

const codeFromUrl = url => (String(url || '').match(/d\d+-([0-9A-Za-z]+)/) || [])[1] || null;
const pct = (n, total) => `${n} (${total ? Math.round((n / total) * 100) : 0}%)`;

// Quality tags que Viator usa para rankear (el resto son categoría/subcategoría).
const TAG_LABELS = {
  367652: 'Top Product', 21972: 'Excellent Quality', 22143: 'Best Conversion',
  22083: 'Likely To Sell', 367653: 'Low Supplier Cancellation', 367654: 'Low Last-Minute Cancellation',
};
const short = (v, n = 300) => {
  if (v == null) return '-';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
};

// --- recolección de productos crudos (raw detail de Viator) ---
async function rawsFromSanity(limit) {
  const sanity = createClient({
    projectId: config.sanity.projectId, dataset: config.sanity.dataset,
    token: config.sanity.token, apiVersion: '2024-01-01', useCdn: false,
  });
  const rows = await sanity.fetch(
    `*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "url": getYourGuideUrl, "slug": slug.current }`
  );
  const codes = [...new Set((rows || []).map(r => codeFromUrl(r.url)).filter(Boolean))].slice(0, limit);
  for (const code of codes) {
    try {
      const data = await fetchViatorTour(code);
      if (data?.raw) {
        collected.push({ code, raw: data.raw, mapped: data });
        if (collected.length % 10 === 0) {
          console.log(`\n····· parcial tras ${collected.length} productos ·····`);
          printReport(profile(collected));
        }
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) { console.error(`  (skip ${code}: ${e.message})`); }
  }
  return collected;
}
async function rawsFromCorpus(limit) {
  const { getAllProducts } = await import('./corpus.js');
  for (const p of getAllProducts({ limit })) if (p.raw) collected.push({ code: p.productCode, raw: p.raw, mapped: p });
  return collected;
}

// --- el perfil ---
function profile(raws) {
  const N = raws.length;
  const topKeys = {};                 // claves de nivel superior del detail -> cuántos las traen
  const cover = {};                   // campos de contenido -> cuántos los traen (no vacíos)
  const itinTypes = {};               // itineraryType -> count
  const aiTypes = {};                 // additionalInfo[].type -> count
  const tagFreq = {};                 // tagId -> count
  let optCount = 0, optMax = 0;       // productOptions: total y máximo por producto
  const bump = (o, k) => { if (k != null) o[k] = (o[k] || 0) + 1; };
  const has = v => v != null && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'string' && !v.trim());

  for (const { raw, mapped } of raws) {
    for (const k of Object.keys(raw || {})) bump(topKeys, k);
    for (const t of (raw.tags || [])) bump(tagFreq, t);
    const no = (raw.productOptions || []).length;
    optCount += no; if (no > optMax) optMax = no;

    const it = raw.itinerary || {};
    bump(itinTypes, it.itineraryType || '(sin itinerary)');

    // cobertura de los campos que nos importan para el contenido
    if (has(raw.description)) bump(cover, 'description');
    if (has(raw.inclusions)) bump(cover, 'inclusions');
    if (has(raw.exclusions)) bump(cover, 'exclusions');
    if (has(raw.additionalInfo)) bump(cover, 'additionalInfo');
    if (has(raw.cancellationPolicy)) bump(cover, 'cancellationPolicy');
    if (has(raw.logistics)) bump(cover, 'logistics');
    if (has(raw.logistics?.travelerPickup)) bump(cover, 'logistics.travelerPickup');
    if (has(raw.logistics?.start)) bump(cover, 'logistics.start (meeting point)');
    if (has(raw.productOptions)) bump(cover, 'productOptions (variantes)');
    if (has(raw.reviews)) bump(cover, 'reviews');
    if (has(raw.reviews?.reviewCountTotals)) bump(cover, 'reviews.reviewCountTotals (distrib. estrellas)');
    if (has(raw.images)) bump(cover, 'images');
    if (has(raw.tags)) bump(cover, 'tags (taxonomía/calidad Viator)');
    if (has(raw.bookingQuestions)) bump(cover, 'bookingQuestions');
    if (has(raw.ticketInfo)) bump(cover, 'ticketInfo');
    if (raw.translationInfo || raw.translationLevel != null) bump(cover, 'translation info');
    if (has(raw.supplier)) bump(cover, 'supplier');
    if (has(raw.destinations)) bump(cover, 'destinations');
    if (has(raw.flags)) bump(cover, 'flags');

    // tipos de additionalInfo (los hechos operativos)
    for (const a of (raw.additionalInfo || [])) bump(aiTypes, a?.type || '(sin type)');

    // ¿el itinerario quedó capturable?
    const items = (it.itineraryItems?.length) || (it.days ? it.days.flatMap(d => d.items || []).length : 0);
    const text = it.unstructuredItinerary || it.unstructuredDescription || it.activityInfo?.description;
    if (items) bump(cover, 'itinerario: paradas estructuradas');
    else if (text) bump(cover, 'itinerario: texto (ACTIVITY/UNSTRUCTURED)');
    else bump(cover, 'itinerario: VACÍO (sin paradas ni texto)');
  }

  return { N, topKeys, cover, itinTypes, aiTypes, tagFreq, optAvg: N ? +(optCount / N).toFixed(1) : 0, optMax };
}

function printReport(p) {
  const sortDesc = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const line = '─'.repeat(60);
  console.log(`\n${line}\n RADIOGRAFÍA VIATOR  |  ${p.N} productos muestreados\n${line}`);

  console.log('\n▸ TIPOS DE ITINERARIO (cómo Viator estructura el recorrido)');
  for (const [k, v] of sortDesc(p.itinTypes)) console.log(`   ${k.padEnd(22)} ${pct(v, p.N)}`);

  console.log('\n▸ COBERTURA DE CONTENIDO (cuántos traen cada cosa)');
  for (const [k, v] of sortDesc(p.cover)) console.log(`   ${k.padEnd(48)} ${pct(v, p.N)}`);

  console.log('\n▸ additionalInfo — TIPOS DE HECHO OPERATIVO (la mina factual)');
  for (const [k, v] of sortDesc(p.aiTypes)) console.log(`   ${k.padEnd(40)} ${v}`);

  console.log(`\n▸ TAGS más frecuentes (★ = quality tag de Viator)  |  productOptions: prom ${p.optAvg}, máx ${p.optMax}`);
  for (const [k, v] of sortDesc(p.tagFreq).slice(0, 18)) {
    const label = TAG_LABELS[k];
    console.log(`  ${label ? '★' : ' '} ${String(k).padEnd(10)} ${pct(v, p.N).padEnd(12)} ${label || ''}`);
  }

  console.log('\n▸ CLAVES DE NIVEL SUPERIOR DEL PRODUCTO (lo que Viator manda; ★ = no lo leemos)');
  const reading = new Set(['title','description','images','itinerary','inclusions','exclusions',
    'additionalInfo','cancellationPolicy','reviews','supplier','productCode','duration','pricingInfo']);
  for (const [k, v] of sortDesc(p.topKeys)) {
    const star = reading.has(k) ? '  ' : ' ★';
    console.log(`  ${star} ${k.padEnd(34)} ${pct(v, p.N)}`);
  }
  console.log(`\n${line}\n`);
}

// Vuelca los VALORES reales de los campos que hoy no leemos, para un producto.
function deepDump({ code, raw }) {
  const line = '·'.repeat(60);
  console.log(`\n${line}\n EJEMPLO REAL: ${code} — ${raw.title || ''}  [${raw.itinerary?.itineraryType || '?'}]\n${line}`);
  console.log('productUrl     :', raw.productUrl || '-');
  console.log('lastUpdatedAt  :', raw.lastUpdatedAt || '-', ' | createdAt:', raw.createdAt || '-', ' | status:', raw.status || '-');
  console.log('timeZone       :', raw.timeZone || '-', ' | language:', raw.language || '-');
  console.log('tags           :', JSON.stringify(raw.tags || []));
  console.log('   quality tags :', (raw.tags || []).filter(t => TAG_LABELS[t]).map(t => `${t}=${TAG_LABELS[t]}`).join(', ') || '(ninguno)');
  console.log('destinations   :', short(raw.destinations, 200));
  console.log('translationInfo:', short(raw.translationInfo, 200));
  console.log('languageGuides :', short(raw.languageGuides, 250));
  console.log('ticketInfo     :', short(raw.ticketInfo, 250));
  console.log('pricingInfo    :', short(raw.pricingInfo, 320));

  const lg = raw.logistics || {};
  console.log('\n logistics.start (meeting point):', short(lg.start, 320));
  console.log(' logistics.end                  :', short(lg.end, 160));
  console.log(' logistics.travelerPickup       :', short(lg.travelerPickup, 420));

  const opts = raw.productOptions || [];
  console.log(`\n productOptions: ${opts.length} variante(s)`);
  opts.slice(0, 8).forEach((o, i) =>
    console.log(`   [${i + 1}] ${short(o.title, 90)}  ${o.productOptionCode ? '(' + o.productOptionCode + ')' : ''}`));

  console.log('\n additionalInfo (type -> text):');
  for (const a of (raw.additionalInfo || []))
    console.log(`   ${String(a.type || '?').padEnd(28)} ${short(a.text || a.description, 130)}`);
  console.log(line + '\n');
}

// Un STANDARD y un ACTIVITY (si hay), para ver ambas formas con datos reales.
function printDeepExamples(items) {
  if (!items.length) return;
  const byType = t => items.find(c => c.raw?.itinerary?.itineraryType === t);
  const picks = [byType('STANDARD') || items[0]];
  const act = byType('ACTIVITY'); if (act && act !== picks[0]) picks.push(act);
  console.log('\n══════ VALORES REALES (deep dump de ejemplos) ══════');
  for (const p of picks) deepDump(p);
}

async function main() {
  let raws;
  if (ONE) {
    const data = await fetchViatorTour(ONE);
    raws = data?.raw ? [{ code: ONE, raw: data.raw, mapped: data }] : [];
  } else if (FROM === 'corpus') {
    console.log('Leyendo del corpus local...');
    raws = await rawsFromCorpus(100000);
  } else {
    console.log(`Muestreando ${SAMPLE} productos desde Sanity (en vivo, ~${Math.ceil(SAMPLE * 1.6)}s)...`);
    raws = await rawsFromSanity(SAMPLE);
  }
  if (!raws.length) { console.error('Sin datos para perfilar.'); process.exit(1); }

  const p = profile(raws);
  printReport(p);
  printDeepExamples(raws);
  fs.writeFileSync('./profile-viator-report.json', JSON.stringify(p, null, 2));
  console.log('Detalle -> profile-viator-report.json');
}
main().catch(e => { console.error(e.message); process.exit(1); });