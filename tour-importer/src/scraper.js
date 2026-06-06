// src/scraper.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config.js';

// Aplicar plugin stealth
puppeteer.use(StealthPlugin());

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Delay aleatorio entre min y max ms
const randomDelay = (min, max) => delay(min + Math.random() * (max - min));

/**
 * 🧹 Limpia la URL de afiliado dejando solo parámetros esenciales
 */
export function cleanAffiliateUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Mantener solo parámetros esenciales de afiliado
    const essentialParams = ['partner_id', 'utm_medium', 'utm_source', 'utm_campaign'];
    
    // Crear nueva URL limpia
    const cleanUrl = new URL(urlObj.origin + urlObj.pathname);
    
    // Agregar solo parámetros esenciales que existan
    essentialParams.forEach(param => {
      const value = urlObj.searchParams.get(param);
      if (value) {
        cleanUrl.searchParams.set(param, value);
      }
    });
    
    return cleanUrl.toString();
  } catch (error) {
    console.warn('⚠️ Error limpiando URL, usando original:', error.message);
    return url;
  }
}

export async function scrapeGetYourGuideTour(url) {
  console.log('\n🔍 Iniciando scraping de GetYourGuide...');
  console.log(`📍 URL: ${url}`);
  
  let browser;
  
  try {
    // Lanzar navegador con stealth
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreHTTPSErrors: true
    });
    
    const page = await browser.newPage();
    
    // Viewport realista
    await page.setViewport({ 
      width: 1920, 
      height: 1080,
      deviceScaleFactor: 1
    });
    
    // User agent realista
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Headers adicionales
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });
    
    console.log('⏳ Navegando a la página...');
    
    // Navegar con timeout extendido
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 90000 
    });
    
    // Delay para que cargue completamente
    console.log('⏳ Esperando carga completa...');
    await randomDelay(3000, 5000);
    
    // Esperar a que cargue el contenido principal
    await page.waitForSelector('h1', { timeout: 15000 });
    
    console.log('✅ Página cargada');

    // 🍪 Cerrar banner de cookies/consentimiento (si aparece, intercepta los clicks)
    try {
      const dismissed = await page.evaluate(() => {
        // OneTrust (lo más común en GYG)
        const ot = document.querySelector('#onetrust-accept-btn-handler');
        if (ot) { ot.click(); return 'onetrust'; }
        // Por texto, como fallback
        const rx = /(accept all|accept cookies|^accept$|aceptar todo|agree|got it|allow all|i agree)/i;
        const btn = Array.from(document.querySelectorAll('button, a')).find(b => rx.test((b.innerText || '').trim()));
        if (btn) { btn.click(); return 'text'; }
        return null;
      });
      if (dismissed) {
        console.log(`🍪 Banner de cookies cerrado (${dismissed})`);
        await randomDelay(800, 1500);
      }
    } catch (e) {
      // No es crítico
    }
    
    // Scroll lento como humano
    console.log('📜 Scrolleando página...');
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if(totalHeight >= scrollHeight / 2){
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await randomDelay(1000, 2000);

    // 🖼️ ABRIR GALERÍA LIGHTBOX - robusto, multi-estrategia (GYG 2025)
    console.log('🖼️ Intentando abrir galería de imágenes...');
    let galleryOpened = false;
    const MAX_ATTEMPTS = 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // La galería/hero está arriba de todo: volver al tope
        await page.evaluate(() => window.scrollTo(0, 0));
        await randomDelay(1500, 2500);

        console.log(`   Intento ${attempt}/${MAX_ATTEMPTS}...`);
        let clicked = false;

        // Estrategia 1: botón "View all" clásico (clase de GYG)
        const viewAllBtn = await page.$('button.desktop-show-all-button');
        if (viewAllBtn) {
          await viewAllBtn.click().catch(() => {});
          clicked = true;
          console.log('      → click en "View all" (clase)');
          await randomDelay(1500, 2500);
          const gridImg = await page.$('button[aria-label^="View image"]');
          if (gridImg) { await gridImg.click().catch(() => {}); await randomDelay(1500, 2500); }
        }

        // Estrategia 2: botón/enlace por TEXTO
        if (!clicked) {
          const clickedByText = await page.evaluate(() => {
            const rx = /(view all|see all|all photos|show all photos|see all photos|ver todas)/i;
            const el = Array.from(document.querySelectorAll('button, a'))
              .find(e => rx.test(((e.innerText || '') + ' ' + (e.getAttribute('aria-label') || ''))));
            if (el) { el.click(); return true; }
            return false;
          });
          if (clickedByText) {
            clicked = true;
            console.log('      → click por texto (view/see all)');
            await randomDelay(1500, 2500);
            const gridImg = await page.$('button[aria-label^="View image"]');
            if (gridImg) { await gridImg.click().catch(() => {}); await randomDelay(1500, 2500); }
          }
        }

        // Estrategia 3: click directo en la primera imagen del hero
        if (!clicked) {
          const directImg = await page.$('button[aria-label^="View image"]');
          if (directImg) {
            await directImg.click().catch(() => {});
            clicked = true;
            console.log('      → click directo en imagen (aria-label)');
            await randomDelay(1500, 2500);
          }
        }

        // Estrategia 4: click en el contenedor de la primera imagen tour_img
        if (!clicked) {
          const clickedHero = await page.evaluate(() => {
            const img = document.querySelector('img[src*="tour_img"], img[srcset*="tour_img"]');
            if (img) {
              const target = img.closest('button') || img.closest('a') || img;
              target.click();
              return true;
            }
            return false;
          });
          if (clickedHero) {
            clicked = true;
            console.log('      → click en contenedor de imagen hero');
            await randomDelay(1500, 2500);
          }
        }

        // Confirmar que abrió la galería DE VERDAD:
        // un [role="dialog"] que contenga imágenes tour_img (no un banner de cookies)
        try {
          await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
          await randomDelay(800, 1200); // gracia para que cargue la primera imagen
          const hasGalleryImgs = await page.$(
            '[role="dialog"] img[src*="tour_img"], [role="dialog"] img[srcset*="tour_img"]'
          );
          if (hasGalleryImgs) {
            console.log('   ✅ Lightbox de galería abierto');
            galleryOpened = true;
            break;
          } else {
            console.log('   ⚠️ Apareció un dialog pero sin imágenes de tour (posible cookie/otro)');
          }
        } catch (_) {
          // no apareció el dialog: reintentar
        }

      } catch (e) {
        console.log(`   ⚠️ Intento ${attempt} fallido: ${e.message}`);
      }

      if (!galleryOpened && attempt < MAX_ATTEMPTS) {
        console.log('   🔄 Reintentando...');
        await randomDelay(2500, 4500); // espera humana, escalonada
      }
    }

    if (!galleryOpened) {
      throw new Error('No se pudo abrir galería de imágenes - tour abortado');
    }
  
    // Scroll dentro del lightbox para cargar todas las imágenes lazy
    console.log('📜 Scrolleando dentro del lightbox...');
    await page.evaluate(async () => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        for (let i = 0; i < 10; i++) {
          dialog.scrollTop += 500;
          await new Promise(r => setTimeout(r, 800));
        }
      }
    });
    await randomDelay(2000, 3000);


    // Click en "Show more" si existe (para expandir descripción completa)
    try {
      const showMoreButtons = await page.$$('button.toggle-content__button, button.toggle-content__label');
      for (const button of showMoreButtons) {
        try {
          await button.click();
          await randomDelay(500, 1000);
        } catch (e) {
          // Ignorar si el botón no es clickeable
        }
      }
      console.log('📖 Contenido expandido');
    } catch (e) {
      console.log('ℹ️ No se encontraron botones para expandir');
    }
    // Extraer todos los datos
    console.log('📊 Extrayendo datos del tour...');
    const tourData = await page.evaluate(() => {
      // Helper para extraer texto limpio
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : '';
      };
      
      const getTextAll = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => el.innerText.trim());
      };
      
      // Extraer título
      const title = getText('h1');
      
      // Extraer rating y reviews
      let rating = 0;
      let reviewCount = 0;
      
      const bodyText = document.body.innerText;
      const ratingMatch = bodyText.match(/(\d+\.?\d*)\s*out of 5/i);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
      
      const reviewMatch = bodyText.match(/(\d+[\d,]*)\s*reviews/i);
      if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
      
