import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const tours = await sanity.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{
     "slug": slug.current, "price": tourInfo.price }`
);

// precio -> cuántos tours lo tienen
const byPrice = new Map();
for (const t of tours) {
  if (t.price == null) continue;
  const p = Number(t.price);
  byPrice.set(p, (byPrice.get(p) || 0) + 1);
}

let preciosUnicos = 0;      // precio que tiene 1 solo tour
let preciosCompartidos = 0; // precio que tienen 2+
let toursConPrecioUnico = 0;
let toursConPrecioCompartido = 0;
const reparto = {};         // cuántos precios son compartidos por exactamente N tours
const topCompartidos = [];

for (const [precio, n] of byPrice) {
  if (n === 1) { preciosUnicos++; toursConPrecioUnico += 1; }
  else {
    preciosCompartidos++; toursConPrecioCompartido += n;
    reparto[n] = (reparto[n] || 0) + 1;
    topCompartidos.push({ precio, n });
  }
}

console.log(`=== PRECIOS IDÉNTICOS — ${tours.length} tours (published) ===`);
console.log(`Precios distintos en total:        ${byPrice.size}`);
console.log(`Precios ÚNICOS (1 solo tour):       ${preciosUnicos} -> ${toursConPrecioUnico} tours identificables por precio solo`);
console.log(`Precios COMPARTIDOS (2+ tours):     ${preciosCompartidos} -> ${toursConPrecioCompartido} tours en ambigüedad de precio\n`);

console.log('Reparto (cuántos precios son compartidos por exactamente N tours):');
Object.keys(reparto).sort((a,b)=>a-b).forEach(n => console.log(`   ${n} tours comparten precio: ${reparto[n]} precios distintos`));

console.log('\nTop precios más compartidos:');
topCompartidos.sort((a,b)=>b.n-a.n).slice(0,10).forEach(x => console.log(`   $${x.precio}: ${x.n} tours`));
