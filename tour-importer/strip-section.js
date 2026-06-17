
// strip-section.js - Borra una seccion (por heading) de los bodies ya publicados.
// NO usa AI: solo fetch -> remueve la seccion -> patch. Es una migracion estructural one-time,
// no una regeneracion de contenido. Idempotente (si ya no esta, no hace nada).
//
// CLI:
//   node strip-section.js --section="tour format" --slug=<slug> --dry-run   # uno, preview
//   node strip-section.js --section="tour format" --all --dry-run           # catalogo, preview
//   node strip-section.js --section="tour format" --all --execute           # catalogo, BORRA
//   --section acepta varios separados por coma: --section="tour format,old section"
//
// Seguro por defecto: sin --execute es DRY RUN (no escribe nada en Sanity).

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

// Remueve toda seccion cuyo heading incluya alguno de `finds` (heading + bloques hasta el proximo heading).
function stripSections(body, finds) {
  let result = [...(body || [])];
  const removed = [];
  let again = true;
  while (again) {
    again = false;
    const idx = result.findIndex(b => isHeading(b) && finds.some(f => headingText(b).toLowerCase().includes(f)));
    if (idx !== -1) {
      let end = result.length;
      for (let i = idx + 1; i < result.length; i++) { if (isHeading(result[i])) { end = i; break; } }
      removed.push(headingText(result[idx]).trim());
      result = [...result.slice(0, idx), ...result.slice(end)];
      again = true;
    }
  }
  return { body: result, removed };
}

async function stripForSlug(slug, finds, { dryRun }) {
  const tour = await sanity.fetch(
    `*[_type == "post" && !(_id in path("drafts.**")) && slug.current == $slug && defined(body)][0]{ _id, body }`,
    { slug }
  );
  if (!tour?._id) return { ok: false, reason: 'not-found', slug };
  const { body: newBody, removed } = stripSections(tour.body, finds);
  if (!removed.length) return { ok: true, slug, removed: [], changed: false };
  if (!dryRun) await sanity.patch(tour._id).set({ body: newBody }).commit();
  return { ok: true, slug, removed, changed: true, before: tour.body.length, after: newBody.length };
}

async function main() {
  const args = process.argv.slice(2);
  const SECTION = args.find(a => a.startsWith('--section='))?.split('=')[1] || '';
  const finds = SECTION.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const ONE_SLUG = args.find(a => a.startsWith('--slug='))?.split('=')[1] || null;
  const ALL = args.includes('--all');
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);
  const DRY_RUN = !args.includes('--execute');

  if (!finds.length) { console.error('Falta --section="tour format" (heading a borrar; coma para varios).'); process.exit(1); }
  if (!ONE_SLUG && !ALL) { console.error('Usá --slug=<slug> o --all.'); process.exit(1); }

  const slugs = ONE_SLUG ? [ONE_SLUG] : await fetchSectionSlugs({ limit: LIMIT });
  console.log(`\nSTRIP SECTION  |  borrar: "${finds.join('", "')}"  |  ${slugs.length} tour(s)  |  ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION (escribe Sanity)'}\n`);

  let removedCount = 0, untouched = 0, errCount = 0;
  for (const slug of slugs) {
    try {
      const r = await stripForSlug(slug, finds, { dryRun: DRY_RUN });
      if (!r.ok) { console.log(`skip (${r.reason}): ${slug}`); errCount++; continue; }
      if (r.changed) { console.log(`${DRY_RUN ? 'would strip' : 'stripped'}: ${slug}  (removed: ${r.removed.join(', ')})`); removedCount++; }
      else { untouched++; }
      if (!DRY_RUN && r.changed) await new Promise(res => setTimeout(res, 300));
    } catch (e) {
      console.error(`ERROR ${slug}: ${e.message}`);
      errCount++;
    }
  }
  console.log(`\nDone. ${DRY_RUN ? 'a borrar' : 'borradas'}: ${removedCount}, sin la seccion: ${untouched}, errores: ${errCount}${DRY_RUN ? '   (NADA escrito en Sanity)' : ''}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
