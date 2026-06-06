import Database from 'better-sqlite3';
const db = new Database('./colosseum-corpus.db', { readonly: true });
const COLO = "related_topic = 'colosseum'";

console.log('=== Cobertura de variables enriquecidas ===');
const cov = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN sentiment IS NOT NULL THEN 1 ELSE 0 END) as has_sentiment,
    SUM(CASE WHEN pain_points IS NOT NULL AND pain_points != '[]' THEN 1 ELSE 0 END) as has_pain,
    SUM(CASE WHEN topic_tags IS NOT NULL AND topic_tags != '[]' THEN 1 ELSE 0 END) as has_topics,
    SUM(CASE WHEN claims IS NOT NULL AND claims != '[]' THEN 1 ELSE 0 END) as has_claims
  FROM corpus_items WHERE ${COLO}
`).get();
console.log(JSON.stringify(cov, null, 2));

console.log('\n=== Sentiment global (Colosseum) ===');
const sent = db.prepare(`
  SELECT sentiment, COUNT(*) as n
  FROM corpus_items WHERE ${COLO} AND sentiment IS NOT NULL
  GROUP BY sentiment ORDER BY n DESC
`).all();
sent.forEach(s => console.log('  ' + s.sentiment + ': ' + s.n));

console.log('\n=== Top 20 topic_tags mas comunes ===');
const rows = db.prepare(`SELECT topic_tags FROM corpus_items WHERE ${COLO} AND topic_tags IS NOT NULL AND topic_tags != '[]'`).all();
const tagCount = {};
rows.forEach(r => { try { JSON.parse(r.topic_tags).forEach(t => tagCount[t] = (tagCount[t]||0)+1); } catch(e){} });
Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([t,n]) => console.log('  ' + t + ': ' + n));

console.log('\n=== Top 20 pain_points mas comunes ===');
const prows = db.prepare(`SELECT pain_points FROM corpus_items WHERE ${COLO} AND pain_points IS NOT NULL AND pain_points != '[]'`).all();
const painCount = {};
prows.forEach(r => { try { JSON.parse(r.pain_points).forEach(p => { const k = (typeof p === 'string' ? p : JSON.stringify(p)).slice(0,60); painCount[k] = (painCount[k]||0)+1; }); } catch(e){} });
Object.entries(painCount).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([p,n]) => console.log('  [' + n + '] ' + p));
