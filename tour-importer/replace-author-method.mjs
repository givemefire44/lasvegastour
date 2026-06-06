import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import { createClient } from '@sanity/client';

// ========================================
// CONFIGURACIÓN
// ========================================
// Sin --execute = DRY RUN (solo muestra qué cambiaría)
// Con --execute = PRODUCCIÓN (escribe en Sanity)
//
// Uso:
//   node replace-author-method.mjs              → DRY RUN
//   node replace-author-method.mjs --execute    → ESCRIBE
// ========================================

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');

const OLD_TEXT = 'Claude Sonnet 4.6. Enrichment success rate:';
const NEW_TEXT = 'Data processing and enrichment via automated linguistic analysis layers:';

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

// ========================================
// HELPERS
// ========================================

/**
 * Recorre el content[] y reemplaza el texto viejo por el nuevo en TODOS los spans
 * de TODOS los blocks. Devuelve el content modificado y un contador de hits.
 */
function replaceInContent(content) {
  if (!Array.isArray(content)) return { content, hits: 0 };

  let totalHits = 0;
  const newContent = content.map((block) => {
    // Solo procesamos bloques tipo "block" con children
    if (block?._type !== 'block' || !Array.isArray(block.children)) {
      return block;
    }

    const newChildren = block.children.map((child) => {
      if (child?._type === 'span' && typeof child.text === 'string') {
        if (child.text.includes(OLD_TEXT)) {
          totalHits++;
          return {
            ...child,
            text: child.text.split(OLD_TEXT).join(NEW_TEXT),
          };
        }
      }
      return child;
    });

    return { ...block, children: newChildren };
  });

  return { content: newContent, hits: totalHits };
}

// ========================================
// MAIN
// ========================================

async function main() {
  console.log('========================================');
  console.log(DRY_RUN ? '🔍 DRY RUN — no se escribe nada' : '⚡ EXECUTE — escribiendo en Sanity');
  console.log('========================================');
  console.log(`Texto a buscar: "${OLD_TEXT}"`);
  console.log(`Texto a poner:  "${NEW_TEXT}"`);
  console.log('');

  // Traer todos los artículos Research (pillars + supportings)
  const query = `*[
    _type == "page"
    && (isPillar == true || defined(parentPillar))
  ]{
    _id,
    title,
    "slug": slug.current,
    content
  }`;

  const articles = await sanityClient.fetch(query);
  console.log(`📚 Artículos Research encontrados: ${articles.length}\n`);

  let totalMatched = 0;
  let totalPatched = 0;
  let totalFailed = 0;
  const results = [];

  for (const article of articles) {
    const { content: newContent, hits } = replaceInContent(article.content || []);

    if (hits === 0) {
      results.push({ slug: article.slug, status: 'no-match', hits: 0 });
      continue;
    }

    totalMatched++;

    if (DRY_RUN) {
      results.push({ slug: article.slug, status: 'would-replace', hits });
      continue;
    }

    // Apply
    try {
      await sanityClient
        .patch(article._id)
        .set({ content: newContent })
        .commit();
      totalPatched++;
      results.push({ slug: article.slug, status: 'patched', hits });
    } catch (err) {
      totalFailed++;
      results.push({ slug: article.slug, status: 'error', hits, error: err.message });
    }
  }

  // ========================================
  // REPORTE
  // ========================================
  console.log('--- RESULTADOS ---\n');
  for (const r of results) {
    if (r.status === 'no-match') continue; // no spameamos los que no tienen el texto

    const icon =
      r.status === 'patched' ? '✅' :
      r.status === 'would-replace' ? '📝' :
      '❌';
    console.log(`${icon} ${r.slug} — ${r.status} (${r.hits} hit${r.hits !== 1 ? 's' : ''})`);
    if (r.error) console.log(`   ⚠️  ${r.error}`);
  }

  console.log('\n--- RESUMEN ---');
  console.log(`Total artículos Research:     ${articles.length}`);
  console.log(`Con texto encontrado:         ${totalMatched}`);
  console.log(`Sin texto (no match):         ${articles.length - totalMatched}`);
  if (!DRY_RUN) {
    console.log(`Patcheados con éxito:         ${totalPatched}`);
    console.log(`Fallos:                       ${totalFailed}`);
  }

  if (DRY_RUN && totalMatched > 0) {
    console.log('\n💡 Para aplicar los cambios reales corré:');
    console.log('   node replace-author-method.mjs --execute');
  }
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});