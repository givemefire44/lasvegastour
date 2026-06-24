// Lee SOLO metadata del corpus. No escribe. Para confirmar que está poblado.
import Database from 'better-sqlite3';
const db = new Database(process.env.CORPUS_DB || './corpus/products.db', { readonly: true });
const n = db.prepare('SELECT COUNT(*) c FROM products').get().c;
const withPrice = db.prepare('SELECT COUNT(*) c FROM products WHERE price IS NOT NULL').get().c;
console.log(`corpus total: ${n} | con price: ${withPrice}`);
const sample = db.prepare('SELECT product_code, price, rating, review_count, substr(title,1,40) t FROM products ORDER BY review_count DESC LIMIT 8').all();
console.log('\ncode          price    rating  reviews  title');
for (const r of sample) console.log(`${String(r.product_code).padEnd(13)} ${String(r.price??'—').padEnd(8)} ${String(r.rating??'—').padEnd(7)} ${String(r.review_count??'—').padEnd(8)} ${r.t}`);
db.close();
