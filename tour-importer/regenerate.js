// regenerate.js - Orquestador: corre la bateria completa de injectors corpus-grounded
// sobre UN tour o el catalogo, en orden. Cada injector se alimenta del corpus (factsheet-source)
// y patchea su propia seccion; al correrlos en secuencia, el body se regenera entero.
//
// CLI:
//   node regenerate.js --slug=<slug> --dry-run         # un tour, preview sin tocar Sanity
//   node regenerate.js --slug=<slug> --execute         # un tour, SUBE a Sanity
//   node regenerate.js --all --limit=20 --dry-run      # primeros 20 del catalogo, preview
//   node regenerate.js --all --execute                 # catalogo entero, SUBE (¡9 llamadas/tour!)
//   node regenerate.js --slug=<slug> --only=faqs,practical-info --dry-run
//
// Seguro por defecto: sin --execute es DRY RUN (no escribe nada en Sanity).
// Reanudable (regenerate-done.json). En --all saltea los slugs muertos de ingest-corpus-errors.json.
// Tolerante a saturacion de la API: reintenta con backoff y NO marca un tour como hecho si fallo.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { injectQuickAnswerForSlug } from './inject-quick-answer.js';
import { injectWhyBookThisForSlug } from './inject-why-book-this.js';
import { injectExperienceForSlug } from './inject-experience.js';
import { injectWorthItForSlug } from './inject-worth-it.js';
import { injectFaqsForSlug } from './inject-faqs.js';
import { injectPracticalInfoForSlug } from './inject-practical-info.js';
import { injectSectionForSlug, fetchSectionSlugs } from './inject-extras.js';
import { injectAtAGlanceForSlug } from './inject-at-a-glance.js';
import { boldKeyDataForSlug } from './bold-key-data.js';


// REEMPLAZAR POR:
// at-a-glance: tabla deterministica (sin modelo). Va al final del battery: se re-inserta despues
// de que quick-answer reescribio el Quick Answer, asi no se la come ningun reemplazo de seccion.
async function atAGlanceStep(slug, opts) {
    const r = await injectAtAGlanceForSlug(slug, opts);
    if (!r.ok) return r;
    const sectionMd = (r.block?.title || 'At a Glance') + '\n' + r.rows.map(([l, v]) => `- ${l}: ${v}`).join('\n');
    return { ok: true, origin: 'corpus', rewritten: false, residualViolations: [], existed: false, sectionMd };
  }

// bold: negritas estructurales (precio/duracion en QA, tipo-de-viajero en Best For, horarios en Itinerary).
async function boldStep(slug, opts) {
    const r = await boldKeyDataForSlug(slug, opts);
    if (!r.ok) return r;
    return { ok: true, origin: 'corpus', rewritten: false, residualViolations: [], existed: false,
             sectionMd: `bold -> QA:${r.counts.quickAnswer} BestFor:${r.counts.bestFor} Itin:${r.counts.itinerary}` };
  }


// Orden de regeneracion. Cada injector re-fetchea el body y patchea su seccion, asi que componen bien.
const STEPS = [
  ['quick-answer',   (s, o) => injectQuickAnswerForSlug(s, o)],
  ['why-book',       (s, o) => injectWhyBookThisForSlug(s, o)],
  ['experience',     (s, o) => injectExperienceForSlug(s, o)],
  ['worth-it',       (s, o) => injectWorthItForSlug(s, o)],
  ['faqs',           (s, o) => injectFaqsForSlug(s, o)],
  ['practical-info', (s, o) => injectPracticalInfoForSlug(s, o)],
 
  ['insider-tip',    (s, o) => injectSectionForSlug(s, 'insider-tip', o)],
  ['at-a-glance',    (s, o) => atAGlanceStep(s, o)],
  ['bold',           (s, o) => boldStep(s, o)],
];

const DONE_FILE = './regenerate-done.json';
const ERRORS_FILE = './ingest-corpus-errors.json';

function loadJson(p, fallback) {
  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : fallback; } catch { return fallback; }
}

// Reintenta una seccion si la API esta saturada (rate limit / overloaded), con espera creciente.
// Otros errores se propagan tal cual (se marcan como threw).
async function callWithRetry(fn, slug, opts, maxRetries = 5) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(slug, opts);
    } catch (e) {
      const msg = String(e?.message || e || '');
      const isRate = /429|rate.?limit|overloaded|server_overloaded|529|too many requests/i.test(msg);
      if (isRate && attempt < maxRetries) {
        const wait = Math.min(60000, 3000 * Math.pow(2, attempt)); // 3s, 6s, 12s, 24s, 48s, (cap 60s)
        console.log(`   API saturada en "${slug}" - espero ${Math.round(wait / 1000)}s y reintento (intento ${attempt + 1}/${maxRetries})`);
        await new Promise(res => setTimeout(res, wait));
        continue;
      }
      throw e;
    }
  }
}

// Clasifica el motivo de un fallo para mostrarlo claro en el log.
function classifyError(msg) {
  const m = String(msg || '').toLowerCase();
  if (/credit|balance|billing|payment|insufficient|quota|plan|saldo/.test(m)) return 'SIN SALDO / billing';
  if (/429|rate.?limit|overloaded|server_overloaded|529|too many requests/.test(m)) return 'API saturada';
  if (/timeout|etimedout|econnreset|socket|network|fetch failed/.test(m)) return 'red / timeout';
  return 'otro error';
}

