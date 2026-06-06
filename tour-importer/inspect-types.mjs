import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });
import { createClient } from '@sanity/client';
const c = createClient({ projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET, token: process.env.SANITY_TOKEN, apiVersion: '2024-01-01', useCdn: false });

console.log('=== Todos los _type que existen ===');
const types = await c.fetch(`array::unique(*[]._type)`);
console.log(types.join(', '));

console.log('\n=== Buscar el articulo de 1817 (por slug) ===');
const a = await c.fetch(`*[slug.current match "*1-817*" || title match "*1,817*" || title match "*1817*"]{ _type, title, "slug": slug.current }`);
console.log(JSON.stringify(a, null, 2));

console.log('\n=== Cuantos hay de cada tipo relevante ===');
for (const t of ['post','page']) {
  const n = await c.fetch(`count(*[_type == $t && !(_id in path("drafts.**"))])`, { t });
  console.log('  ' + t + ': ' + n);
}

console.log('\n=== Como distinguir TOUR de ARTICULO en posts? Ver campos de uno de cada ===');
const tourSample = await c.fetch(`*[_type == "post" && defined(getYourGuideUrl)][0]{ title, "hasGyg": defined(getYourGuideUrl), "hasCategory": defined(category) }`);
const artSample = await c.fetch(`*[_type == "post" && !defined(getYourGuideUrl) && title match "*Worth*"][0]{ title, "hasGyg": defined(getYourGuideUrl), "hasCategory": defined(category), category }`);
console.log('TOUR sample:', JSON.stringify(tourSample));
console.log('ARTICULO sample:', JSON.stringify(artSample));