// Extraer precio
let price = 0;

// 1. Precio principal — selector específico de GYG
const mainPrice = document.querySelector('.price-info-actual-price-explanation ins');
if (mainPrice) {
  const priceMatch = mainPrice.innerText.match(/\$(\d+[\d,]*)/);
  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(/,/g, ''));
  }
}

// 2. Fallback — precio con descuento
if (price === 0) {
  const discountedPrice = document.querySelector('[style*="--label-discounted"]');
  if (discountedPrice) {
    const priceMatch = discountedPrice.innerText.match(/\$(\d+[\d,]*)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ''));
    }
  }
}

// 3. Último fallback — genérico pero solo dentro del header/booking area
if (price === 0) {
  const headerPrice = document.querySelector('[data-test-id="activity-price"] ins, [data-test-id="booking-price"] ins');
  if (headerPrice) {
    const priceMatch = headerPrice.innerText.match(/\$(\d+[\d,]*)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ''));
    }
  }
}
      
      // Extraer duración
      let duration = '';
      const durationMeta = document.querySelector('meta[property="product:duration"]') ||
                           document.querySelector('meta[itemprop="duration"]');
      if (durationMeta) {
        duration = durationMeta.content;
      }
      
      if (!duration) {
        const durationMatch = bodyText.match(/Duration[:\s]+(\d+\.?\d*(?:\s*-\s*\d+\.?\d*)?\s*(?:hours?|minutes?|min))/i);
        if (durationMatch) {
          duration = durationMatch[1].trim();
        }
      }
      
      // Extraer descripción - SELECTOR EXACTO
      const description = getText('[data-test-id="single-text"]');
      
