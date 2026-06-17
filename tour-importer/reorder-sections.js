// reorder-sections.js - Reordena las secciones del body al ORDEN CANONICO de tours
// y elimina las huerfanas (The Itinerary, What You'll See, Tour Format, Best For).
// NO usa AI: fetch -> reordena en memoria -> patch. Migracion estructural one-time,
// idempotente (si ya esta en orden y sin huerfanas, no escribe). Se corre DESPUES del backfill.
//
// Tour at a Glance es un bloque simpleTable (no un h3): se reancla en la posicion #2.
// Compare se filtra en el front (no esta en el body) -> no participa del reorden.
// FAQs y Editorial los renderiza el front -> tampoco estan en el body.
//
// CLI:
//   node reorder-sections.js --slug=<slug> --dry-run        # uno, preview (no escribe)
//   node reorder-sections.js --slug=<slug> --execute        # uno, escribe Sanity
//   node reorder-sections.js --slugs=a,b,c --dry-run        # varios
//   node reorder-sections.js --all --dry-run                # catalogo, preview
//   node reorder-sections.js --all --execute                # catalogo, escribe
//
// Seguro por defecto: sin --execute es DRY RUN. Preview -> reorder-sections-preview.md

import { createClient } from '@sanity/client';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchSectionSlugs } from './inject-extras.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = b => (b.children || []).map(c => c.text || '').join('');
const isGlanceTable = b => b && b._type === 'simpleTable' && /at a glance/i.test(b.title || '');

