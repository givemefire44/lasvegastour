// src/sanityUploader.js
import { createClient } from '@sanity/client';
import { config } from '../config.js';

const client = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn: false
});

// ============================================================
//  AUTO-CATEGORIZACIÓN — Las Vegas (8 categorías)
//  Cada tour se asigna a UNA categoría (campo `category` = referencia simple).
// ============================================================
const CATEGORIES = {
  'grand-canyon-tours': 'Grand Canyon Tours',
  'hoover-dam-tours':   'Hoover Dam Tours',
  'adventure-tours':    'Adventure & Outdoor',
  'day-trips':          'Day Trips & National Parks',
  'helicopter-tours':   'Helicopter Tours',
  'nightlife':          'Nightlife & Bar Crawls',
  'shows':              'Shows & Entertainment',
  'strip-tours':        'Strip & City Tours',
};

/**
 * Clasifica un tour por su título (ORDEN DE PRIORIDAD: primer match gana).
 * Devuelve el slug de la categoría. Fallback = strip-tours.
 */
function classifyCategory(title = '') {
  const t = String(title).toLowerCase();

  // 1) Helicopter (gana siempre: TODO lo que vuela en helicóptero, incluido al Grand Canyon)
  if (/(helicopter|heli[- ]?flight|heli[- ]?tour|chopper)/.test(t)) return 'helicopter-tours';

  // 2) Grand Canyon (tours terrestres: bus/van; los vuelos ya se fueron a Helicopter)
  if (/\b(grand canyon|skywalk|west rim|south rim)\b/.test(t)) return 'grand-canyon-tours';

  // 3) Hoover Dam (sin Grand Canyon)
  if (/\bhoover dam\b/.test(t)) return 'hoover-dam-tours';

  // 4) Adventure & Outdoor (atv, zip, skydive, shooting, kayak, etc.)
  if (/(atv|off[- ]?road|dune buggy|zip[- ]?line|zipline|skydiv|shooting|gun range|machine gun|firing range|kayak|jet ?ski|horseback|white ?water|rafting|paraglid|bungee)/.test(t)) return 'adventure-tours';

  // 5) Day Trips & National Parks
  if (/(antelope|horseshoe bend|zion|bryce|death valley|red rock|valley of fire|route 66|monument valley|mojave|seven magic|lake mead|sedona|joshua tree)/.test(t)) return 'day-trips';

  // 6) Nightlife & Bar Crawls
  if (/(night ?club|club crawl|bar crawl|pub crawl|party bus|nightlife|vip (club|nightclub)|bottle service)/.test(t)) return 'nightlife';

  // 7) Shows & Entertainment
  if (/(cirque|\bshow\b|magic|comedy|concert|broadway|burlesque|dinner show|residency|theater|theatre)/.test(t)) return 'shows';

  // 8) Strip & City (y fallback de todo lo demás)
  return 'strip-tours';
}

// Cache de referencias por slug (una búsqueda/creación por categoría por corrida)
const _categoryRefCache = {};

/**
 * Busca la categoría por slug/title; si no existe la crea (una sola vez por corrida).
 * Devuelve la referencia lista para el campo `category` del post.
 */
async function getOrCreateCategoryRef(slug, title) {
  if (_categoryRefCache[slug]) return _categoryRefCache[slug];

  const existing = await client.fetch(
    `*[_type == "category" && (slug.current == $slug || title == $title)][0]{_id}`,
    { slug, title }
  );

  let id;
  if (existing && existing._id) {
    id = existing._id;
    console.log(`   🏷️  Categoría encontrada: ${title} (${id})`);
  } else {
    const created = await client.create({
      _type: 'category',
      title,
      slug: { _type: 'slug', current: slug }
    });
    id = created._id;
    console.log(`   🏷️  Categoría creada: ${title} (${id})`);
  }

  _categoryRefCache[slug] = { _type: 'reference', _ref: id };
  return _categoryRefCache[slug];
}

/**
 * Sube una imagen a Sanity y retorna el asset reference
 */
async function uploadImage(imageData) {
  try {
    const asset = await client.assets.upload('image', imageData.buffer, {
      filename: imageData.filename,
      contentType: imageData.mimeType
    });

    return {
      _type: 'image',
      asset: {
        _type: 'reference',
        _ref: asset._id
      },
      alt: imageData.alt || ''
    };
  } catch (error) {
    console.error('❌ Error subiendo imagen:', error.message);
    throw error;
  }
}

