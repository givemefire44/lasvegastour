import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import fs from 'fs';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const tours = await sanity.fetch(
  `*[_type=="post" && defined(getYourGuideUrl)]{
     "slug": slug.current, "price": tourInfo.price, "body": pt::text(body) }`
);
console.log(`Tours analizados: ${tours.length}\n`);

// Corta el texto en oraciones SIN romper decimales:
// fin de oración = . ! ? o salto de línea, SOLO si NO está entre dígitos.
function splitSentences(text) {
  // marca límites: punto/!/? seguido de espacio+mayúscula/emoji o newline; nunca dígito.punto.dígito
  return text
    .replace(/([.!?])\s+(?=[A-Z🎯💡✅❌🤔🗺️🛡️👤👥💰⏱️⭐])/g, '$1\n§')
    .replace(/\n+/g, '\n§')
    .split('§')
    .map(s => s.trim())
    .filter(Boolean);
}

const moneyRe = /(USD\s?\d[\d,]*(?:\.\d+)?)|(\$\s?\d[\d,]*(?:\.\d+)?)/i;

let rows = [];
let countDollar = 0, countUSD = 0;

for (const t of tours) {
  const sentences = splitSentences(t.body || '');
  for (const sent of sentences) {
    // todas las menciones de dinero en esta oración
    const allMoney = sent.match(/(USD\s?\d[\d,]*(?:\.\d+)?)|(\$\s?\d[\d,]*(?:\.\d+)?)/gi);
    if (!allMoney) continue;
    for (const money of allMoney) {
      if (/USD/i.test(money)) countUSD++; else countDollar++;
      rows.push({ slug: t.slug, ownPrice: t.price, money: money.trim(), snippet: sent });
    }
  }
}

console.log(`Menciones de dinero (snippets corregidos): ${rows.length}`);
console.log(`  forma "$X":   ${countDollar}`);
console.log(`  forma "USD X": ${countUSD}\n`);

fs.writeFileSync('_derivados-candidatos.json', JSON.stringify(rows, null, 2), 'utf8');
console.log('Detalle -> _derivados-candidatos.json\n');

// Para ver derivados POTENCIALES: dinero cuyo valor NO es el precio propio
const norm = s => parseFloat(String(s).replace(/[^\d.]/g, ''));
const sospechosos = rows.filter(r => {
  const v = norm(r.money);
  return v && r.ownPrice && Math.abs(v - r.ownPrice) > 0.01;
});
console.log(`Menciones cuyo valor != precio propio (candidatos a derivado/ajeno): ${sospechosos.length}`);
console.log('\n--- primeros 20 candidatos (valor != propio) ---');
for (const r of sospechosos.slice(0, 20)) {
  console.log(`\n[${r.money}] ${r.slug} (propio ${r.ownPrice})`);
  console.log(`  "${r.snippet.slice(0, 180)}"`);
}
