// ingest-corpus.mjs - Puebla el CORPUS con la data cruda de Viator.
// No toca index.js ni el uploader: es aditivo y sin riesgo.
//
// Uso:
//   node ingest-corpus.mjs --dry-run            (lista qué bajaría, sin escribir)
//   node ingest-corpus.mjs                      (refresca desde Sanity: TODOS los tours live, datos frescos)
//   node ingest-corpus.mjs --code=5516P7        (un solo producto, para probar)
//   node ingest-corpus.mjs --limit=10           (acota)
//
// Fuente: los docs de Sanity (lee el productCode del final de getYourGuideUrl),
// así el corpus queda calcado a lo que está publicado.
// Baja SIEMPRE todos los tours con datos frescos (upsert actualiza si ya existen).

import { fetchViatorTour } from './src/viator-client.js';
import { upsertProduct, countProducts, closeCorpus } from './corpus.js';
import { config } from './config.js';
import { createClient } from '@sanity/client';
import fs from 'fs';

const codeFromUrl = url => (String(url || '').match(/d\d+-([0-9A-Za-z]+)/) || [])[1] || null;

async function codesFromSanity() {
  const sanity = createClient({
    projectId: config.sanity.projectId, dataset: config.sanity.dataset,
    token: config.sanity.token, apiVersion: '2024-01-01', useCdn: false,
  });
  const rows = await sanity.fetch(
    `*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "url": getYourGuideUrl, "slug": slug.current }`
  );
  const out = [];
  for (const r of (rows || [])) {
    const code = codeFromUrl(r.url);
    if (code) out.push({ code, slug: r.slug });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const ONE = args.find(a => a.startsWith('--code='))?.split('=')[1] || null;
  const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100000', 10);
  const DRY = args.includes('--dry-run');

  let targets = ONE ? [{ code: ONE }] : await codesFromSanity();
  // dedupe por code
  const seen = new Set();
  targets = targets.filter(t => (seen.has(t.code) ? false : seen.add(t.code))).slice(0, LIMIT);

  console.log(`\nINGESTA CORPUS  |  ${targets.length} productos  |  ${DRY ? 'DRY RUN' : 'WRITE'}${DRY ? '' : `  |  corpus actual: ${countProducts()}`}`);
  if (!targets.length) { console.error('No hay productCodes (¿los docs tienen getYourGuideUrl de Viator?)'); process.exit(1); }

  let ok = 0, err = 0, skipped = 0;
  const failures = [];
  for (const { code, slug } of targets) {
    try {
      const data = await fetchViatorTour(code);
      if (!data?.title) { console.log(`skip (no-data): ${code}`); skipped++; continue; }
      const nAI = (data.additionalInfo || []).length;
      const nIt = (data.itinerary || []).length;
      const itFlag = nIt ? `itinerary:${nIt}` : (data.itineraryText ? 'itinerary:txt' : 'itinerary:0');
      if (DRY) {
        console.log(`would upsert: ${code}  | ${data.title.slice(0, 50)}  | additionalInfo:${nAI} ${itFlag}`);
      } else {
        upsertProduct({ ...data, productCode: code, sourceUrl: data.url || null });
        console.log(`upserted: ${code}  | ${data.title.slice(0, 50)}  | additionalInfo:${nAI} ${itFlag}`);
      }
      ok++;
      await new Promise(r => setTimeout(r, 1500)); // rate limit vs Viator API
    } catch (e) {
      console.error(`ERROR ${code}: ${e.message}`);
      failures.push({ code, slug: slug || null, error: e.message });
      err++;
    }
  }

  // Volcado de fallidos (códigos delistados / URLs rotas) con su slug, para limpieza manual.
  if (failures.length) {
    const ERRFILE = './ingest-corpus-errors.json';
    fs.writeFileSync(ERRFILE, JSON.stringify(failures, null, 2));
    console.log(`\nFallidos: ${failures.length} -> ${ERRFILE}`);
    for (const f of failures) console.log(`   ${f.code}  | ${f.slug || '(sin slug)'}  | ${f.error}`);
  }

  console.log(`\nDone. ok:${ok}  skipped:${skipped}  err:${err}${DRY ? '' : `  |  corpus total: ${countProducts()}`}`);
  closeCorpus();
}

main().catch(e => { console.error(e.message); process.exit(1); });
