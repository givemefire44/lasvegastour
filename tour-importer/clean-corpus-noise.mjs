#!/usr/bin/env node
/**
 * clean-corpus-noise.mjs
 *
 * Identifica items que NO son del Coliseo de Roma real:
 *   - LEGO Colosseum (sets de Lego)
 *   - Pokemon Colosseum (videojuego)
 *   - Fortis Colosseum (videojuego online)
 *   - The Colosseum / Caesars Palace en Las Vegas (venue de música)
 *   - Cualquier "Colosseum" que sea de un videojuego, juguete, marca, etc.
 *
 * Marca esos items con related_topic = 'noise' para excluirlos del análisis
 * sin borrarlos (por si querés revisarlos manualmente después).
 *
 * Uso:
 *   node clean-corpus-noise.mjs              # dry-run (solo muestra qué marcaría)
 *   node clean-corpus-noise.mjs --execute    # marca de verdad
 */

import Database from 'better-sqlite3';

const DB_PATH = './colosseum-corpus.db';
const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ═══════════════════════════════════════════════════════════════════
// PATRONES DE RUIDO
// ═══════════════════════════════════════════════════════════════════
// Palabras que indican que NO es el Coliseo de Roma real
const NOISE_PATTERNS = [
  // Productos LEGO
  { pattern: /\blego\b/i, reason: 'LEGO product' },
  { pattern: /\bbrick(s|set|built)?\b/i, reason: 'Brick toy' },
  { pattern: /\bminifig/i, reason: 'LEGO minifig' },
  { pattern: /\bgwp\b/i, reason: 'LEGO GWP (gift with purchase)' },

  // Videojuegos
  { pattern: /\bpokemon\b/i, reason: 'Pokemon game' },
  { pattern: /\bquiver\b/i, reason: 'Game/sport reference' },
  { pattern: /\bfortis\s+colosseum\b/i, reason: 'Fortis Colosseum game' },
  { pattern: /\bgameplay\b/i, reason: 'Video game' },
  { pattern: /\bspeedrun/i, reason: 'Video game' },
  { pattern: /\bplaythrough\b/i, reason: 'Video game' },
  { pattern: /\bnintendo\b/i, reason: 'Nintendo game' },
  { pattern: /\bvideo\s*game\b/i, reason: 'Video game' },
  { pattern: /\bnpc\b/i, reason: 'Video game NPC' },
  { pattern: /\bboss\s+(fight|battle)/i, reason: 'Video game boss' },
  { pattern: /\branked\s+(match|game|play)/i, reason: 'Video game ranked' },
  { pattern: /\bclash\s+(royale|of)\b/i, reason: 'Mobile game' },

  // Las Vegas / venues musicales
  { pattern: /\bcaesars\s+palace\b/i, reason: 'Las Vegas venue' },
  { pattern: /\blas\s+vegas\b/i, reason: 'Las Vegas (not Rome)' },
  { pattern: /\bresidency\b/i, reason: 'Music residency Vegas' },

  // Música / bandas / álbumes
  { pattern: /\bcolosseum\s+(band|live|tour\s+\d{4})\b/i, reason: 'Music band' },
  { pattern: /\balbum\s+review\b/i, reason: 'Album review' },

  // Películas / series TV / anime
  { pattern: /\banime\b/i, reason: 'Anime' },
  { pattern: /\bmanga\b/i, reason: 'Manga' },
  { pattern: /\bnetflix\b/i, reason: 'Netflix show' },

  // Wrestling / boxeo
  { pattern: /\bwwe\b/i, reason: 'Wrestling' },
  { pattern: /\bwrestling\b/i, reason: 'Wrestling' },
  { pattern: /\bufc\b/i, reason: 'UFC' },
];

// ═══════════════════════════════════════════════════════════════════
// FETCH ITEMS A REVISAR
// ═══════════════════════════════════════════════════════════════════
console.log('━'.repeat(70));
console.log('🧹 LIMPIEZA DE RUIDO EN EL CORPUS');
console.log(`Modo: ${EXECUTE ? '🔴 EXECUTE' : '🟢 DRY RUN'}`);
console.log('━'.repeat(70));

// Para YouTube, revisamos el video_metadata (que tiene title + description)
// Y también los comentarios de esos videos contaminados

// 1. Detectar VIDEOS de YouTube ruidosos (por título + descripción)
const videos = db.prepare(`
  SELECT id, source_id, text, metadata_json
  FROM corpus_items
  WHERE source = 'youtube'
    AND type = 'video_metadata'
    AND (related_topic IS NULL OR related_topic != 'noise')
`).all();

console.log(`📺 Videos a evaluar: ${videos.length}`);

const noisyVideoIds = new Set(); // video_id de YouTube (no row id)
const noisyByReason = {};

for (const v of videos) {
  const text = v.text || '';
  let matched = null;
  for (const { pattern, reason } of NOISE_PATTERNS) {
    if (pattern.test(text)) {
      matched = reason;
      break;
    }
  }
  if (matched) {
    const meta = JSON.parse(v.metadata_json || '{}');
    if (meta.video_id) noisyVideoIds.add(meta.video_id);
    noisyByReason[matched] = (noisyByReason[matched] || 0) + 1;
  }
}

