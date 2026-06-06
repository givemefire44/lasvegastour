#!/usr/bin/env node
/**
 * clean-orphan-comments.mjs
 *
 * Parche: marca como 'noise' los comentarios cuyos videos ya están marcados
 * como noise pero que quedaron sin marcar por bug del script previo.
 */

import Database from 'better-sqlite3';

const DB_PATH = './colosseum-corpus.db';
const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('━'.repeat(70));
console.log(`🧹 LIMPIEZA DE COMENTARIOS HUÉRFANOS — ${EXECUTE ? '🔴 EXECUTE' : '🟢 DRY RUN'}`);
console.log('━'.repeat(70));

// 1. Sacar los video_ids de YouTube que ya están marcados como noise
const noisyVideos = db.prepare(`
  SELECT metadata_json
  FROM corpus_items
  WHERE source = 'youtube'
    AND type = 'video_metadata'
    AND related_topic = 'noise'
`).all();

const noisyVideoIds = new Set();
for (const v of noisyVideos) {
  try {
    const meta = JSON.parse(v.metadata_json || '{}');
    if (meta.video_id) noisyVideoIds.add(meta.video_id);
  } catch {}
}

console.log(`📺 Videos ya marcados como noise: ${noisyVideoIds.size}`);
if (noisyVideoIds.size > 0) {
  console.log('   IDs:', [...noisyVideoIds].join(', '));
}

// 2. Buscar comentarios NO-noise cuyo metadata.video_id esté en la lista
const allComments = db.prepare(`
  SELECT id, metadata_json
  FROM corpus_items
  WHERE source = 'youtube'
    AND type IN ('comment', 'reply')
    AND related_topic = 'colosseum'
`).all();

const orphanIds = [];
for (const c of allComments) {
  try {
    const meta = JSON.parse(c.metadata_json || '{}');
    if (meta.video_id && noisyVideoIds.has(meta.video_id)) {
      orphanIds.push(c.id);
    }
  } catch {}
}

console.log(`💬 Comentarios huérfanos a marcar: ${orphanIds.length}`);

if (EXECUTE && orphanIds.length > 0) {
  const update = db.prepare(`UPDATE corpus_items SET related_topic = 'noise' WHERE id = ?`);
  const updateMany = db.transaction((ids) => {
    for (const id of ids) update.run(id);
  });
  updateMany(orphanIds);
  console.log(`✅ ${orphanIds.length} comentarios marcados como noise`);
} else if (!EXECUTE) {
  console.log('🟢 DRY RUN — agregá --execute para aplicar');
}

// Stats finales
console.log('');
const totalItems = db.prepare(`SELECT COUNT(*) as n FROM corpus_items`).get().n;
const usable = db.prepare(`SELECT COUNT(*) as n FROM corpus_items WHERE related_topic = 'colosseum'`).get().n;
const noise = db.prepare(`SELECT COUNT(*) as n FROM corpus_items WHERE related_topic = 'noise'`).get().n;
console.log(`Total: ${totalItems} | Útiles: ${usable} | Noise: ${noise}`);

const bySrcUsable = db.prepare(`
  SELECT source, COUNT(*) as n FROM corpus_items
  WHERE related_topic = 'colosseum' GROUP BY source ORDER BY n DESC
`).all();
console.log('');
console.log('Items útiles por fuente:');
bySrcUsable.forEach(s => console.log(`   ${s.source.padEnd(12)} | ${String(s.n).padStart(5)}`));

db.close();
