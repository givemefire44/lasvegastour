// src/index.js
import { scrapeGetYourGuideTour, cleanAffiliateUrl } from './scraper.js';
import { processImages, cleanupTempFiles } from './imageProcessor.js';
import { generateTourContent } from './contentGenerator.js';
import { uploadToSanity, classifyCategory } from './sanityUploader.js';
import { injectWorthItForSlug } from '../inject-worth-it.js';
import { upsertProduct } from '../corpus.js';
import { runBatteryForSlug } from '../regenerate.js';
import { injectEditorialReviewForSlug } from '../inject-editorial-review.js';
import { fetchViatorTour } from './viator-client.js';
import { config } from '../config.js';
import { createClient } from '@sanity/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cliente Sanity para buscar tours
const sanityClient = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn: false
});

/**
 * Fetch related tours from Sanity for comparison table
 */
// Parsea horas de un string de duración: "10-11 hours" -> 10.5, "2 hours" -> 2, "2-3 hours" -> 2.5
function parseDurationHours(s) {
  const nums = String(s || '').match(/\d+(?:\.\d+)?/g);
  if (!nums) return null;
  const vals = nums.map(Number);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Trae tours COMPARABLES: misma categoría, ordenados por cercanía de precio y duración.
// Si no hay nada en la misma categoría, devuelve [] (mejor sin tabla que con tours al azar).
async function fetchRelatedTours({ category = null, price = null, duration = null, excludeTitle = null } = {}) {
  try {
    if (!category) return [];
    const candidates = await sanityClient.fetch(
      `*[_type == "post" && defined(slug.current) && category->slug.current == $category ${excludeTitle ? '&& title != $excludeTitle' : ''}] {
        title,
        "slug": slug.current,
        "price": tourInfo.price,
        "duration": tourInfo.duration,
        "rating": getYourGuideData.rating,
        "reviewCount": getYourGuideData.reviewCount
      }`,
      { category, excludeTitle }
    );
    if (!candidates || !candidates.length) return [];

    const curHours = parseDurationHours(duration);
    const scored = candidates.map(c => {
      let score = 0;
      if (price != null && typeof c.price === 'number') score += Math.abs(c.price - price) / Math.max(price, 1);
      else score += 1;
      const ch = parseDurationHours(c.duration);
      if (curHours != null && ch != null) score += Math.abs(ch - curHours) / Math.max(curHours, 1);
      else score += 0.5;
      return { ...c, _score: score };
    });
    scored.sort((a, b) => a._score - b._score);
    return scored.slice(0, 4).map(({ _score, ...c }) => c);
  } catch (error) {
    console.error('   Error fetching related tours:', error.message);
    return [];
  }
}

/**
 * Sleep helper para delays entre batches
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Procesar un solo tour.
 * @param {string} input  URL de GetYourGuide (gyg) o productCode de Viator (viator)
 * @param {string} source 'gyg' | 'viator'
 */
async function processSingleTour(input, index = null, total = null, source = 'gyg') {
  const prefix = index !== null ? `[${index}/${total}] ` : '';
  const isViator = source === 'viator';

  console.log(`\n${prefix}Procesando (${source}): ${input}\n`);

  const startTime = Date.now();

  // Verificar si el tour ya existe en Sanity
  let existing;
  if (isViator) {
    // El doc guarda la viator URL en getYourGuideUrl, que contiene el productCode al final
    existing = await sanityClient.fetch(
      `*[_type == "post" && getYourGuideUrl match $code][0]._id`,
      { code: `*${input}*` }
    );
  } else {
    existing = await sanityClient.fetch(
      `*[_type == "post" && getYourGuideUrl == $url][0]._id`,
      { url: input.split('?')[0] }
    );
  }
  if (existing) {
    console.log(`Tour ya existe en Sanity, saltando...`);
    return { success: false, skipped: true, url: input };
  }

  // PASO 1: OBTENER DATOS DE LA FUENTE
  console.log(`${prefix}PASO 1/6: EXTRAYENDO DATOS DE ${isViator ? 'VIATOR (API)' : 'GETYOURGUIDE'}`);

  let tourData;
  if (isViator) {
    tourData = await fetchViatorTour(input);
  } else {
    tourData = await scrapeGetYourGuideTour(input);
  }

  if (!tourData.title) {
    throw new Error('No se pudo extraer el titulo del tour');
  }

  if (!tourData.images || tourData.images.length === 0) {
    throw new Error('No se encontraron imagenes para el tour');
  }

  // bookingUrl: solo GYG lo construye aca; Viator ya lo trae en tourData.url (con pid/mcid/campaign)
  if (!isViator) {
    console.log(`${prefix}Generando URL de afiliado...`);
    const baseUrl = tourData.url.split('?')[0];
    const rawBookingUrl = `${baseUrl}?partner_id=${config.affiliate.partnerId}&utm_medium=${config.affiliate.utmMedium}`;
    tourData.bookingUrl = cleanAffiliateUrl(rawBookingUrl);
  }

  // PASO 2: PROCESAMIENTO DE IMAGENES (mismo para ambas fuentes: recibe URLs, devuelve buffers)
  console.log(`${prefix}PASO 2/6: PROCESANDO IMAGENES`);

  const imageUrls = tourData.images.slice(0, 15);
  const processedImages = await processImages(imageUrls);

  // PASO 3: BUSCAR TOURS RELACIONADOS
  console.log(`${prefix}PASO 3/6: BUSCANDO TOURS RELACIONADOS`);

  const catSlug = config.forcedCategory || classifyCategory(tourData.title);
  const relatedTours = await fetchRelatedTours({
    category: catSlug,
    price: tourData.price,
    duration: tourData.duration,
    excludeTitle: tourData.title,
  });
  console.log(`   Encontrados ${relatedTours.length} tours comparables (categoría: ${catSlug})`);

  // PASO 4: GENERACION DE CONTENIDO
  console.log(`${prefix}PASO 4/6: GENERANDO CONTENIDO CON CLAUDE`);

  const contentData = await generateTourContent(tourData, relatedTours);

  // PASO 5: SUBIDA A SANITY
  console.log(`${prefix}PASO 5/6: SUBIENDO A SANITY`);

  const result = await uploadToSanity(tourData, contentData, processedImages);

  // PASO 5b: Inyectar "Is It Worth It?" (solo si se creo de verdad; no en dry-run ni skip)
  if (result?.success && result.slug && !config.dryRun) {
    console.log(`${prefix}PASO 5b: Inyectando "Is It Worth It?"`);
    try {
      const wr = await injectWorthItForSlug(result.slug);
      console.log(wr.ok ? `   Bloque inyectado (${wr.before} -> ${wr.after})` : `   Worth It omitido: ${wr.reason}`);
    } catch (e) {
      console.warn(`   No se pudo inyectar el bloque (no critico, se backfillea luego): ${e.message}`);
    }
  }

  // PASO 5c/5d: corpus-ground del tour nuevo (ingest al corpus + bateria de injectors + tabla)
  if (result?.success && result.slug && !config.dryRun) {
    if (isViator) {
      try {
        upsertProduct({ ...tourData, productCode: input, sourceUrl: tourData.url || null });
        console.log(`${prefix}PASO 5c: corpus actualizado (${input})`);
      } catch (e) {
        console.warn(`   No se pudo ingestar al corpus (no critico): ${e.message}`);
      }
    }
    try {
      console.log(`${prefix}PASO 5d: regenerando secciones corpus-grounded + tabla`);
      const battery = await runBatteryForSlug(result.slug, { dryRun: false });
      console.log('   ' + battery.map(r => `${r.name}:${r.ok ? (r.origin || 'ok') : 'skip'}`).join('  '));
    } catch (e) {
      console.warn(`   No se pudo regenerar (no critico, corré: node regenerate.js --slug=${result.slug} --execute): ${e.message}`);
    }
  }

  // PASO 6: LIMPIEZA
  console.log(`${prefix}PASO 6/6: LIMPIEZA`);
  cleanupTempFiles();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  return {
    success: true,
    title: contentData.title || tourData.title,
    slug: result.slug,
    duration: duration,
    url: input
  };
}

/**
 * Leer URLs desde archivo urls.txt (fuente GYG)
 */
function readUrlsFromFile() {
  const urlsFilePath = path.join(__dirname, '..', 'urls.txt');

  if (!fs.existsSync(urlsFilePath)) {
    console.error('Error: No se encontro el archivo urls.txt\n');
    console.log('Crea el archivo tour-importer/urls.txt con una URL por linea, o genera uno con extract-urls.js\n');
    process.exit(1);
  }

  const content = fs.readFileSync(urlsFilePath, 'utf-8');
  const urls = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('getyourguide.com'));

  if (urls.length === 0) {
    console.error('Error: No se encontraron URLs validas de GetYourGuide en urls.txt\n');
    process.exit(1);
  }

  return urls;
}

