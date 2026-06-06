#!/usr/bin/env node
/**
 * import-youtube.mjs
 *
 * Ingesta YouTube al corpus del Coliseo:
 *  - Busca videos por múltiples queries
 *  - Extrae los top videos por relevancia
 *  - Para cada video: trae comentarios públicos
 *  - Guarda todo en corpus_items con source='youtube'
 *
 * Uso:
 *   node import-youtube.mjs              # Modo normal
 *   node import-youtube.mjs --max=20     # Máximo 20 videos por query (default 10)
 *
 * Requiere: YOUTUBE_API_KEY en .env.local
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

import Database from 'better-sqlite3';
import crypto from 'crypto';

const DB_PATH = './colosseum-corpus.db';
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error('❌ Falta YOUTUBE_API_KEY en .env.local');
  console.error('   Agregá esta línea al archivo .env.local:');
  console.error('   YOUTUBE_API_KEY=tu_clave_acá');
  process.exit(1);
}

const args = process.argv.slice(2);
const maxArg = args.find(a => a.startsWith('--max='));
const MAX_VIDEOS_PER_QUERY = maxArg ? parseInt(maxArg.split('=')[1]) : 10;
const MAX_COMMENTS_PER_VIDEO = 100;

// ═══════════════════════════════════════════════════════════════════
// QUERIES — múltiples ángulos para cubrir todo el campo
// ═══════════════════════════════════════════════════════════════════
const QUERIES = [
  'Colosseum tour review',
  'Colosseum underground tour',
  'Colosseum Rome tips',
  'Colosseum tickets guide',
  'Colosseum arena floor',
  'Colosseum vs Vatican',
  'Rome Colosseum mistakes',
  'Colosseum what to know before',
  'Colosseum guided tour worth it',
  'Colosseum scam',
  'Colosseum night tour',
  'Colosseum skip the line',
  'Colosseum disappointed',
  'Colosseum first time',
  'Colosseum private tour',
];

// ═══════════════════════════════════════════════════════════════════
// DB
// ═══════════════════════════════════════════════════════════════════
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO corpus_items (
    source, source_url, source_id, type,
    text, text_length, language,
    rating, country, author_handle, votes,
    published_date, parent_id,
    related_topic, metadata_json,
    fetched_at
  ) VALUES (
    @source, @source_url, @source_id, @type,
    @text, @text_length, @language,
    @rating, @country, @author_handle, @votes,
    @published_date, @parent_id,
    @related_topic, @metadata_json,
    datetime('now')
  )
`);

// Iniciar run
const runResult = db.prepare(`
  INSERT INTO scrape_runs (source, notes, status)
  VALUES ('youtube', ?, 'running')
`).run(`Ingesta YouTube — ${QUERIES.length} queries × ${MAX_VIDEOS_PER_QUERY} videos`);
const runId = runResult.lastInsertRowid;

let totalAdded = 0;
let totalSkipped = 0;
let totalFailed = 0;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ytApi(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set('key', API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const r = await fetch(url.toString());
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`YouTube API ${r.status}: ${errText.slice(0, 200)}`);
  }
  return await r.json();
}

async function searchVideos(query, max) {
  const data = await ytApi('search', {
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: Math.min(max, 50),
    relevanceLanguage: 'en',
    order: 'relevance',
    videoDuration: 'any',
  });
  return (data.items || []).map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description || '',
  }));
}

async function fetchComments(videoId, max) {
  const comments = [];
  let pageToken = null;
  while (comments.length < max) {
    const params = {
      part: 'snippet,replies',
      videoId,
      maxResults: 100,
      order: 'relevance',
      textFormat: 'plainText',
    };
    if (pageToken) params.pageToken = pageToken;
    let data;
    try {
      data = await ytApi('commentThreads', params);
    } catch (e) {
      // Comments disabled or other error — skip
      break;
    }
    for (const item of data.items || []) {
      const top = item.snippet.topLevelComment.snippet;
      comments.push({
        commentId: item.snippet.topLevelComment.id,
        text: top.textDisplay || '',
        author: top.authorDisplayName || null,
        likes: top.likeCount || 0,
        publishedAt: top.publishedAt || null,
        parentId: null,
      });
      // Replies
      if (item.replies?.comments) {
        for (const reply of item.replies.comments) {
          comments.push({
            commentId: reply.id,
            text: reply.snippet.textDisplay || '',
            author: reply.snippet.authorDisplayName || null,
            likes: reply.snippet.likeCount || 0,
            publishedAt: reply.snippet.publishedAt || null,
            parentId: item.snippet.topLevelComment.id,
          });
        }
      }
      if (comments.length >= max) break;
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
    await sleep(200);
  }
  return comments.slice(0, max);
}

function ymd(iso) {
  if (!iso) return null;
  return iso.split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log('━'.repeat(70));
  console.log('🎥 INGESTA YOUTUBE — CORPUS COLISEO');
  console.log('━'.repeat(70));
  console.log(`Queries: ${QUERIES.length}`);
  console.log(`Videos por query: ${MAX_VIDEOS_PER_QUERY}`);
  console.log(`Comentarios máx por video: ${MAX_COMMENTS_PER_VIDEO}`);
  console.log('');

  const seenVideoIds = new Set();
  const allVideos = [];

  // FASE 1 — Search videos
  console.log('🔍 FASE 1: Buscando videos...');
  for (let i = 0; i < QUERIES.length; i++) {
    const q = QUERIES[i];
    process.stdout.write(`   [${i + 1}/${QUERIES.length}] "${q}" ... `);
    try {
      const vids = await searchVideos(q, MAX_VIDEOS_PER_QUERY);
      let nuevos = 0;
      for (const v of vids) {
        if (!seenVideoIds.has(v.videoId)) {
          seenVideoIds.add(v.videoId);
          allVideos.push({ ...v, foundByQuery: q });
          nuevos++;
        }
      }
      console.log(`${vids.length} encontrados (${nuevos} nuevos)`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
      totalFailed++;
    }
    await sleep(300);
  }

  console.log('');
  console.log(`📦 Total videos únicos: ${allVideos.length}`);
  console.log('');

  // FASE 2 — Fetch comentarios por video
  console.log('💬 FASE 2: Extrayendo comentarios...');
  for (let i = 0; i < allVideos.length; i++) {
    const video = allVideos[i];
    process.stdout.write(`   [${i + 1}/${allVideos.length}] ${video.title.slice(0, 55).padEnd(55)} `);
    try {
      const comments = await fetchComments(video.videoId, MAX_COMMENTS_PER_VIDEO);
      // Insertar el video como un item tipo "video_metadata"
      const videoSourceId = `yt_video_${video.videoId}`;
      const videoText = `${video.title}\n\n${video.description}`.trim();
      const videoMeta = {
        video_id: video.videoId,
        channel_title: video.channelTitle,
        found_by_query: video.foundByQuery,
        comments_extracted: comments.length,
      };
      const vRes = insertStmt.run({
        source: 'youtube',
        source_url: `https://www.youtube.com/watch?v=${video.videoId}`,
        source_id: videoSourceId,
        type: 'video_metadata',
        text: videoText,
        text_length: videoText.length,
        language: 'en',
        rating: null,
        country: null,
        author_handle: video.channelTitle,
        votes: null,
        published_date: ymd(video.publishedAt),
        parent_id: null,
        related_topic: 'colosseum',
        metadata_json: JSON.stringify(videoMeta),
      });
      if (vRes.changes > 0) totalAdded++; else totalSkipped++;

      // Insertar comentarios
      let added = 0;
      for (const c of comments) {
        const sourceId = `yt_comment_${c.commentId}`;
        const text = (c.text || '').trim();
        if (!text || text.length < 5) {
          totalSkipped++;
          continue;
        }
        const meta = {
          video_id: video.videoId,
          video_title: video.title,
          channel: video.channelTitle,
          parent_comment_id: c.parentId,
        };
        const res = insertStmt.run({
          source: 'youtube',
          source_url: `https://www.youtube.com/watch?v=${video.videoId}&lc=${c.commentId}`,
          source_id: sourceId,
          type: c.parentId ? 'reply' : 'comment',
          text: text,
          text_length: text.length,
          language: 'en',
          rating: null,
          country: null,
          author_handle: c.author,
          votes: c.likes || 0,
          published_date: ymd(c.publishedAt),
          parent_id: null, // Reddit-style threading después si lo necesitamos
          related_topic: 'colosseum',
          metadata_json: JSON.stringify(meta),
        });
        if (res.changes > 0) {
          added++;
          totalAdded++;
        } else {
          totalSkipped++;
        }
      }
      console.log(`✅ ${added} comentarios`);
    } catch (e) {
      console.log(`❌ ${e.message.slice(0, 50)}`);
      totalFailed++;
    }
    await sleep(300);
  }

  // Cerrar run
  db.prepare(`
    UPDATE scrape_runs
    SET finished_at = datetime('now'),
        items_added = ?,
        items_skipped = ?,
        items_failed = ?,
        status = ?
    WHERE id = ?
  `).run(totalAdded, totalSkipped, totalFailed, totalFailed > totalAdded / 2 ? 'partial' : 'success', runId);

  // Stats
  const totalInDb = db.prepare(`SELECT COUNT(*) as n FROM corpus_items`).get().n;
  const stats = db.prepare(`SELECT * FROM v_stats_by_source`).all();

  db.close();

  console.log('');
  console.log('━'.repeat(70));
  console.log('✅ INGESTA YOUTUBE TERMINADA');
  console.log('━'.repeat(70));
  console.log(`Items agregados: ${totalAdded}`);
  console.log(`Items skip: ${totalSkipped}`);
  console.log(`Errores: ${totalFailed}`);
  console.log(`Total en corpus_items: ${totalInDb}`);
  console.log('');
  console.log('📊 Stats por fuente:');
  stats.forEach(s => {
    console.log(`   ${s.source.padEnd(12)} | ${String(s.total_items).padStart(5)} items | avg rating: ${s.avg_rating?.toFixed(2) || 'N/A'}`);
  });
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});