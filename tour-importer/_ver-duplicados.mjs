import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

// traemos TODO (incluido drafts) para ver duplicados reales
const tours = await sanity.fetch(
  `*[_type=="post" && defined(getYourGuideUrl)]{
     _id, _createdAt, _updatedAt, "slug": slug.current, title,
     "price": tourInfo.price, "rating": getYourGuideData.rating, "reviews": getYourGuideData.reviewCount }`
);

// agrupar por precio+rating+reviews
const map = new Map();
for (const t of tours) {
  if (t.price==null||t.rating==null||t.reviews==null) continue;
  const k = `${t.price}|${t.rating}|${t.reviews}`;
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(t);
}

console.log('=== PARES EN COLISIÓN (mismo precio|rating|reviews) ===\n');
for (const [k, arr] of map) {
  if (arr.length < 2) continue;
  console.log(`### ${k}  (${arr.length} docs)`);
  for (const t of arr) {
    const tipo = t._id.startsWith('drafts.') ? 'DRAFT' : 'PUBLISHED';
    console.log(`   [${tipo}] _id: ${t._id}`);
    console.log(`            slug: ${t.slug}`);
    console.log(`            title: ${t.title}`);
    console.log(`            creado: ${t._createdAt?.slice(0,10)} | actualizado: ${t._updatedAt?.slice(0,10)}`);
  }
  // ¿mismo slug o distinto?
  const slugs = new Set(arr.map(t=>t.slug));
  console.log(`   -> ${slugs.size===1 ? 'MISMO SLUG (duplicado real)' : 'SLUGS DISTINTOS (revisar: ¿tours distintos o clones?)'}\n`);
}