// Extraer highlights - SELECTOR EXACTO (solo del bloque highlights-point)
const highlights = Array.from(document.querySelectorAll('#highlights-point [data-test-id="text-list-block-list"] li'))
  .map(li => li.innerText.trim())
  .filter(text => text.length > 0);
      
      // Extraer includes - SELECTOR EXACTO
      const includes = Array.from(document.querySelectorAll('[id^="inclusion-"][id$="-title-text"]'))
        .map(el => el.innerText.trim())
        .filter(text => text.length > 0);
      
      // Extraer idiomas
      let languages = 'English';
      try {
        const langMatch = bodyText.match(/(?:Languages?|Live tour guide language)(?::?\s)+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)/i);
        if (langMatch) {
          const knownLanguages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Russian', 'Chinese', 'Japanese'];
          const matched = langMatch[1].trim();
          languages = knownLanguages.some(l => matched.startsWith(l)) ? matched : 'English';
        }
      } catch (e) {
        languages = 'English';
      }

      // Extraer provider - SELECTOR EXACTO
     const provider = getText('[id="activity-provider-description-title"]').replace('Activity provider: ', '').trim();
      
// 🔥 EXTRACCIÓN DE IMÁGENES - DESDE LIGHTBOX/GALERÍA
const images = [];
const processedUrls = new Set();

// 🎯 PRIORIDAD 1: Buscar en el lightbox/swiper (galería abierta)
const lightboxImages = document.querySelectorAll(
  '[role="dialog"] img[src*="tour_img"], ' +
  '[role="dialog"] img[srcset*="tour_img"]'
);

console.log(`📸 Imágenes en lightbox: ${lightboxImages.length}`);

// Si encontró imágenes en el lightbox, usarlas
const imagesToProcess = lightboxImages.length > 0 
  ? lightboxImages 
  : document.querySelectorAll('img[src*="tour_img"], img[srcset*="tour_img"]');