// Huerfanas a ELIMINAR (si el heading incluye alguno de estos patrones).
const ORPHANS = [/the itinerary/i, /what you'?ll see/i, /tour format/i, /best for/i];

// Identificacion de secciones por su heading. El array se evalua EN ORDEN:
// 'not-included' va antes que 'included' (mas especifico) para no robarselo.
const MATCHERS = [
  { key: 'quick-answer', test: h => /quick answer/i.test(h) },
  { key: 'at-a-glance',  test: h => /at a glance/i.test(h) },
  { key: 'why-book',     test: h => /why people book/i.test(h) },
  { key: 'experience',   test: h => /the experience/i.test(h) },
  { key: 'worth-it',     test: h => /worth it/i.test(h) },
  { key: 'not-included', test: h => /not\s+included/i.test(h) },
  { key: 'included',     test: h => /included/i.test(h) },
  { key: 'practical',    test: h => /practical info/i.test(h) },
  { key: 'insider-tip',  test: h => /insider tip/i.test(h) },
];

// Orden final de salida (las que el body controla; FAQs/Compare/Editorial viven en el front).
const ORDER = ['quick-answer', 'at-a-glance', 'why-book', 'experience', 'worth-it', 'included', 'not-included', 'practical', 'insider-tip'];

function classifyHeading(h) {
  if (ORPHANS.some(re => re.test(h))) return '__orphan__';
  for (const m of MATCHERS) if (m.test(h)) return m.key;
  return null; // desconocida -> se preserva al final, nunca se pierde
}

// Orden de secciones tal como aparece hoy (para el preview before/after).
function sectionOrder(body) {
  const ord = [];
  for (const b of (body || [])) {
    if (isGlanceTable(b)) { if (ord[ord.length - 1] !== 'at-a-glance') ord.push('at-a-glance'); continue; }
    if (!isHeading(b)) continue;
    const k = classifyHeading(headingText(b));
    if (k === '__orphan__') ord.push(`(${headingText(b).trim()})`);  // huerfana, marcada
    else if (k) ord.push(k);
    else ord.push('?' + headingText(b).trim().slice(0, 20));          // desconocida
  }
  return ord;
}

function reorderBody(body) {
  const src = [...(body || [])];

  // 1. Sacar los simpleTable "at a glance" a un buffer (van a la seccion at-a-glance).
  const glanceTables = [];
  const rest = [];
  for (const b of src) (isGlanceTable(b) ? glanceTables : rest).push(b);

  // 2. Particionar `rest` por headings: intro (antes del 1er heading) + secciones.
  const intro = [];
  const sections = [];
  let cur = null;
  for (const b of rest) {
    if (isHeading(b)) {
      cur = { key: classifyHeading(headingText(b)), heading: headingText(b).trim(), blocks: [b] };
      sections.push(cur);
    } else if (cur) {
      cur.blocks.push(b);
    } else {
      intro.push(b);
    }
  }

  // 3. Agrupar por key. Eliminar huerfanas. Preservar desconocidas al final.
  const byKey = {};
  const unknown = [];
  const removedOrphans = [];
  const unknownHeadings = [];
  for (const s of sections) {
    if (s.key === '__orphan__') { removedOrphans.push(s.heading); continue; }
    if (s.key === null) { unknown.push(...s.blocks); unknownHeadings.push(s.heading); continue; }
    byKey[s.key] = byKey[s.key] ? [...byKey[s.key], ...s.blocks] : [...s.blocks];
  }
  // los simpleTable de glance se suman a la seccion at-a-glance
  if (glanceTables.length) byKey['at-a-glance'] = [...(byKey['at-a-glance'] || []), ...glanceTables];

  // 4. Ensamblar en orden canonico. Desconocidas al final (no se pierden).
  const out = [...intro];
  for (const key of ORDER) if (byKey[key]) out.push(...byKey[key]);
  out.push(...unknown);

  return { out, removedOrphans, unknownHeadings };
}

async function reorderForSlug(slug, { dryRun }) {
  const tour = await sanity.fetch(
    `*[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0]{ _id, body }`,
    { slug }
  );
  if (!tour?._id) return { ok: false, reason: 'not-found', slug };

  const before = sectionOrder(tour.body);
  const { out: newBody, removedOrphans, unknownHeadings } = reorderBody(tour.body);
  const after = sectionOrder(newBody);
  const changed = JSON.stringify(newBody) !== JSON.stringify(tour.body);

  if (changed && !dryRun) await sanity.patch(tour._id).set({ body: newBody }).commit();

  return { ok: true, slug, changed, before, after, removedOrphans, unknownHeadings,
           beforeLen: tour.body.length, afterLen: newBody.length };
}

async function main() {
  const args = process.argv.slice(2);
  const ONE_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null;
  const SLUGS = (args.find(a => a.startsWith('--slugs='))?.split('=')[1] || '').split(',').map(s => s.trim()).filter(Boolean);
  const ALL = args.includes('--all');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);
  const DRY_RUN = !args.includes('--execute');

  if (!ONE_SLUG && !SLUGS.length && !ALL) { console.error('Usá --slug=<slug>, --slugs=a,b o --all.'); process.exit(1); }

  const slugs = ONE_SLUG ? [ONE_SLUG] : SLUGS.length ? SLUGS : await fetchSectionSlugs({ limit: LIMIT });
  console.log(`\nREORDER SECTIONS  |  ${slugs.length} tour(s)  |  ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION (escribe Sanity)'}\n`);

  let preview = '', changedCount = 0, untouched = 0, errCount = 0;
  for (const slug of slugs) {
    try {
      const r = await reorderForSlug(slug, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); errCount++; continue; }

      if (r.changed) {
        changedCount++;
        const orph = r.removedOrphans.length ? `  | removed: ${r.removedOrphans.join(', ')}` : '';
        const unk = r.unknownHeadings.length ? `  | UNKNOWN kept at end: ${r.unknownHeadings.join(', ')}` : '';
        console.log(`${DRY_RUN ? 'would reorder' : 'reordered'}: ${slug}  (${r.beforeLen}->${r.afterLen} blocks)${orph}${unk}`);
        preview += `\n## ${slug}  (${r.beforeLen} -> ${r.afterLen} blocks)\n` +
                   `BEFORE: ${r.before.join('  ->  ')}\n` +
                   `AFTER:  ${r.after.join('  ->  ')}\n` +
                   (r.removedOrphans.length ? `REMOVED: ${r.removedOrphans.join(', ')}\n` : '') +
                   (r.unknownHeadings.length ? `UNKNOWN (kept at end): ${r.unknownHeadings.join(', ')}\n` : '');
      } else {
        untouched++;
        console.log(`ok (already in order): ${slug}`);
      }
      if (!DRY_RUN && r.changed) await new Promise(res => setTimeout(res, 300));
    } catch (e) {
      console.error(`ERROR ${slug}: ${e.message}`);
      errCount++;
    }
  }

  if (DRY_RUN) {
    fs.writeFileSync('./reorder-sections-preview.md', preview.trim() + '\n');
    console.log(`\nPreview -> reorder-sections-preview.md  |  a reordenar: ${changedCount}, ya en orden: ${untouched}, errores: ${errCount}   (NADA escrito en Sanity)`);
  } else {
    console.log(`\nDone. reordenados: ${changedCount}, ya en orden: ${untouched}, errores: ${errCount}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
