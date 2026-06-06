#!/usr/bin/env node
/**
 * cleanup-recent-trustpilot.mjs
 *
 * Borra las reviews trustpilot importadas en la última hora.
 * Útil para limpiar antes de re-importar después de arreglar el script.
 */

import Database from 'better-sqlite3';

const db = new Database('./colosseum-corpus.db');

const result = db.prepare(`
  DELETE FROM corpus_items
  WHERE source = 'trustpilot'
    AND fetched_at >= datetime('now', '-1 hour')
`).run();

console.log(`✅ Borradas: ${result.changes} reviews trustpilot recientes`);

const remaining = db.prepare(`SELECT COUNT(*) as n FROM corpus_items WHERE source = 'trustpilot'`).get().n;
console.log(`Quedan en corpus: ${remaining} reviews trustpilot`);

db.close();