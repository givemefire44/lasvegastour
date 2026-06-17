
// audit-figures.mjs - audita las cifras (horas/min/millas/km/pies) del body de UN tour.
// Uso: node audit-figures.mjs --slug=<slug>
// Muestra en que seccion vive cada cifra, para detectar inventos heredados o confirmar
// que una cifra es real. No escribe nada.

import { createClient } from '@sanity/client';
import { config } from './config.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const NUM = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|\\d+(?:[.,]\\d+)?)';
const FIGURE = new RegExp(
  `\\b(?:roughly |about |around |approximately |nearly |over |under )?${NUM}[\\s-]?(?:hour|hours|hr|hrs|minute|minutes|min|mins|mile|miles|km|kilometer|kilometers|foot|feet|ft)\\b`,
  'ig'
);

const isHeading = b => b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const blockText = b => (b.children || []).map(c => c.text || '').join('');

async function main() {
  const slug = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1];
  if (!slug) { console.error('Falta --slug=...'); process.exit(1); }

  const tour = await sanity.fetch(
    `*[_type=="post" && !(_id in path("drafts.**")) && slug.current==$slug][0]{ title, "slug": slug.current, body, faqs[]{question,answer} }`,
    { slug }
  );
  if (!tour) { console.error('No encontrado:', slug); process.exit(1); }

  console.log(`\nAUDIT cifras  |  ${tour.title}\n`);

  let section = '(top)';
  const all = [];
  for (const b of (tour.body || [])) {
    if (isHeading(b)) { section = blockText(b).replace(/^[^\w]+/, '').trim() || '(heading)'; continue; }
    const text = blockText(b);
    const hits = [...text.matchAll(FIGURE)].map(m => m[0].trim());
    if (hits.length) {
      console.log(`[BODY · ${section}]  ${hits.join('  |  ')}`);
      console.log(`    "${text.slice(0, 160)}${text.length > 160 ? '…' : ''}"`);
      all.push(...hits);
    }
  }

  // FAQs (field estructurado)
  for (const f of (tour.faqs || [])) {
    const text = `${f.question} ${f.answer}`;
    const hits = [...text.matchAll(FIGURE)].map(m => m[0].trim());
    if (hits.length) {
      console.log(`[FAQ]  ${hits.join('  |  ')}`);
      console.log(`    Q: ${f.question}`);
      console.log(`    A: ${f.answer.slice(0, 160)}${f.answer.length > 160 ? '…' : ''}`);
      all.push(...hits);
    }
  }

  const uniq = [...new Set(all.map(s => s.toLowerCase()))].sort();
  console.log(`\n=== Todas las cifras encontradas (${uniq.length}) ===`);
  console.log(uniq.join('\n') || '(ninguna)');
}

main().catch(e => { console.error(e.message); process.exit(1); });