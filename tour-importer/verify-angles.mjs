import Database from 'better-sqlite3';
const db = new Database('./colosseum-corpus.db', { readonly: true });

console.log('=== ANGULO 3: rating por mes (calor) ===');
const byMonth = db.prepare(`
  SELECT substr(published_date,6,2) as month,
         COUNT(*) as reviews,
         ROUND(AVG(rating),2) as avg_rating
  FROM corpus_items
  WHERE rating IS NOT NULL AND published_date IS NOT NULL
    AND related_topic = 'colosseum'
  GROUP BY month ORDER BY month
`).all();
byMonth.forEach(r => console.log('  Mes ' + r.month + ': ' + r.reviews + ' reviews, avg ' + r.avg_rating));

console.log('\n=== ANGULO 1: cuantos items tienen metadata con tour_price/rating ===');
const withMeta = db.prepare(`
  SELECT COUNT(*) as total
  FROM corpus_items
  WHERE metadata_json LIKE '%tour_total_rating%'
    AND related_topic = 'colosseum'
`).get();
console.log('  Items con tour rating en metadata: ' + withMeta.total);

console.log('\n=== Cuantos items son colosseum vs otros ===');
const topics = db.prepare(`
  SELECT related_topic, COUNT(*) as n
  FROM corpus_items GROUP BY related_topic ORDER BY n DESC
`).all();
topics.forEach(t => console.log('  ' + (t.related_topic || 'NULL') + ': ' + t.n));
