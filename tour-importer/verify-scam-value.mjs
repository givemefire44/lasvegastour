import Database from 'better-sqlite3';
const db = new Database('./colosseum-corpus.db', { readonly: true });
const COLO = "related_topic = 'colosseum'";

console.log('=== SCAM: sentiment de las reviews con tag scam ===');
const scamSent = db.prepare(`
  SELECT sentiment, COUNT(*) as n, ROUND(AVG(rating),2) as avg_rating
  FROM corpus_items
  WHERE ${COLO} AND topic_tags LIKE '%scam%' AND sentiment IS NOT NULL
  GROUP BY sentiment ORDER BY n DESC
`).all();
scamSent.forEach(s => console.log('  ' + s.sentiment + ': ' + s.n + ' reviews, avg rating ' + s.avg_rating));

console.log('\n=== SCAM por fuente ===');
const scamSrc = db.prepare(`
  SELECT source, COUNT(*) as n
  FROM corpus_items
  WHERE ${COLO} AND topic_tags LIKE '%scam%'
  GROUP BY source ORDER BY n DESC
`).all();
scamSrc.forEach(s => console.log('  ' + s.source + ': ' + s.n));

console.log('\n=== 8 ejemplos de reviews con scam (texto real) ===');
const ex = db.prepare(`
  SELECT source, rating, country, substr(text,1,180) as snippet
  FROM corpus_items
  WHERE ${COLO} AND topic_tags LIKE '%scam%' AND text_length > 80
  ORDER BY RANDOM() LIMIT 8
`).all();
ex.forEach((e,i) => console.log('\n  [' + (i+1) + '] ' + e.source + ' / ' + e.rating + 'star / ' + (e.country||'?') + '\n      "' + e.snippet + '..."'));

console.log('\n=== VALUE: sentiment de las reviews con tag value ===');
const valSent = db.prepare(`
  SELECT sentiment, COUNT(*) as n, ROUND(AVG(rating),2) as avg_rating
  FROM corpus_items
  WHERE ${COLO} AND topic_tags LIKE '%value%' AND sentiment IS NOT NULL
  GROUP BY sentiment ORDER BY n DESC
`).all();
valSent.forEach(s => console.log('  ' + s.sentiment + ': ' + s.n + ' reviews, avg rating ' + s.avg_rating));