/**
 * Sube todas las imágenes del tour
 */
async function uploadTourImages(processedImages) {
  console.log(`\n📤 Subiendo ${processedImages.length} imágenes a Sanity...`);

  const uploadedImages = [];

  for (let i = 0; i < processedImages.length; i++) {
    console.log(`   [${i + 1}/${processedImages.length}] Subiendo imagen...`);

    const imageRef = await uploadImage(processedImages[i]);
    uploadedImages.push(imageRef);

    console.log(`   ✅ Imagen ${i + 1} subida`);
  }

  console.log(`✅ ${uploadedImages.length} imágenes subidas exitosamente`);

  return uploadedImages;
}

/**
 * Genera slug único desde título
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[🛵🏛️📸🍰🧡⭐✅❌ℹ️📊🔚👉💰⏱️💡💬🪖👨‍🏫☕🏨🍽️❓]/g, '') // Remover emojis
    .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres especiales
    .replace(/^-+|-+$/g, '') // Remover guiones al inicio/fin
    .substring(0, 96); // Max 96 caracteres
}

/**
 * Normaliza duración - MANTENER EN INGLÉS (el sitio es en inglés)
 */
function normalizeDuration(durationText) {
  if (!durationText) return '';
  return durationText.trim();
}

/**
 * Convierte URL de GetYourGuide a URL de afiliado LIMPIA
 */
function toAffiliateUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const baseUrl = url.split('?')[0];
    const cleanUrl = `${baseUrl}?partner_id=2FVNDZG&utm_medium=online_publisher`;
    return cleanUrl;
  } catch (error) {
    console.warn('⚠️ Error convirtiendo a URL de afiliado:', error.message);
    return url;
  }
}

/**
 * Crea el documento del post en Sanity
 */
