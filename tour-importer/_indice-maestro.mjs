import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import Database from 'better-sqlite3';
import fs from 'fs';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});
const db = new Database(process.env.CORPUS_DB || './corpus/products.db', { readonly: true });

const codeOf = u => (String(u||'').match(/d\d+-([0-9A-Za-z_]+)/)||[])[1] || null;
const near = (a,b) => a!=null && b!=null && Math.abs(Number(a)-Number(b)) < 0.01;

const tours = await sanity.fetch(
  `*[_type=="post" && defined(getYourGuideUrl)]{
     "slug": slug.current, title, "url": getYourGuideUrl,
     "s_price": tourInfo.price, "s_rating": getYourGuideData.rating, "s_reviews": getYourGuideData.reviewCount
   } | order(slug asc)`
);

const getCorpus = db.prepare('SELECT price, rating, review_count FROM products WHERE product_code = ?');

let solido=0, drift=0, sinCorpus=0, sinCode=0;
const index = [];
const driftRows = [], sinCorpusRows = [], sinCodeRows = [];

for (const t of tours) {
  const code = codeOf(t.url);
  if (!code) { sinCode++; sinCodeRows.push(t.slug); index.push({...t, code:null, estado:'SIN-CODE'}); continue; }
  const c = getCorpus.get(code);
  if (!c) { sinCorpus++; sinCorpusRows.push(`${t.slug} (code ${code})`); index.push({...t, code, estado:'SIN-CORPUS'}); continue; }
  const ok = near(t.s_price, c.price) && near(t.s_rating, c.rating) && Number(t.s_reviews)===Number(c.review_count);
  if (ok) { solido++; index.push({...t, code, c_price:c.price, c_rating:c.rating, c_reviews:c.review_count, estado:'SOLIDO'}); }
  else {
    drift++;
    driftRows.push(`${t.slug}: Sanity ${t.s_price}/${t.s_rating}/${t.s_reviews} | corpus ${c.price}/${c.rating}/${c.review_count}`);
    index.push({...t, code, c_price:c.price, c_rating:c.rating, c_reviews:c.review_count, estado:'DRIFT'});
  }
}

console.log(`=== ÍNDICE MAESTRO — ${tours.length} tours ===`);
console.log(`SÓLIDO (Sanity=corpus):     ${solido}`);
console.log(`DRIFT (difieren):           ${drift}`);
console.log(`SIN-CORPUS (no en Viator):  ${sinCorpus}`);
console.log(`SIN-CODE (url sin code):    ${sinCode}\n`);

console.log('--- DRIFT (primeros 15) ---');
driftRows.slice(0,15).forEach(r => console.log('  '+r));
console.log(`\n--- SIN-CORPUS (${sinCorpus}) ---`);
sinCorpusRows.forEach(r => console.log('  '+r));
if (sinCodeRows.length){ console.log('\n--- SIN-CODE ---'); sinCodeRows.forEach(r=>console.log('  '+r)); }

fs.writeFileSync('_indice-maestro.json', JSON.stringify(index, null, 2), 'utf8');
console.log('\nÍndice completo -> _indice-maestro.json');
db.close();