/**
 * Parser CSV minimo que respeta campos entre comillas (delimitador ;)
 */
function parseCsvLine(line, delim = ';') {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Leer productCodes marcados (columna "incluir") desde viator-candidates.csv (fuente Viator)
 */
function readCodesFromCsv() {
  const csvPath = path.join(__dirname, '..', 'viator-candidates.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('Error: No se encontro viator-candidates.csv\n');
    console.log('Genera el reporte con: node src/viator-extract-urls.js\n');
    console.log('Despues abrilo en Excel, marca la columna "incluir" con una x en los que entran, y guarda.\n');
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    console.error('Error: el CSV no tiene filas de datos\n');
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]);
  const incluirIdx = header.indexOf('incluir');
  const codeIdx = header.indexOf('productCode');
  if (incluirIdx === -1 || codeIdx === -1) {
    console.error('Error: el CSV no tiene las columnas "incluir" y "productCode"\n');
    process.exit(1);
  }

  const codes = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const incluir = (cols[incluirIdx] || '').trim();
    const code = (cols[codeIdx] || '').trim();
    if (incluir && code) codes.push(code);
  }

  if (codes.length === 0) {
    console.error('Error: no hay filas marcadas en la columna "incluir" del CSV\n');
    console.log('Abri viator-candidates.csv y poné una x en los tours que querés importar.\n');
    process.exit(1);
  }

  return codes;
}

