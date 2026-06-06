import Database from 'better-sqlite3';
const db = new Database('./colosseum-corpus.db', { readonly: true });
const COLO = "related_topic = 'colosseum'";

console.log('=== 12 negativas con scam: que tipo de scam ===');
const neg = db.prepare(`
  SELECT source, rating, country, substr(text,1,220) as snippet
  FROM corpus_items
  WHERE ${COLO} AND topic_tags LIKE '%scam%' AND sentiment = 'neg' AND text_length > 100
  ORDER BY RANDOM() LIMIT 12
`).all();
neg.forEach((e,i) => console.log('\n  [' + (i+1) + '] ' + e.source + ' / ' + e.rating + 'star / ' + (e.country||'?') + '\n      "' + e.snippet + '..."'));

console.log('\n\n=== 6 positivas/neutrales con scam (los que tranquilizan) ===');
const pos = db.prepare(`
  SELECT source, rating, country, substr(text,1,220) as snippet
  FROM corpus_items
  WHERE ${COLO} AND topic_tags LIKE '%scam%' AND sentiment IN ('pos','neu') AND text_length > 100
  ORDER BY RANDOM() LIMIT 6
`).all();
pos.forEach((e,i) => console.log('\n  [' + (i+1) + '] ' + e.source + ' / ' + e.rating + 'star / ' + (e.country||'?') + '\n      "' + e.snippet + '..."'));
