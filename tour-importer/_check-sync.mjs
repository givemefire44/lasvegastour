import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import Database from 'better-sqlite3';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});
const db = new Database(process.env.CORPUS_DB || './corpus/products.db', { readonly: true });

const codeOf = u => (String(u||'').match(/d\d+-([0-9A-Za-z]+)/)||[])[1] || null;
const conejillos = [
  'grand-canyon-helicopter-landing-tour-from-las-vegas',
  'hoover-dam-bridge-walk-boulder-city-historic-tour',
  'valley-of-fire-lost-city-museum-day-trip-vegas',
  'las-vegas-strip-walking-tour-insider-tips-hidden-spots',
];

const rows = await sanity.fetch(
  `*[_type=="post" && slug.current in $w]{
     "slug": slug.current, "url": getYourGuideUrl,
     "s_price": tourInfo.price, "s_rating": getYourGuideData.rating, "s_reviews": getYourGuideData.reviewCount }`,
  { w: conejillos }
);

console.log('slug                                              | SANITY p/r/rev        | CORPUS p/r/rev        | match');
for (const r of rows) {
  const code = codeOf(r.url);
  const c = code ? db.prepare('SELECT price,rating,review_count FROM products WHERE product_code=?').get(code) : null;
  const cp = c ? `${c.price}/${c.rating}/${c.review_count}` : '(no en corpus)';
  const sp = `${r.s_price}/${r.s_rating}/${r.s_reviews}`;
  const ok = c && c.price===r.s_price && c.rating===r.s_rating && c.review_count===r.s_reviews ? 'OK' : 'DRIFT';
  console.log(`${r.slug.padEnd(50)}| ${sp.padEnd(22)}| ${cp.padEnd(22)}| ${ok}`);
}
db.close();
