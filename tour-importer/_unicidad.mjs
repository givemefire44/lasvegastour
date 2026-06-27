import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const tours = await sanity.fetch(
  `*[_type=="post" && defined(getYourGuideUrl)]{
     "slug": slug.current, title,
     "price": tourInfo.price, "rating": getYourGuideData.rating, "reviews": getYourGuideData.reviewCount }`
);

// cuenta unicidad de una llave
function unicidad(keyFn) {
  const map = new Map();
  for (const t of tours) {
    const k = keyFn(t);
    if (k == null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t.slug);
  }
  let unicos = 0, enColision = 0, gruposColision = 0;
  const ejemplos = [];
  for (const [k, slugs] of map) {
    if (slugs.length === 1) unicos++;
    else { enColision += slugs.length; gruposColision++; if (ejemplos.length<6) ejemplos.push(`${k} -> ${slugs.length} tours`); }
  }
  return { unicos, enColision, gruposColision, ejemplos };
}

const pruebas = {
  'precio solo':            t => t.price != null ? `${t.price}` : null,
  'precio + rating':        t => (t.price!=null && t.rating!=null) ? `${t.price}|${t.rating}` : null,
  'precio + rating + revs': t => (t.price!=null && t.rating!=null && t.reviews!=null) ? `${t.price}|${t.rating}|${t.reviews}` : null,
  'titulo + precio':        t => (t.title && t.price!=null) ? `${t.title.toLowerCase().trim()}|${t.price}` : null,
};

console.log(`=== ÍNDICE DE UNICIDAD — ${tours.length} tours ===\n`);
for (const [nombre, fn] of Object.entries(pruebas)) {
  const r = unicidad(fn);
  console.log(`${nombre}:`);
  console.log(`   únicos: ${r.unicos} | en colisión: ${r.enColision} (en ${r.gruposColision} grupos)`);
  if (r.ejemplos.length) console.log(`   ej colisión: ${r.ejemplos.slice(0,4).join('  //  ')}`);
  console.log('');
}