/**
 * Script principal - Orquestador del proceso completo
 */
async function main() {
  console.log('========================================================');
  console.log('   LasVegasTour - TOUR IMPORTER v2.0 (batch)');
  console.log('========================================================\n');

  const args = process.argv.slice(2);
  const isBatchMode = args.includes('--batch') || args.includes('-b');
  const doExecute = args.includes('--execute');
  config.dryRun = !doExecute;   // SEGURO por defecto: sin --execute corre en DRY RUN (no crea nada en Sanity)

  // Fuente de datos: --source viator | gyg  (default gyg, no rompe el flujo existente)
  const sourceIdx = args.indexOf('--source');
  const source = (sourceIdx !== -1 && args[sourceIdx + 1]) ? args[sourceIdx + 1].toLowerCase() : 'gyg';

  // Categoria forzada opcional: --category <slug> manda TODA la tanda a esa categoria (ignora el clasificador)
  const catIdx = args.indexOf('--category');
  if (catIdx !== -1 && args[catIdx + 1]) {
    config.forcedCategory = args[catIdx + 1];
    console.log(`Categoria forzada: ${config.forcedCategory} (toda la tanda va a esta categoria)`);
  }

  // Determinar items a procesar (URLs para GYG, productCodes para Viator)
  let items = [];

  if (source === 'viator') {
    // Viator: --code <productCode> para uno solo, o lee viator-candidates.csv (filas marcadas)
    const codeIdx = args.indexOf('--code');
    if (codeIdx !== -1 && args[codeIdx + 1]) {
      items = [args[codeIdx + 1]];
      console.log(`FUENTE VIATOR: 1 productCode (${items[0]})\n`);
    } else {
      items = readCodesFromCsv();
      console.log(`FUENTE VIATOR: ${items.length} productCodes marcados en viator-candidates.csv\n`);
    }
  } else if (isBatchMode) {
    items = readUrlsFromFile();
    console.log(`MODO BATCH (GYG): ${items.length} URLs encontradas en urls.txt\n`);
  } else if (args.length > 0 && args[0].includes('getyourguide.com')) {
    items = [args[0]];
  } else {
    console.error('Error: Debes proporcionar una URL de GYG, usar --batch, o --source viator\n');
    console.log('Uso:');
    console.log('  GetYourGuide:');
    console.log('    node src/index.js <URL>                      # Una URL (DRY RUN)');
    console.log('    node src/index.js <URL> --execute            # Una URL y la SUBE');
    console.log('    node src/index.js --batch --execute          # Lee urls.txt y SUBE');
    console.log('  Viator:');
    console.log('    node src/index.js --source viator --code <productCode> --execute   # Un tour');
    console.log('    node src/index.js --source viator --execute  # Lee viator-candidates.csv (filas marcadas) y SUBE');
    console.log('\nSin --execute NO se crea nada en Sanity (modo prueba seguro).\n');
    process.exit(1);
  }

  console.log(`Fuente: ${source.toUpperCase()}  |  Modo: ${config.dryRun ? 'DRY RUN (prueba sin crear)' : 'PRODUCCION'}`);

  // Delay entre tours: corto para Viator (API), largo para GYG (scraping)
  const DELAY_BETWEEN_TOURS = source === 'viator' ? 3000 : 30000;

  // Tracking de resultados
  const results = {
    success: [],
    failed: []
  };

  const totalStartTime = Date.now();

  // Procesar cada item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;

    console.log('\n--------------------------------------------------------');

    try {
      let result = null;
      let attempts = 0;

      while (attempts < 3) {
        attempts++;
        try {
          result = await processSingleTour(item, i + 1, items.length, source);
          break;
        } catch (err) {
          const m = (err.message || '').toLowerCase();
          const retriable = m.includes('galer')
            || m.includes('upstream') || m.includes('invalid response')
            || m.includes('timeout') || m.includes('timed out')
            || m.includes('econnreset') || m.includes('econnrefused')
            || m.includes('socket hang up') || m.includes('network') || m.includes('fetch failed')
            || m.includes('502') || m.includes('503') || m.includes('504') || m.includes('429');
          if (retriable && attempts < 3) {
            console.log(`\nError transitorio ("${err.message}"). Reintentando (intento ${attempts}/3)...`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            throw err;
          }
        }
      }

      results.success.push(result);
      if (result.skipped) {
        console.log(`\nSALTADO (ya existia): ${item}`);
      } else {
        console.log(`\nEXITO: ${result.title}`);
        if (!config.dryRun) {
          console.log(`   https://lasvegastour.com/tour/${result.slug}`);
        }
        console.log(`   ${result.duration}s`);
      }

    } catch (error) {
      console.error(`\nERROR procesando: ${item}`);
      console.error(`   ${error.message}`);

      results.failed.push({
        url: item,
        error: error.message
      });

      try {
        cleanupTempFiles();
      } catch (e) {
        // Ignorar
      }
    }

    // Delay entre tours (solo si no es el ultimo, hay mas de uno, y no fue skip)
    if (!isLast && items.length > 1 && results.success[results.success.length - 1]?.skipped !== true) {
      console.log(`\nEsperando ${DELAY_BETWEEN_TOURS / 1000}s antes del siguiente tour...`);
      await sleep(DELAY_BETWEEN_TOURS);
    }
  }

  // RESUMEN FINAL
  const totalEndTime = Date.now();
  const totalDuration = ((totalEndTime - totalStartTime) / 1000 / 60).toFixed(2);

  console.log('\n\n========================================================');
  console.log('                  RESUMEN FINAL');
  console.log('========================================================\n');

  const created = results.success.filter(r => !r.skipped);
  const skipped = results.success.filter(r => r.skipped);

  console.log(`Creados: ${created.length}/${items.length}`);
  console.log(`Saltados (ya existian): ${skipped.length}/${items.length}`);
  console.log(`Fallidos: ${results.failed.length}/${items.length}`);
  console.log(`Tiempo total: ${totalDuration} minutos\n`);

  if (created.length > 0) {
    console.log('--------------------------------------------------------');
    console.log('TOURS CREADOS:');
    console.log('--------------------------------------------------------');
    created.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title}`);
      if (!config.dryRun) {
        console.log(`   https://lasvegastour.com/tour/${r.slug}`);
      }
    });
  }

  if (results.failed.length > 0) {
    console.log('\n--------------------------------------------------------');
    console.log('TOURS FALLIDOS:');
    console.log('--------------------------------------------------------');
    results.failed.forEach((r, i) => {
      console.log(`${i + 1}. ${r.url}`);
      console.log(`   Error: ${r.error}`);
    });
  }

  console.log('');

  // Exit code basado en resultados
  if (results.failed.length > 0 && created.length === 0 && skipped.length === 0) {
    process.exit(1);
  }
}

// Ejecutar
main();
// vegas-viator-source