export async function createTourPost(tourData, generatedContent, uploadedImages) {
  console.log('\n📝 Creando post en Sanity...');

  // Categoría automática (clasificada por título)
  const catSlug = config.forcedCategory || classifyCategory(tourData.title);
  const catTitle = CATEGORIES[catSlug] || catSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  if (config.dryRun) {
    console.log('🔶 DRY RUN MODE - No se creará el post realmente');
    console.log('\n📋 Preview del post que se crearía:');
    console.log('-----------------------------------');
    console.log(`Título: ${generatedContent.title}`);
    console.log(`SEO Title: ${generatedContent.seoTitle}`);
    console.log(`SEO Description: ${generatedContent.seoDescription}`);
    console.log(`Keywords: ${generatedContent.seoKeywords.join(', ')}`);
    console.log(`Ciudad: ${generatedContent.city}`);
    console.log(`Categoría: ${catTitle} (${catSlug})`);
    console.log(`Rating: ${tourData.rating}★ (${tourData.reviewCount} reviews)`);
    console.log(`Precio: $${tourData.price}`);
    console.log(`Duración: ${tourData.duration}`);
    console.log(`Idiomas: ${tourData.languages}`);
    console.log(`Imágenes: ${uploadedImages.length}`);
    console.log(`URL Original: ${tourData.url}`);
    console.log(`URL Afiliado: ${toAffiliateUrl(tourData.url)}`);
    console.log('-----------------------------------\n');

    return {
      success: true,
      dryRun: true,
      preview: {
        title: generatedContent.title,
        seoTitle: generatedContent.seoTitle,
        city: generatedContent.city,
        category: catTitle
      }
    };
  }

  try {
    // Generar slug
    const slug = generateSlug(generatedContent.title);

    // Categoría automática (find-or-create por slug clasificado)
    const categoryRef = await getOrCreateCategoryRef(catSlug, catTitle);

    // Convertir contenido a Portable Text
    const portableTextBody = markdownToPortableText(generatedContent.body);

    // Generar URL de afiliado LIMPIA
    const affiliateUrl = tourData.source === 'viator' ? tourData.url : toAffiliateUrl(tourData.url);

    // Normalizar duración (mantener en inglés)
    const durationNormalized = normalizeDuration(tourData.duration);

    console.log(`   🔗 Generando URL de afiliado...`);
    console.log(`   📍 URL original: ${tourData.url}`);
    console.log(`   ✅ URL limpia: ${affiliateUrl}`);

    // Construir documento
    const postDocument = {
      _type: 'post',

      // Básicos
      title: generatedContent.title,
      slug: {
        _type: 'slug',
        current: slug
      },

     // Categoría (auto-asignada por clasificador)
     category: categoryRef,

     // Idioma del contenido (ancla i18n — hoy 100% inglés)
     language: 'en',

      // SEO
      seoTitle: generatedContent.seoTitle,
      seoDescription: generatedContent.seoDescription,
      seoKeywords: generatedContent.seoKeywords,
      seoImage: uploadedImages[0],

      // Imágenes
      heroGallery: uploadedImages.slice(0, 15),

      // Contenido
      body: portableTextBody,

      // FAQs (structured)
      ...(generatedContent.faqs && generatedContent.faqs.length > 0 ? {
        faqs: generatedContent.faqs
      } : {}),

      // Editorial Review
      ...(generatedContent.editorialRating ? {
        editorialRating: generatedContent.editorialRating,
        editorialReview: generatedContent.editorialReview,
        editorialDate: new Date().toISOString().split('T')[0]
      } : {}),

      // Fecha
      publishedAt: new Date().toISOString(),

      // Tour Info (Schema.org) - EN INGLÉS
      tourInfo: {
        _type: 'object',
        duration: durationNormalized,
        price: tourData.price || 0,
        currency: 'USD',
        location: generatedContent.city,
        platform: 'lasvegastour.com'
      },

      // Tour Features
      tourFeatures: {
        _type: 'object',
        freeCancellation: tourData.features.freeCancellation || false,
        skipTheLine: tourData.features.skipTheLine || false,
        wheelchairAccessible: tourData.features.wheelchairAccessible || false,
        smallGroupAvailable: tourData.features.smallGroup || false,
        hostGuide: tourData.languages || 'English',
        audioGuide: ''
      },

      // GetYourGuide Data
      getYourGuideData: {
        _type: 'object',
        rating: tourData.rating || 0,
        reviewCount: tourData.reviewCount || 0,
        provider: tourData.provider || '',
        lastUpdated: new Date().toISOString()
      },

      // URLs
      getYourGuideUrl: tourData.url.split('?')[0],
      bookingUrl: affiliateUrl

    };

    // Crear documento en Sanity
    const result = await client.create(postDocument);

    console.log('✅ Post creado exitosamente en Sanity');
    console.log(`   ID: ${result._id}`);
    console.log(`   Título: ${result.title}`);
    console.log(`   Slug: ${result.slug.current}`);
    console.log(`   Categoría: ${catTitle}`);
    console.log(`   Duración: ${durationNormalized}`);
    console.log(`   Idiomas: ${tourData.languages}`);
    console.log(`   URL: ${config.siteUrl}/tour/${result.slug.current}`);
    console.log(`   🔗 Affiliate URL: ${affiliateUrl}`);

    return {
      success: true,
      postId: result._id,
      slug: result.slug.current,
      url: `${config.siteUrl}/tour/${result.slug.current}`
    };

  } catch (error) {
    console.error('❌ Error creando post en Sanity:', error.message);
    throw error;
  }
}

/**
 * Sube imágenes y crea el post completo
 */
export async function uploadToSanity(tourData, generatedContent, processedImages) {
  try {
    // --- GUARD anti-duplicados -------------------------------------------
    // Si ya existe un post (published) con este slug, NO se sube ni se crea:
    // se omite para no generar un gemelo con el mismo slug.
    const guardSlug = generateSlug(generatedContent.title);
    const existing = await client.fetch(
      `*[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug][0]{ _id }`,
      { slug: guardSlug }
    );
    if (existing?._id) {
      console.warn(`   [GUARD] Slug duplicado: "${guardSlug}" ya existe (${existing._id}).`);
      console.warn(`           Se OMITE la creacion para no duplicar. Para actualizar usa rescrape (patchTourPost).`);
      return { success: false, skipped: true, reason: 'duplicate-slug', existingId: existing._id, slug: guardSlug };
    }
    // ---------------------------------------------------------------------

    const uploadedImages = await uploadTourImages(processedImages);
    const result = await createTourPost(tourData, generatedContent, uploadedImages);
    return result;
  } catch (error) {
    console.error('❌ Error en proceso de upload:', error.message);
    throw error;
  }
}

/**
 * Convierte markdown a Portable Text con soporte para BOLD INLINE
 */
