#!/usr/bin/env node

/**
 * Script para agregar/actualizar tablas comparativas en todos los posts
 * 
 * Modos de ejecución:
 * - Test: node scripts/add-tables-to-all-posts.js --test (procesa 1 tour específico)
 * - Dry Run: node scripts/add-tables-to-all-posts.js --dry-run (simula sin guardar)
 * - Producción: node scripts/add-tables-to-all-posts.js --run (ejecuta masivamente)
 */

import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

// Configuración
const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID;
const SANITY_DATASET = process.env.SANITY_DATASET || 'production';
const SANITY_TOKEN = process.env.SANITY_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Cliente Sanity
const sanityClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  token: SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

// Cliente Anthropic
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY
});

// Parse argumentos
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTest = args.includes('--test');
const isRun = args.includes('--run');
const testSlug = args.find(arg => !arg.startsWith('--'));

if (!isDryRun && !isTest && !isRun) {
  console.log(`
❌ Debes especificar un modo de ejecución:

  --test [slug]    Testear con 1 tour específico (opcional: especificar slug)
  --dry-run        Simular en todos los tours sin guardar
  --run            Ejecutar masivamente (CUIDADO!)

Ejemplos:
  node scripts/add-tables-to-all-posts.js --test
  node scripts/add-tables-to-all-posts.js --test colosseum-arena-floor-tour
  node scripts/add-tables-to-all-posts.js --dry-run
  node scripts/add-tables-to-all-posts.js --run
  `);
  process.exit(1);
}