async function regenerateSlug(slug, steps, { dryRun }) {
  const results = [];
  for (const [name, fn] of steps) {
    try {
      const r = await callWithRetry(fn, slug, { dryRun });
      results.push({ name, ...r });
    } catch (e) {
      results.push({ name, ok: false, reason: 'threw', error: e.message });
    }
    await new Promise(res => setTimeout(res, 600)); // respiro entre llamadas al modelo
  }
  return results;
}

// Expone la bateria completa (STEPS, incluye at-a-glance) para reusarla al crear un tour nuevo.
export async function runBatteryForSlug(slug, { dryRun = false } = {}) {
    return regenerateSlug(slug, STEPS, { dryRun });
  }

function summarize(slug, results) {
  const parts = results.map(r => {
    if (!r.ok) return `${r.name}:skip(${r.reason})`;
    const flags = (r.residualViolations && r.residualViolations.length) ? '!' : '';
    const rw = r.rewritten ? 'rw' : '';
    return `${r.name}:${r.origin || '?'}${rw ? '/' + rw : ''}${flags}`;
  });
  return `${slug}\n   ${parts.join('  ')}`;
}

function toPreview(slug, results) {
  let md = `\n\n==================================================\nREGENERATED: ${slug}\n==================================================\n`;
  for (const r of results) {
    if (r.ok && r.sectionMd) {
      const flag = (r.residualViolations && r.residualViolations.length) ? `  ! ${r.residualViolations.join(', ')}` : '';
      md += `\n--- ${r.name} (origin: ${r.origin}, rewritten: ${r.rewritten})${flag} ---\n${r.sectionMd}\n`;
    } else if (!r.ok) {
      md += `\n--- ${r.name}: SKIP (${r.reason}${r.error ? ': ' + r.error : ''}) ---\n`;
    }
  }
  return md;
}

async function main() {
  const args = process.argv.slice(2);
  const ONE_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null;
  const ALL = args.includes('--all');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
  const DRY_RUN = !args.includes('--execute');
  const ONLY = (args.find(a => a.startsWith('--only='))?.split('=')[1] || '').split(',').map(s => s.trim()).filter(Boolean);

  const steps = ONLY.length ? STEPS.filter(([n]) => ONLY.includes(n)) : STEPS;
  if (!steps.length) { console.error(`--only no coincide con ninguna seccion. Opciones: ${STEPS.map(s => s[0]).join(', ')}`); process.exit(1); }

  if (!ONE_SLUG && !ALL) {
    console.error('Usá --slug=<slug> o --all. Sin --execute es DRY RUN.');
    process.exit(1);
  }

  // Resolver slugs
  let slugs;
  if (ONE_SLUG) {
    slugs = [ONE_SLUG];
  } else {
    slugs = await fetchSectionSlugs({ limit: LIMIT });
    const dead = new Set((loadJson(ERRORS_FILE, []) || []).map(e => e.slug).filter(Boolean));
    const done = new Set(loadJson(DONE_FILE, []));
    const before = slugs.length;
    slugs = slugs.filter(s => !dead.has(s) && !(DRY_RUN ? false : done.has(s)));
    if (before !== slugs.length) console.log(`(salteados: ${[...dead].length} muertos${DRY_RUN ? '' : ` + ${done.size} ya hechos`})`);
  }

  console.log(`\nREGENERATE  |  ${slugs.length} tour(s)  |  ${steps.length} secciones/tour  |  ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION (escribe Sanity)'}`);
  console.log(`secciones: ${steps.map(s => s[0]).join(', ')}`);
  if (!DRY_RUN && ALL) console.log(`hasta ${slugs.length * steps.length} llamadas al modelo. Ctrl+C para abortar; es reanudable.`);
  console.log('');

  const done = loadJson(DONE_FILE, []);
  let preview = '', okCount = 0, errCount = 0, failCount = 0;
  for (const slug of slugs) {
    try {
      const results = await regenerateSlug(slug, steps, { dryRun: DRY_RUN });
      console.log(summarize(slug, results));
      if (DRY_RUN) {
        preview += toPreview(slug, results);
        okCount++;
      } else {
        const hadThrow = results.some(r => !r.ok && r.reason === 'threw');
        if (hadThrow) {
          // No se marca como hecho: quedo a medias y se reintentara en la proxima corrida.
          const firstErr = results.find(r => !r.ok && r.reason === 'threw');
          const motivo = classifyError(firstErr?.error);
          console.log(`   "${slug}" INCOMPLETO [motivo: ${motivo}] - NO se marca como hecho, se reintentara.`);
          console.log(`      detalle: ${firstErr?.error || 'sin detalle'}`);
          failCount++;
        } else {
          if (!done.includes(slug)) { done.push(slug); fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 2)); }
          okCount++;
        }
        await new Promise(res => setTimeout(res, 1200));
      }
    } catch (e) {
      console.error(`ERROR ${slug}: ${e.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    const file = ONE_SLUG ? `./regenerate-${ONE_SLUG}-preview.md` : './regenerate-preview.md';
    fs.writeFileSync(file, preview.trim() + '\n');
    console.log(`\nPreview -> ${file}  (tours: ${okCount}, errores: ${errCount})  - NADA escrito en Sanity`);
  } else {
    console.log(`\nDone. OK: ${okCount}, incompletos (se reintentan): ${failCount}, errores: ${errCount}, total done: ${done.length}`);
    if (failCount > 0) console.log(`Quedaron ${failCount} tour(s) incompletos. Volve a correr el mismo comando para reintentarlos (los OK se saltean solos).`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