function markdownToPortableText(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  let currentParagraph = [];

  const processInlineMarks = (text) => {
    const children = [];
    let lastIndex = 0;

    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        children.push({
          _type: 'span',
          _key: generateKey(),
          text: text.substring(lastIndex, match.index),
          marks: []
        });
      }

      children.push({
        _type: 'span',
        _key: generateKey(),
        text: match[1],
        marks: ['strong']
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      children.push({
        _type: 'span',
        _key: generateKey(),
        text: text.substring(lastIndex),
        marks: []
      });
    }

    if (children.length === 0) {
      return [{
        _type: 'span',
        _key: generateKey(),
        text: text,
        marks: []
      }];
    }

    return children;
  };

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const fullText = currentParagraph.join(' ');
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'normal',
        children: processInlineMarks(fullText),
        markDefs: []
      });
      currentParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      const text = line.replace('## ', '');
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'h2',
        children: [{ _type: 'span', _key: generateKey(), text: text, marks: [] }],
        markDefs: []
      });
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      const text = line.replace('### ', '');
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'h3',
        children: [{ _type: 'span', _key: generateKey(), text: text, marks: [] }],
        markDefs: []
      });
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      const text = line.replace('- ', '');
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'normal',
        listItem: 'bullet',
        children: processInlineMarks(text),
        markDefs: []
      });
      continue;
    }

    if (line.startsWith('"') && line.endsWith('"')) {
      flushParagraph();
      const text = line.replace(/"/g, '');
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'blockquote',
        children: [{ _type: 'span', _key: generateKey(), text: text, marks: [] }],
        markDefs: []
      });
      continue;
    }

    if (line.startsWith('**Q:') && line.includes('?**')) {
      flushParagraph();
      const text = line.replace(/^\*\*/, '').replace(/\*\*$/, '');
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'normal',
        children: [{ _type: 'span', _key: generateKey(), text: text, marks: ['strong'] }],
        markDefs: []
      });
      continue;
    }

    if (line.startsWith('A: ')) {
      flushParagraph();
      const text = line;
      blocks.push({
        _type: 'block',
        _key: generateKey(),
        style: 'normal',
        children: [{ _type: 'span', _key: generateKey(), text: text, marks: [] }],
        markDefs: []
      });
      continue;
    }

    currentParagraph.push(line);
  }

  flushParagraph();

  return blocks;
}

/**
 * Genera key única para Sanity
 */
function generateKey() {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Patchea un tour existente — NUNCA toca title, slug, seoDescription, category
 */
export async function patchTourPost(existingId, tourData, generatedContent, uploadedImages) {
  console.log(`\n📝 Patcheando post: ${existingId}`);

  try {
    const portableTextBody = markdownToPortableText(generatedContent.body);
    const affiliateUrl = tourData.source === 'viator' ? tourData.url : toAffiliateUrl(tourData.url);
    const durationNormalized = normalizeDuration(tourData.duration);

    await client.patch(existingId).set({
      body: portableTextBody,
      heroGallery: uploadedImages.slice(0, 15),
      seoImage: uploadedImages[0],
      tourInfo: {
        _type: 'object',
        duration: durationNormalized,
        price: tourData.price || 0,
        currency: 'USD',
        location: generatedContent.city,
        platform: 'lasvegastour.com'
      },
      tourFeatures: {
        _type: 'object',
        freeCancellation: tourData.features?.freeCancellation || false,
        skipTheLine: tourData.features?.skipTheLine || false,
        wheelchairAccessible: tourData.features?.wheelchairAccessible || false,
        smallGroupAvailable: tourData.features?.smallGroup || false,
        hostGuide: tourData.languages || 'English',
        audioGuide: ''
      },
      getYourGuideData: {
        _type: 'object',
        rating: tourData.rating || 0,
        reviewCount: tourData.reviewCount || 0,
        provider: tourData.provider || '',
        lastUpdated: new Date().toISOString()
      },
      bookingUrl: affiliateUrl,
      ...(generatedContent.faqs?.length > 0 ? { faqs: generatedContent.faqs } : {}),
    }).commit();

    console.log(`✅ Patch exitoso`);
    return { success: true };

  } catch (error) {
    console.error('❌ Error patcheando post:', error.message);
    throw error;
  }
}

/**
 * Upload imágenes + patch tour existente (flujo rescrape)
 */
export async function rescrapeToSanity(existingId, tourData, generatedContent, processedImages) {
  try {
    const uploadedImages = await uploadTourImages(processedImages);
    const result = await patchTourPost(existingId, tourData, generatedContent, uploadedImages);
    return result;
  } catch (error) {
    console.error('❌ Error en proceso de rescrape:', error.message);
    throw error;
  }
}

export { classifyCategory, CATEGORIES };