console.log(`
🚀 SCRIPT: Agregar tablas comparativas a posts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Modo: ${isTest ? '🧪 TEST' : isDryRun ? '🔍 DRY RUN' : '⚠️ PRODUCCIÓN'}
${testSlug ? `Tour: ${testSlug}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

/**
 * Obtener posts de Sanity
 */
async function getPosts() {
  try {
    // 🔍 DEBUG - Buscar el slug específico
    if (testSlug) {
      console.log(`\n🔍 Buscando slug: ${testSlug}`);
      const specificPost = await sanityClient.fetch(`*[_type == "post" && slug.current == "${testSlug}"][0] {
        _id,
        _type,
        "slug": slug.current,
        title
      }`);
      console.log('Resultado:', specificPost ? 'ENCONTRADO ✅' : 'NO ENCONTRADO ❌');
      if (specificPost) {
        console.log('Post:', JSON.stringify(specificPost, null, 2));
      }
      console.log('');
    }
    // FIN DEBUG
    
    let query = `*[_type == "post" && defined(slug.current)`;
    
    if (isTest) {
      if (testSlug) {
        query += ` && slug.current == "${testSlug}"`;
      }
      query += `][0]`; // Cerrar filtro antes del [0]
    } else {
      query += `]`; // Cerrar filtro
      query += ` | order(publishedAt desc)`;
    }
    
    query += ` {
      _id,
      _rev,
      title,
      slug,
      body,
      tourInfo,
      getYourGuideData
    }`;
    
    const posts = await sanityClient.fetch(query);
    
    if (isTest) {
      return posts ? [posts] : [];
    }
    
    return posts || [];
  } catch (error) {
    console.error('❌ Error obteniendo posts:', error.message);
    throw error;
  }
}

/**
 * Obtener tours relacionados para un post
 */
async function getRelatedTours(currentSlug) {
  try {
    const query = `*[_type == "post" && slug.current != $currentSlug && defined(tourInfo.price) && defined(getYourGuideData.rating)] 
      | order(publishedAt desc)[0...4] {
      _id,
      title,
      slug,
      seoDescription,
      tourInfo {
        duration,
        price,
        currency
      },
      getYourGuideData {
        rating,
        reviewCount
      }
    }`;
    
    const tours = await sanityClient.fetch(query, { currentSlug });
    return tours || [];
  } catch (error) {
    console.error(`   ⚠️ Error obteniendo related tours:`, error.message);
    return [];
  }
}

/**
 * Generar tabla con Claude API
 */
async function generateTable(post, relatedTours) {
  try {
    const prompt = `You are generating a comparison table for a tour page.

**CURRENT TOUR:**
- Title: ${post.title}
- Price: $${post.tourInfo?.price || 'N/A'}
- Duration: ${post.tourInfo?.duration || 'N/A'}
- Rating: ${post.getYourGuideData?.rating || 'N/A'}★

**RELATED TOURS (use EXACT slugs):**
${relatedTours.slice(0, 3).map((tour, i) => `
${i + 1}. ${tour.title}
   - Slug: ${tour.slug.current}
   - Price: $${tour.price || 'N/A'}
   - Duration: ${tour.duration || 'N/A'}
   - Rating: ${tour.rating || 'N/A'}★
`).join('\n')}

**YOUR TASK:**
Generate ONLY a comparison table in this EXACT format:

\`\`\`table-json
{
  "title": "Compare Similar Tours",
  "rows": [
    {"cells": ["Tour", "Price", "Duration", "Rating", "Best For"]},
    {"cells": ["[Current Tour - short name max 40 chars]", "$${post.tourInfo?.price || 'XX'}", "${post.tourInfo?.duration || 'X hours'}", "${post.getYourGuideData?.rating || 'X.X'}★", "[Key feature]"]},
    {"cells": ["[SLUG:${relatedTours[0]?.slug?.current || 'slug-1'}]${relatedTours[0]?.title?.substring(0, 40) || 'Tour 1'}${relatedTours[0]?.title?.length > 40 ? '...' : ''}", "$${relatedTours[0]?.tourInfo?.price || 'XX'}", "${relatedTours[0]?.tourInfo?.duration || 'X hours'}", "${relatedTours[0]?.getYourGuideData?.rating || 'X.X'}★", "[Brief highlight]"]},
    {"cells": ["[SLUG:${relatedTours[1]?.slug?.current || 'slug-2'}]${relatedTours[1]?.title?.substring(0, 40) || 'Tour 2'}${relatedTours[1]?.title?.length > 40 ? '...' : ''}", "$${relatedTours[1]?.tourInfo?.price || 'XX'}", "${relatedTours[1]?.tourInfo?.duration || 'X hours'}", "${relatedTours[1]?.getYourGuideData?.rating || 'X.X'}★", "[Brief highlight]"]},
    {"cells": ["[SLUG:${relatedTours[2]?.slug?.current || 'slug-3'}]${relatedTours[2]?.title?.substring(0, 40) || 'Tour 3'}${relatedTours[2]?.title?.length > 40 ? '...' : ''}", "$${relatedTours[2]?.tourInfo?.price || 'XX'}", "${relatedTours[2]?.tourInfo?.duration || 'X hours'}", "${relatedTours[2]?.getYourGuideData?.rating || 'X.X'}★", "[Brief highlight]"]}
  ]
}
\`\`\`

**CRITICAL RULES:**
1. Use EXACT [SLUG:xxx] format for related tours (positions 2, 3, 4)
2. First row (current tour) has NO [SLUG:] prefix
3. Keep tour names under 40 characters
4. Use the EXACT slugs provided above
5. Fill "Best For" column with brief, helpful descriptions
6. Output ONLY the table-json block, nothing else`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    
    // Extraer el bloque table-json
    const match = responseText.match(/```table-json\n([\s\S]+?)\n```/);
    if (!match) {
      throw new Error('No se encontró bloque table-json en la respuesta de Claude');
    }

    const tableData = JSON.parse(match[1]);
    
    // Validar estructura
    if (!tableData.rows || tableData.rows.length < 2) {
      throw new Error('Tabla inválida: debe tener al menos 2 filas');
    }

    return tableData;
    
  } catch (error) {
    console.error(`   ❌ Error generando tabla:`, error.message);
    throw error;
  }
}

/**
 * Insertar o actualizar tabla en el body
 */
function insertOrUpdateTable(body, tableData) {
  if (!body || !Array.isArray(body)) {
    console.log('   ⚠️ Body vacío o inválido');
    return body;
  }

  // Generar el objeto de tabla
  const tableBlock = {
    _type: 'simpleTable',
    _key: `table-${Date.now()}`,
    title: tableData.title || 'Compare Similar Tours',
    rows: tableData.rows.map(row => ({
      _type: 'tableRow',
      _key: `row-${Math.random().toString(36).substr(2, 9)}`,
      cells: row.cells || []
    }))
  };

  // Buscar si ya existe una tabla
  const existingTableIndex = body.findIndex(block => block._type === 'simpleTable');

  if (existingTableIndex !== -1) {
    // Reemplazar tabla existente
    console.log('   🔄 Reemplazando tabla existente');
    const newBody = [...body];
    newBody[existingTableIndex] = tableBlock;
    return newBody;
  } else {
    // Insertar después del bloque 2 (stat line + quick answer + intro)
    console.log('   ➕ Insertando tabla nueva en posición 3');
    const newBody = [...body];
    newBody.splice(3, 0, tableBlock);
    return newBody;
  }
}

/**
 * Actualizar post en Sanity
 */
async function updatePost(postId, newBody, isDryRun) {
  if (isDryRun) {
    console.log('   🔍 [DRY RUN] No se guardó en Sanity');
    return { success: true, dryRun: true };
  }

  try {
    await sanityClient
      .patch(postId)
      .set({ body: newBody })
      .commit();
    
    console.log('   ✅ Post actualizado en Sanity');
    return { success: true };
  } catch (error) {
    console.error('   ❌ Error actualizando post:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Procesar un post
 */
async function processPost(post, index, total) {
  console.log(`\n[${index + 1}/${total}] 📄 ${post.title}`);
  console.log(`   Slug: ${post.slug.current}`);

  try {
    // 1. Obtener related tours
    console.log('   🔍 Obteniendo related tours...');
    const relatedTours = await getRelatedTours(post.slug.current);
    console.log(`   ✅ Encontrados ${relatedTours.length} related tours`);

    if (relatedTours.length < 2) {
      console.log('   ⚠️ Menos de 2 related tours, saltando...');
      return { success: false, reason: 'insufficient_tours' };
    }

    // 2. Generar tabla con Claude
    console.log('   🤖 Generando tabla con Claude API...');
    const tableData = await generateTable(post, relatedTours);
    console.log(`   ✅ Tabla generada: ${tableData.rows.length} filas`);

    // 3. Insertar/actualizar en body
    console.log('   📝 Actualizando body...');
    const newBody = insertOrUpdateTable(post.body, tableData);

    // 4. Guardar en Sanity
    const result = await updatePost(post._id, newBody, isDryRun);

    return result;

  } catch (error) {
    console.error(`   ❌ Error procesando post:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main
 */
async function main() {
  try {
    // Obtener posts
    console.log('📥 Obteniendo posts de Sanity...\n');
    const posts = await getPosts();
    
    if (posts.length === 0) {
      console.log('❌ No se encontraron posts');
      process.exit(1);
    }

    console.log(`✅ Encontrados ${posts.length} post(s)\n`);

    // Procesar posts
    const results = {
      total: posts.length,
      success: 0,
      failed: 0,
      skipped: 0
    };

    for (let i = 0; i < posts.length; i++) {
      const result = await processPost(posts[i], i, posts.length);
      
      if (result.success) {
        results.success++;
      } else if (result.reason === 'insufficient_tours') {
        results.skipped++;
      } else {
        results.failed++;
      }

      // Esperar 2 segundos entre requests para no saturar APIs
      if (i < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Resumen final
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RESUMEN FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:    ${results.total}
Exitosos: ${results.success} ✅
Fallidos: ${results.failed} ❌
Saltados: ${results.skipped} ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    if (isDryRun) {
      console.log('🔍 DRY RUN completado - no se guardaron cambios');
    } else if (isTest) {
      console.log('🧪 TEST completado');
    } else {
      console.log('✅ Ejecución masiva completada');
    }

  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar
main();