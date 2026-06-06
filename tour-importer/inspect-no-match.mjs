import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import { createClient } from '@sanity/client';

const OLD_TEXT = 'Claude Sonnet 4.6. Enrichment success rate:';

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

function findRelevantSnippets(content) {
  if (!Array.isArray(content)) return [];

  const snippets = [];
  for (const block of content) {
    if (block?._type !== 'block' || !Array.isArray(block.children)) continue;

    for (const child of block.children) {
      if (child?._type === 'span' && typeof child.text === 'string') {
        const t = child.text;
        // Buscamos cualquier rastro de Claude, Sonnet, Enrichment, o "success rate"
        if (
          /claude|sonnet|enrichment|success rate|processing|linguistic/i.test(t)
        ) {
          snippets.push(t.slice(0, 200));
        }
      }
    }
  }
  return snippets;
}

async function main() {
  console.log('🔍 Inspeccionando artículos Research SIN match exacto...\n');

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

  let noMatchCount = 0;

  for (const article of articles) {
    const contentStr = JSON.stringify(article.content || []);

    if (contentStr.includes(OLD_TEXT)) continue; // ya machea, lo salteamos

    noMatchCount++;
    const snippets = findRelevantSnippets(article.content);

    console.log(`\n📄 ${article.slug}`);
    console.log(`   ${article.title}`);
    if (snippets.length === 0) {
      console.log(`   ⚠️  No se encontró NINGÚN texto relacionado (puede no tener bloque Author and Method)`);
    } else {
      snippets.forEach((s, i) => {
        console.log(`   [${i + 1}] "${s}"`);
      });
    }
  }

  console.log(`\n--- TOTAL ---`);
  console.log(`Artículos Research sin match: ${noMatchCount}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});