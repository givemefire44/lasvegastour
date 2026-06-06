// set-category.mjs
// Asigna la categoría "Vatican tours" a TODOS los posts que no tengan categoría.
// Uso:
//   node set-category.mjs            -> DRY RUN (solo muestra, no toca nada)
//   node set-category.mjs --execute  -> aplica los cambios
import { createClient } from '@sanity/client';
import { config } from './config.js';

const TOUR_CATEGORY = { title: 'Vatican tours', slug: 'vatican-tours' };
const EXECUTE = process.argv.includes('--execute');

const client = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn: false
});

async function getOrCreateCategory() {
  const existing = await client.fetch(
    `*[_type == "category" && (slug.current == $slug || title == $title)][0]{_id}`,
    { slug: TOUR_CATEGORY.slug, title: TOUR_CATEGORY.title }
  );
  if (existing && existing._id) {
    console.log(`🏷️  Categoría encontrada: ${TOUR_CATEGORY.title} (${existing._id})`);
    return { _type: 'reference', _ref: existing._id };
  }
  if (!EXECUTE) {
    console.log(`🏷️  Categoría "${TOUR_CATEGORY.title}" NO existe — se crearía al correr con --execute`);
    return null;
  }
  const created = await client.create({
    _type: 'category',
    title: TOUR_CATEGORY.title,
    slug: { _type: 'slug', current: TOUR_CATEGORY.slug }
  });
  console.log(`🏷️  Categoría creada: ${TOUR_CATEGORY.title} (${created._id})`);
  return { _type: 'reference', _ref: created._id };
}

(async () => {
  console.log(EXECUTE ? '🚀 MODO EXECUTE\n' : '🔶 DRY RUN (usá --execute para aplicar)\n');

  const cat = await getOrCreateCategory();

  const posts = await client.fetch(`*[_type == "post" && !defined(category)]{_id, title}`);
  console.log(`\nPosts SIN categoría: ${posts.length}`);

  if (posts.length === 0) {
    console.log('Nada para hacer.');
    return;
  }

  if (!EXECUTE) {
    posts.slice(0, 15).forEach((p, i) => console.log(`   ${i + 1}. ${p.title}`));
    if (posts.length > 15) console.log(`   ... y ${posts.length - 15} más`);
    console.log('\n(DRY RUN — no se aplicó nada. Corré con --execute para asignar.)');
    return;
  }

  let n = 0;
  for (const p of posts) {
    await client.patch(p._id).set({ category: cat }).commit();
    n++;
    console.log(`   [${n}/${posts.length}] ${p.title}`);
  }
  console.log(`\n✅ Listo: ${n} posts categorizados como "${TOUR_CATEGORY.title}".`);
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
