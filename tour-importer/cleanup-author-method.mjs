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
//   node cleanup-author-method.mjs              → DRY RUN
//   node cleanup-author-method.mjs --execute    → ESCRIBE
// ========================================

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');

// Texto evergreen final (destino unificado)
const CLEAN_TEXT = 'Data processing and enrichment via automated linguistic analysis layers: 95.7% (12,223 of 12,774 items).';

// Lista de patrones a reemplazar
// El orden importa: van de más específico a más genérico
const REPLACEMENTS = [
  // Grupo 2 — duplicados con ".:" raro
  {
    name: 'Duplicado con ":." raro',
    from: 'Data processing and enrichment via automated linguistic analysis layers: 95.7% (12,223/12,774 items).: 95.7% (12,223/12,774 items).',
    to: CLEAN_TEXT,
  },
  // Grupo 2 — duplicados simples (% repetido)
  {
    name: 'Duplicado simple (% repetido)',
    from: 'Data processing and enrichment via automated linguistic analysis layers: 95.7% (12,223/12,774 items). 95.7% (12,223/12,774 items).',
    to: CLEAN_TEXT,
  },
  // Grupo 2 — versión limpia pero con / en lugar de "of" (la unificamos)
  {
    name: 'Slash a "of"',
    from: 'Data processing and enrichment via automated linguistic analysis layers: 95.7% (12,223/12,774 items).',
    to: CLEAN_TEXT,
  },
  // Grupo 3 — pillar con texto extendido (Sonnet 4.6 + Opus 4.7)
  {
    name: 'Pillar texto extendido',
    from: 'Topic, sentiment, and claims extraction via Claude Sonnet 4.6. Strategic clustering and article structure via Claude Opus 4.7. Enrichment success rate: 95.7% (12,223 of 12,774 items).',
    to: CLEAN_TEXT,
  },
];

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

/**
 * Aplica todos los reemplazos al content.
 * Devuelve el content modificado y una lista de qué reemplazos se aplicaron.
 */
function applyReplacements(content) {
  if (!Array.isArray(content)) return { content, applied: [] };

  const appliedReplacements = [];

  const newContent = content.map((block) => {
    if (block?._type !== 'block' || !Array.isArray(block.children)) {
      return block;
    }

    const newChildren = block.children.map((child) => {
      if (child?._type !== 'span' || typeof child.text !== 'string') {
        return child;
      }

      let text = child.text;
      for (const r of REPLACEMENTS) {
        if (text.includes(r.from)) {
          text = text.split(r.from).join(r.to);
          appliedReplacements.push(r.name);
        }
      }

      return text === child.text ? child : { ...child, text };
    });

    return { ...block, children: newChildren };
  });

  return { content: newContent, applied: appliedReplacements };
}

async function main() {
  console.log('========================================');
  console.log(DRY_RUN ? '🔍 DRY RUN — no se escribe nada' : '⚡ EXECUTE — escribiendo en Sanity');
  console.log('========================================');
  console.log(`Texto destino (evergreen):\n   "${CLEAN_TEXT}"`);
  console.log('');
  console.log('Patrones a reemplazar:');
  REPLACEMENTS.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}`);
  });
  console.log('');

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

  let totalAffected = 0;
  let totalPatched = 0;
  let totalFailed = 0;
  const results = [];

  for (const article of articles) {
    const { content: newContent, applied } = applyReplacements(article.content || []);

    if (applied.length === 0) {
      continue;
    }

    totalAffected++;

    if (DRY_RUN) {
      results.push({ slug: article.slug, applied, status: 'would-clean' });
      continue;
    }

    try {
      await sanityClient
        .patch(article._id)
        .set({ content: newContent })
        .commit();
      totalPatched++;
      results.push({ slug: article.slug, applied, status: 'cleaned' });
    } catch (err) {
      totalFailed++;
      results.push({ slug: article.slug, applied, status: 'error', error: err.message });
    }
  }

  console.log('--- RESULTADOS ---\n');
  for (const r of results) {
    const icon =
      r.status === 'cleaned' ? '✅' :
      r.status === 'would-clean' ? '📝' :
      '❌';
    console.log(`${icon} ${r.slug}`);
    console.log(`   Patrones aplicados: ${r.applied.join(', ')}`);
    if (r.error) console.log(`   ⚠️  ${r.error}`);
  }

  console.log('\n--- RESUMEN ---');
  console.log(`Artículos afectados:          ${totalAffected}`);
  if (!DRY_RUN) {
    console.log(`Patcheados con éxito:         ${totalPatched}`);
    console.log(`Fallos:                       ${totalFailed}`);
  }

  if (DRY_RUN && totalAffected > 0) {
    console.log('\n💡 Para aplicar los cambios reales corré:');
    console.log('   node cleanup-author-method.mjs --execute');
  }
}

main().catch((err) => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});