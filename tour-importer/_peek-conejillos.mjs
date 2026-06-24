// _peek-conejillos.mjs — throwaway, SOLO LEE de Sanity. No escribe nada.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const def = ['valley-of-fire-lost-city','red-rock-canyon-spring-mountain',
             'upper-antelope-canyon','valley-of-fire-photography','death-valley-vip'];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : def;

const rows = await sanity.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && slug.current in $w]{
     "slug": slug.current, "url": getYourGuideUrl,
     "price": tourInfo.price, "rating": getYourGuideData.rating,
     "reviews": getYourGuideData.reviewCount } | order(slug asc)`,
  { w: wanted }
);

const codeOf = u => (String(u||'').match(/d\d+-([0-9A-Za-z]+)/)||[])[1] || '(no-code)';
console.log('CODE         PRICE    RATING REVIEWS  SLUG');
for (const r of rows)
  console.log(`${codeOf(r.url).padEnd(12)} ${String(r.price??'—').padEnd(8)} ${String(r.rating??'—').padEnd(6)} ${String(r.reviews??'—').padEnd(7)} ${r.slug}`);
console.log(`\n${rows.length} tours.`);
