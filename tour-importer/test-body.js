// test-body.js - Regenera el BODY de UN tour con el template NUEVO, SIN escribir en Sanity.
// Re-fetchea la fuente real (Viator) y corre generateTourContent (que usa promptBuilder de post-template.js).
//
// Uso (cualquiera de los tres):
//   node test-body.js --slug=grand-canyon-ranch-overnight-helicopter-ground-adventure
//   node test-body.js --url=https://www.viator.com/tours/Las-Vegas/.../d684-250380P1
//   node test-body.js --code=250380P1
//
// Salida: test-body-preview.md (+ consola). CERO escritura en Sanity, sin imagenes.

import { createClient } from '@sanity/client';
import { config } from './config.js';
import { fetchViatorTour } from './src/viator-client.js';
import { generateTourContent } from './src/contentGenerator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const PREVIEW = path.resolve('./test-body-preview.md');

function parseArgs() {
  return Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v === undefined ? true : v];
    })
  );
}

// Viator product URL -> productCode. Patron tipico: /d{destId}-{productCode}
function codeFromUrl(url) {
  const m = String(url).match(/\/d\d+-([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

async function resolveCode(args) {
  if (args.code) return { code: args.code, src: 'arg' };

  if (args.url) {
    const code = codeFromUrl(args.url);
    if (!code) throw new Error(`No pude extraer el productCode de la URL. Pasá --code=XXXX a mano.`);
    return { code, src: args.url };
  }

  if (args.slug) {
    const row = await sanity.withConfig({ perspective: 'published' }).fetch(
      `*[_type == "post" && slug.current == $slug][0]{ "url": getYourGuideUrl, title }`,
      { slug: args.slug }
    );
    if (!row?.url) throw new Error(`No encontre getYourGuideUrl para el slug "${args.slug}"`);
    console.log(`Tour:   ${row.title}`);
    const code = codeFromUrl(row.url);
    if (!code) throw new Error(`Encontre la URL (${row.url}) pero no pude extraer el productCode. Pasá --code=XXXX.`);
    return { code, src: row.url };
  }

  throw new Error('Pasá --slug=xxx, --url=xxx o --code=xxx');
}

async function main() {
  const args = parseArgs();
  const { code, src } = await resolveCode(args);
  console.log(`Fuente: ${src}`);
  console.log(`productCode detectado: ${code}\n`);

  console.log('Re-fetcheando la fuente (Viator API)...');
  const tourData = await fetchViatorTour(code);
  if (!tourData?.title) throw new Error('No se pudo extraer el tour de la fuente');
  console.log(`   OK: "${tourData.title}"`);

  console.log('Generando body con el template NUEVO (sin tocar Sanity)...');
  // relatedTours = [] -> sin seccion Compare; no afecta el test de invencion del body.
  const content = await generateTourContent(tourData, []);

  const faqsMd = (content.faqs || [])
    .map(f => `**Q: ${f.question}**\nA: ${f.answer}`)
    .join('\n\n');

  const out = `# PREVIEW BODY — TEMPLATE NUEVO (NO escrito en Sanity)

Tour:   ${content.originalTitle}
Fuente: ${src}
Code:   ${code}

> Datos crudos que recibio el generador (para chequear que el body NO invente fuera de esto):
> - Duration:   ${tourData.duration ?? 'N/A'}
> - Price:      ${tourData.price ?? 'N/A'}
> - Rating:     ${tourData.rating ?? 'N/A'} (${tourData.reviewCount ?? 0} reviews)
> - Highlights: ${(tourData.highlights || []).join(' | ') || '(none)'}
> - Includes:   ${(tourData.includes || []).join(' | ') || '(none)'}
> - Description: ${(tourData.description || '(none)').slice(0, 400)}${(tourData.description || '').length > 400 ? '…' : ''}

===================== BODY =====================

${content.body}

===================== FAQs (parsed) =====================

${faqsMd || '(ninguna)'}

===================== Editorial (lo genera contentGenerator; el injector 5c lo pisa luego) =====================

rating ${content.editorialRating ?? '?'}
${content.editorialReview ?? ''}
`;

  fs.writeFileSync(PREVIEW, out, 'utf8');
  console.log(`\nListo. Preview en: ${PREVIEW}`);
  console.log('NADA escrito en Sanity.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
}