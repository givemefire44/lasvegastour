// src/index.js
import { scrapeGetYourGuideTour, cleanAffiliateUrl } from './scraper.js';
import { processImages, cleanupTempFiles } from './imageProcessor.js';
import { generateTourContent } from './contentGenerator.js';
import { uploadToSanity } from './sanityUploader.js';
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
async function fetchRelatedTours() {
  try {
    const query = `*[_type == "post" && defined(slug.current)] | order(_createdAt desc)[0...4] {
      title,
      "slug": slug.current,
      "price": tourInfo.price,
      "duration": tourInfo.duration,
      "rating": getYourGuideData.rating,
      "reviewCount": getYourGuideData.reviewCount
    }`;

    const tours = await sanityClient.fetch(query);
    return tours || [];
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
 * Procesar un solo tour
 */
async function processSingleTour(tourUrl, index = null, total = null) {
  const prefix = index !== null ? `[${index}/${total}] ` : '';

  console.log(`\n${prefix}Procesando: ${tourUrl}\n`);

  const startTime = Date.now();

  // Verificar si el tour ya existe en Sanity
  const existing = await sanityClient.fetch(
    `*[_type == "post" && getYourGuideUrl == $url][0]._id`,
    { url: tourUrl.split('?')[0] }
  );
  if (existing) {
    console.log(`Tour ya existe en Sanity, saltando...`);
    return { success: false, skipped: true, url: tourUrl };
  }

  // PASO 1: SCRAPING
  console.log(`${prefix}PASO 1/6: EXTRAYENDO DATOS DE GETYOURGUIDE`);

  const tourData = await scrapeGetYourGuideTour(tourUrl);

  if (!tourData.title) {
    throw new Error('No se pudo extraer el titulo del tour');
  }

  if (tourData.images.length === 0) {
    throw new Error('No se encontraron imagenes para el tour');
  }

  // Construir y limpiar URL de afiliado
  console.log(`${prefix}Generando URL de afiliado...`);
  const baseUrl = tourData.url.split('?')[0];
  const rawBookingUrl = `${baseUrl}?partner_id=${config.affiliate.partnerId}&utm_medium=${config.affiliate.utmMedium}`;
  const cleanBookingUrl = cleanAffiliateUrl(rawBookingUrl);
  tourData.bookingUrl = cleanBookingUrl;

  // PASO 2: PROCESAMIENTO DE IMAGENES
  console.log(`${prefix}PASO 2/6: PROCESANDO IMAGENES`);

  const imageUrls = tourData.images.slice(0, 15);
  const processedImages = await processImages(imageUrls);

  // PASO 3: BUSCAR TOURS RELACIONADOS
  console.log(`${prefix}PASO 3/6: BUSCANDO TOURS RELACIONADOS`);

  const relatedTours = await fetchRelatedTours();
  console.log(`   Encontrados ${relatedTours.length} tours relacionados`);

  // PASO 4: GENERACION DE CONTENIDO
  console.log(`${prefix}PASO 4/6: GENERANDO CONTENIDO CON CLAUDE`);

  const contentData = await generateTourContent(tourData, relatedTours);

  // PASO 5: SUBIDA A SANITY
  console.log(`${prefix}PASO 5/6: SUBIENDO A SANITY`);

  const result = await uploadToSanity(tourData, contentData, processedImages);

  // PASO 6: LIMPIEZA
  console.log(`${prefix}PASO 6/6: LIMPIEZA`);
  cleanupTempFiles();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  return {
    success: true,
    title: contentData.h1Title || tourData.title,
    slug: result.slug?.current,
    duration: duration,
    url: tourUrl
  };
}

/**
 * Leer URLs desde archivo urls.txt
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
 * Script principal - Orquestador del proceso completo
 */
async function main() {
  console.log('========================================================');
  console.log('   LasVegasTour - TOUR IMPORTER v2.0 (batch)');
  console.log('========================================================\n');

  const args = process.argv.slice(2);
  const isBatchMode = args.includes('--batch') || args.includes('-b');

  // Determinar URLs a procesar
  let urls = [];

  if (isBatchMode) {
    // Modo batch: leer de urls.txt
    urls = readUrlsFromFile();
    console.log(`MODO BATCH: ${urls.length} URLs encontradas en urls.txt\n`);
  } else if (args.length > 0 && args[0].includes('getyourguide.com')) {
    // Modo single: URL desde argumentos
    urls = [args[0]];
  } else if (args.length === 0) {
    // Sin argumentos: mostrar ayuda
    console.error('Error: Debes proporcionar una URL o usar --batch\n');
    console.log('Uso:');
    console.log('  node src/index.js <URL>           # Una sola URL');
    console.log('  node src/index.js --batch         # Leer de urls.txt\n');
    console.log('Ejemplos:');
    console.log('  node src/index.js https://www.getyourguide.com/vatican-city-l2697/vatican-museums-t12345');
    console.log('  node src/index.js --batch\n');
    process.exit(1);
  } else {
    console.error('Error: URL invalida. Debe ser de GetYourGuide\n');
    process.exit(1);
  }

  console.log(`Modo: ${config.dryRun ? 'DRY RUN (prueba sin crear)' : 'PRODUCCION'}`);

  // Configuracion de delays para batch
  const DELAY_BETWEEN_TOURS = 30000; // 30 segundos entre tours

  // Tracking de resultados
  const results = {
    success: [],
    failed: []
  };

  const totalStartTime = Date.now();

  // Procesar cada URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const isLast = i === urls.length - 1;

    console.log('\n--------------------------------------------------------');

    try {
      let result = null;
      let attempts = 0;

      while (attempts < 3) {
        attempts++;
        try {
          result = await processSingleTour(url, i + 1, urls.length);
          break;
        } catch (err) {
          if (err.message.includes('galer') && attempts < 3) {
            console.log(`\nReintentando import completo (intento ${attempts}/3)...`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            throw err;
          }
        }
      }

      results.success.push(result);
      if (result.skipped) {
        console.log(`\nSALTADO (ya existia): ${url}`);
      } else {
        console.log(`\nEXITO: ${result.title}`);
        if (!config.dryRun) {
          console.log(`   https://lasvegastour.com/tour/${result.slug}`);
        }
        console.log(`   ${result.duration}s`);
      }

    } catch (error) {
      console.error(`\nERROR procesando: ${url}`);
      console.error(`   ${error.message}`);

      results.failed.push({
        url: url,
        error: error.message
      });

      try {
        cleanupTempFiles();
      } catch (e) {
        // Ignorar
      }
    }

    // Delay entre tours (solo si no es el ultimo, hay mas de uno, y no fue skip)
    if (!isLast && urls.length > 1 && results.success[results.success.length - 1]?.skipped !== true) {
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

  console.log(`Creados: ${created.length}/${urls.length}`);
  console.log(`Saltados (ya existian): ${skipped.length}/${urls.length}`);
  console.log(`Fallidos: ${results.failed.length}/${urls.length}`);
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
