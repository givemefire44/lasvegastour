import Database from 'better-sqlite3';
const db = new Database('./colosseum-corpus.db', { readonly: true });
const COLO = "related_topic = 'colosseum'";

console.log('=== VALUE POSITIVAS: que tipo de tour las genera (topic_tags co-ocurrentes) ===');
const posRows = db.prepare(`SELECT topic_tags FROM corpus_items WHERE ${COLO} AND topic_tags LIKE '%value%' AND sentiment='pos' AND topic_tags IS NOT NULL`).all();
const posTags = {};
posRows.forEach(r => { try { JSON.parse(r.topic_tags).forEach(t => { if(t!=='value') posTags[t]=(posTags[t]||0)+1; }); } catch(e){} });
Object.entries(posTags).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([t,n]) => console.log('  ' + t + ': ' + n));

console.log('\n=== VALUE NEGATIVAS: que tipo de tour las genera ===');
const negRows = db.prepare(`SELECT topic_tags FROM corpus_items WHERE ${COLO} AND topic_tags LIKE '%value%' AND sentiment='neg' AND topic_tags IS NOT NULL`).all();
const negTags = {};
negRows.forEach(r => { try { JSON.parse(r.topic_tags).forEach(t => { if(t!=='value') negTags[t]=(negTags[t]||0)+1; }); } catch(e){} });
Object.entries(negTags).sort((a,b)=>b[1]-a[1]).slice(0,12).forEach(([t,n]) => console.log('  ' + t + ': ' + n));

console.log('\n=== 6 VALUE POSITIVAS (texto real) ===');
const posEx = db.prepare(`SELECT source, rating, country, substr(text,1,200) as s FROM corpus_items WHERE ${COLO} AND topic_tags LIKE '%value%' AND sentiment='pos' AND text_length>100 ORDER BY RANDOM() LIMIT 6`).all();
posEx.forEach((e,i) => console.log('\n  [' + (i+1) + '] ' + e.source + '/' + e.rating + 'star/' + (e.country||'?') + '\n      "' + e.s + '..."'));

console.log('\n=== 6 VALUE NEGATIVAS (texto real) ===');
const negEx = db.prepare(`SELECT source, rating, country, substr(text,1,200) as s FROM corpus_items WHERE ${COLO} AND topic_tags LIKE '%value%' AND sentiment='neg' AND text_length>100 ORDER BY RANDOM() LIMIT 6`).all();
negEx.forEach((e,i) => console.log('\n  [' + (i+1) + '] ' + e.source + '/' + e.rating + 'star/' + (e.country||'?') + '\n      "' + e.s + '..."'));
