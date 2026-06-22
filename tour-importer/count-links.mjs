// count-links.mjs — Cuenta links persistidos leyendo FRESCO de Sanity (useCdn:false).
// No pasa por el cache de Vision. Uso: node count-links.mjs   (desde tour-importer)

import { createClient } from '@sanity/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = createClient({
  projectId: 'kabmqky1',
  dataset: 'production',
  apiVersion: '2023-05-03',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

const posts = await client.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && defined(slug.current)]{ _id, "slug": slug.current, body }`
);

let total = 0, tours = 0, redrock = 0;
for (const p of posts) {
  let n = 0;
  for (const b of (p.body || [])) {
    if (Array.isArray(b.markDefs)) n += b.markDefs.filter(d => d?._type === 'link').length;
  }
  if (n > 0) tours++;
  total += n;
  if (p.slug === 'red-rock-canyon-heli-tour-with-landing-champagne') redrock = n;
}

console.log(`posts leidos:     ${posts.length}`);
console.log(`totalLinksReal:   ${total}`);
console.log(`toursConLinks:    ${tours}`);
console.log(`linksRedRock:     ${redrock}`);

