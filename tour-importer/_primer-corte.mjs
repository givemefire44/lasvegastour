import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import fs from 'fs';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const tours = await sanity.fetch(
  `*[_type=="post" && defined(getYourGuideUrl)]{ "slug": slug.current, "price": tourInfo.price, "body": pt::text(body) }`
);

// catálogo: precio -> [slugs] (puede haber varios con el mismo precio)
const catalog = new Map();
for (const t of tours) {
  if (t.price == null) continue;
  const p = Number(t.price);
  if (!catalog.has(p)) catalog.set(p, []);
  catalog.get(p).push(t.slug);
}

const norm = s => parseFloat(String(s).replace(/[^\d.]/g, ''));
// ¿el valor v coincide con precios del catálogo? (tolerancia redondeo: exacto o trunc)
function matchTours(v) {
  const out = [];
  for (const [p, slugs] of catalog) {
    // coincide si v == p, o v == trunc(p) (prosa redondeada del ajeno)
    if (Math.abs(v - p) < 0.01 || v === Math.floor(p)) out.push(...slugs);
  }
  return [...new Set(out)];
}

const splitSentences = text => text
  .replace(/([.!?])\s+(?=[A-Z🎯💡✅❌🤔🗺️🛡️👤👥💰⏱️⭐])/g, '$1\n§')
  .replace(/\n+/g, '\n§').split('§').map(s => s.trim()).filter(Boolean);

let uno = 0, varios = 0, nadie = 0;
let ejUno = [], ejVarios = [], ejNadie = [];

for (const t of tours) {
  for (const sent of splitSentences(t.body || '')) {
    const monies = sent.match(/(USD\s?\d[\d,]*(?:\.\d+)?)|(\$\s?\d[\d,]*(?:\.\d+)?)/gi);
    if (!monies) continue;
    for (const money of monies) {
      const v = norm(money);
      if (!v) continue;
      // saltear el precio propio (exacto o truncado)
      if (t.price != null && (Math.abs(v - Number(t.price)) < 0.01 || v === Math.floor(Number(t.price)))) continue;
      // quitar al propio del match (no nos interesa que matchee a sí mismo)
      const m = matchTours(v).filter(s => s !== t.slug);
      const rec = { slug: t.slug, money: money.trim(), snippet: sent.slice(0,150), matches: m };
      if (m.length === 1)      { uno++;   if (ejUno.length<8)   ejUno.push(rec); }
      else if (m.length > 1)   { varios++; if (ejVarios.length<8) ejVarios.push(rec); }
      else                     { nadie++;  if (ejNadie.length<8)  ejNadie.push(rec); }
    }
  }
}

console.log(`=== PRIMER CORTE de menciones no-propias ===`);
console.log(`PERTENECE A 1 TOUR (identificable limpio): ${uno}`);
console.log(`PERTENECE A VARIOS (ambiguo, desempate):   ${varios}`);
console.log(`NO PERTENECE A NADIE (add-on/ruido/deriv): ${nadie}`);
console.log(`TOTAL no-propias:                          ${uno+varios+nadie}\n`);

const show = (titulo, arr) => { console.log(`--- ${titulo} ---`); for (const r of arr) console.log(`  [${r.money}] ${r.slug}\n     -> ${r.matches.length?r.matches.join(', '):'(nadie)'}\n     "${r.snippet}"`); console.log(''); };
show('PERTENECE A 1', ejUno);
show('PERTENECE A VARIOS', ejVarios);
show('NO PERTENECE A NADIE', ejNadie);

fs.writeFileSync('_primer-corte.json', JSON.stringify({uno,varios,nadie}, null, 2), 'utf8');