console.log(`🎯 Videos ruidosos detectados: ${noisyVideoIds.size}`);
console.log('');
console.log('   Por categoría:');
Object.entries(noisyByReason)
  .sort((a, b) => b[1] - a[1])
  .forEach(([reason, count]) => {
    console.log(`     ${count.toString().padStart(3)} | ${reason}`);
  });

// 2. Contar comentarios de esos videos ruidosos
let commentsToMark = 0;
if (noisyVideoIds.size > 0) {
  const videoIdList = [...noisyVideoIds];
  // Buscar comentarios cuyo metadata_json contenga uno de esos video_ids
  // Como SQLite no parsea JSON con regex bien, hago LIKE con cada video_id
  const allComments = db.prepare(`
    SELECT id, metadata_json
    FROM corpus_items
    WHERE source = 'youtube'
      AND type IN ('comment', 'reply')
      AND (related_topic IS NULL OR related_topic != 'noise')
  `).all();

  for (const c of allComments) {
    try {
      const meta = JSON.parse(c.metadata_json || '{}');
      if (meta.video_id && noisyVideoIds.has(meta.video_id)) {
        commentsToMark++;
      }
    } catch {}
  }
}
console.log(`💬 Comentarios de videos ruidosos: ${commentsToMark}`);

// 3. También detectar comentarios sueltos cuyo TEXTO contiene patrones obvios de ruido
const directNoiseComments = db.prepare(`
  SELECT id, text
  FROM corpus_items
  WHERE source = 'youtube'
    AND type IN ('comment', 'reply')
    AND (related_topic IS NULL OR related_topic != 'noise')
`).all();

const noisyCommentIds = new Set();
const commentNoiseByReason = {};
for (const c of directNoiseComments) {
  const text = c.text || '';
  for (const { pattern, reason } of NOISE_PATTERNS) {
    if (pattern.test(text)) {
      noisyCommentIds.add(c.id);
      commentNoiseByReason[reason] = (commentNoiseByReason[reason] || 0) + 1;
      break;
    }
  }
}
console.log(`💬 Comentarios sueltos con patrón ruidoso: ${noisyCommentIds.size}`);
if (noisyCommentIds.size > 0) {
  console.log('   Por categoría (top 10):');
  Object.entries(commentNoiseByReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([reason, count]) => {
      console.log(`     ${count.toString().padStart(4)} | ${reason}`);
    });
}

// ═══════════════════════════════════════════════════════════════════
// APLICAR (si --execute)
// ═══════════════════════════════════════════════════════════════════
if (EXECUTE) {
  console.log('');
  console.log('🔴 APLICANDO CAMBIOS...');

  const update = db.prepare(`UPDATE corpus_items SET related_topic = 'noise' WHERE id = ?`);
  const updateMany = db.transaction((ids) => {
    for (const id of ids) update.run(id);
  });

  // Marcar videos ruidosos
  const videoRowIds = videos
    .filter(v => {
      const meta = JSON.parse(v.metadata_json || '{}');
      return meta.video_id && noisyVideoIds.has(meta.video_id);
    })
    .map(v => v.id);
  updateMany(videoRowIds);
  console.log(`   ✅ Videos marcados: ${videoRowIds.length}`);

  // Marcar comentarios de videos ruidosos
  const noisyVideoCommentIds = [];
  for (const c of directNoiseComments) {
    try {
      const meta = JSON.parse(c.metadata_json || '{}');
      if (meta.video_id && noisyVideoIds.has(meta.video_id)) {
        noisyVideoCommentIds.push(c.id);
      }
    } catch {}
  }
  updateMany(noisyVideoCommentIds);
  console.log(`   ✅ Comentarios de videos ruidosos: ${noisyVideoCommentIds.length}`);

  // Marcar comentarios sueltos ruidosos
  updateMany([...noisyCommentIds]);
  console.log(`   ✅ Comentarios sueltos ruidosos: ${noisyCommentIds.size}`);
} else {
  console.log('');
  console.log('🟢 DRY RUN — no se modificó nada. Para aplicar:');
  console.log('   node clean-corpus-noise.mjs --execute');
}

// ═══════════════════════════════════════════════════════════════════
// STATS FINALES
// ═══════════════════════════════════════════════════════════════════
console.log('');
console.log('━'.repeat(70));
console.log('📊 ESTADO DEL CORPUS');
console.log('━'.repeat(70));

const totalItems = db.prepare(`SELECT COUNT(*) as n FROM corpus_items`).get().n;
const usable = db.prepare(`SELECT COUNT(*) as n FROM corpus_items WHERE related_topic = 'colosseum'`).get().n;
const noise = db.prepare(`SELECT COUNT(*) as n FROM corpus_items WHERE related_topic = 'noise'`).get().n;

console.log(`Total items:          ${totalItems}`);
console.log(`Marcados 'colosseum': ${usable}`);
console.log(`Marcados 'noise':     ${noise}`);

const bySrcUsable = db.prepare(`
  SELECT source, COUNT(*) as n
  FROM corpus_items
  WHERE related_topic = 'colosseum'
  GROUP BY source
  ORDER BY n DESC
`).all();
console.log('');
console.log('Items útiles por fuente:');
bySrcUsable.forEach(s => {
  console.log(`   ${s.source.padEnd(12)} | ${String(s.n).padStart(5)} items`);
});

db.close();
console.log('');