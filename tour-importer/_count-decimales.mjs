import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const tours = await sanity.fetch(
  `*[_type=="post" && defined(getYourGuideUrl)]{ "slug": slug.current, "body": pt::text(body) }`
);

let conDecimales = 0, sinDecimales = 0;
let ejemplos = [];

for (const t of tours) {
  const body = t.body || '';
  // dinero con decimales: $505.25 o USD 505.25
  const decim = body.match(/(?:USD\s?|\$\s?)\d[\d,]*\.\d+/gi) || [];
  // dinero sin decimales: $505 o USD 505 (no seguido de punto-dígito)
  const enteros = body.match(/(?:USD\s?|\$\s?)\d[\d,]*(?!\.\d)/gi) || [];
  conDecimales += decim.length;
  sinDecimales += enteros.length;
  if (decim.length && ejemplos.length < 15) {
    ejemplos.push({ slug: t.slug, decimales: decim.slice(0, 5) });
  }
}

console.log(`Menciones de dinero CON decimales: ${conDecimales}`);
console.log(`Menciones de dinero SIN decimales: ${sinDecimales}\n`);
console.log('--- ejemplos de tours con decimales en prosa ---');
for (const e of ejemplos) console.log(`${e.slug}: ${e.decimales.join(', ')}`);