console.log(`📸 Procesando ${imagesToProcess.length} imágenes`);

for (const img of Array.from(imagesToProcess).slice(0, 15)) {
  let imageUrl = null;
  
  // 🎯 PRIORIDAD 1: Buscar en srcset (versiones grandes)
  if (img.srcset && img.srcset.includes('tour_img')) {
    const srcsetParts = img.srcset.match(/(https:\/\/[^\s]+)\s+\d+x/gi);
    if (srcsetParts && srcsetParts.length > 0) {
      // Tomar la última (mayor resolución: dpr=2)
      imageUrl = srcsetParts[srcsetParts.length - 1].replace(/\s+\d+x$/i, '');
    }
  }
  
  // FALLBACK: src normal
  if (!imageUrl) {
    imageUrl = img.src || img.dataset.src || img.dataset.lazySrc;
  }
  
  if (!imageUrl || !imageUrl.includes('tour_img')) continue;
  
  // ✅ Usar URL completa sin modificar
  if (!processedUrls.has(imageUrl)) {
    processedUrls.add(imageUrl);
    images.push({
      url: imageUrl,
      baseUrl: imageUrl,
      width: img.naturalWidth || 0,
      height: img.naturalHeight || 0
    });
  }
}

// Filtrado final
const filteredImages = images
  .filter(img => {
    if (img.width > 0 && img.height > 0) {
      if (img.width < 400) return false;
      return true;
    }
    return true;
  })
  .slice(0, 15)
  .map(img => img.url);

console.log(`✅ Imágenes seleccionadas: ${filteredImages.length}`);
      
      // Extraer reviews - SELECTOR EXACTO
      const reviewQuotes = Array.from(document.querySelectorAll('.review-highlight-card__text'))
        .map(p => p.innerText.trim())
        .filter(text => text.length > 20)
        .slice(0, 5);
      
      // Detectar features
      const fullText = document.body.innerText.toLowerCase();
      const features = {
        freeCancellation: fullText.includes('free cancellation'),
        skipTheLine: fullText.includes('skip the line') || fullText.includes('skip-the-line'),
        smallGroup: fullText.includes('small group') || fullText.includes('limited to'),
        wheelchairAccessible: fullText.includes('wheelchair accessible'),
        liveGuide: fullText.includes('live guide') || fullText.includes('tour guide')
      };
      
      return {
        title,
        rating,
        reviewCount,
        price,
        duration,
        description,
        highlights,
        includes,
        languages,
        provider,  // ← NUEVO
        images: filteredImages,
        reviewQuotes,
        features,
        url: window.location.href
      };
    });
    
    console.log('✅ Datos extraídos exitosamente');
    console.log(`   Título: ${tourData.title}`);
    console.log(`   Rating: ${tourData.rating}★ (${tourData.reviewCount} reviews)`);
    console.log(`   Precio: $${tourData.price}`);
    console.log(`   Duración: ${tourData.duration}`);
    console.log(`   Provider: ${tourData.provider || '⚠️ NO ENCONTRADO'}`);
    console.log(`   Descripción: ${tourData.description.substring(0, 100)}...`);
    console.log(`   Highlights: ${tourData.highlights.length} items`);
    console.log(`   Includes: ${tourData.includes.length} items`);
    console.log(`   Reviews: ${tourData.reviewQuotes.length} items`);
    console.log(`   Idiomas: ${tourData.languages}`);
    console.log(`   Imágenes: ${tourData.images.length}`);
    
    return tourData;
    
  } catch (error) {
    console.error('❌ Error en scraping:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    
    // Rate limiting + jitter (reduce throttling de GYG en tandas grandes)
    const base = (config.scraper && config.scraper.rateLimitMs) ? config.scraper.rateLimitMs : 4000;
    const jitter = 2000 + Math.random() * 3000; // +2-5s aleatorio
    const waitMs = base + jitter;
    console.log(`⏱️ Esperando ${Math.round(waitMs / 1000)}s (rate limit + jitter)...`);
    await delay(waitMs);
  }
}
