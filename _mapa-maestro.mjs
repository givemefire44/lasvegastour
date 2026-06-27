import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import fs from 'fs';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const tours = await sanity.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{
     "slug": slug.current, title, "price": tourInfo.price, "body": pt::text(body) }`
);

// índice precio -> [slugs] (para saber de quién es un valor)
const byPrice = new Map();
for (const t of tours) {
  if (t.price==null) continue;
  const p = Number(t.price);
  if (!byPrice.has(p)) byPrice.set(p, []);
  byPrice.get(p).push(t.slug);
}
// dueños de un valor (exacto o truncado, para prosa redondeada)
function ownersOf(v) {
  const out = new Set();
  for (const [p, slugs] of byPrice) {
    if (Math.abs(v-p) < 0.01 || v === Math.floor(p)) slugs.forEach(s=>out.add(s));
  }
  return [...out];
}

// detectar sección por el emoji/encabezado que precede
const SECTIONS = [
  ['Quick Answer','💡 Quick Answer'],['Worth It','🤔 Is It Worth'],['Why People Book','🎯 Why People Book'],
  ['Experience','🗺️ The Experience'],['Practical Info','🛡️ Practical Info'],['Best For','👤 Best For'],
  ['Insider Tip','💡 Insider Tip'],['Included',"✅ What's Included"],['Header','⭐'],
];
function sectionAt(text, idx) {
  let best='?', bestPos=-1;
  for (const [name, marker] of SECTIONS) {
    const p = text.lastIndexOf(marker, idx);
    if (p>bestPos) { bestPos=p; best=name; }
  }
  return best;
}

const splitSentences = text => {
  const parts=[];
  const re=/[^.!?\n]*[.!?\n]+/g; let m;
  while((m=re.exec(text))!==null) parts.push({s:m[0].trim(), idx:m.index});
  return parts.filter(p=>p.s);
};

const map = [];
for (const t of tours) {
  const body = t.body || '';
  for (const {s, idx} of splitSentences(body)) {
    const monies = s.match(/(USD\s?\d[\d,]*(?:\.\d+)?)|(\$\s?\d[\d,]*(?:\.\d+)?)/gi);
    if (!monies) continue;
    for (const money of monies) {
      const v = parseFloat(money.replace(/[^\d.]/g,''));
      if (!v) continue;
      const owners = ownersOf(v);
      const isPropio = t.price!=null && (Math.abs(v-Number(t.price))<0.01 || v===Math.floor(Number(t.price)));
      const ownersAjenos = owners.filter(o=>o!==t.slug);
      let tipo, duenoId, confianza;
      if (isPropio) { tipo='PROPIO'; duenoId=t.slug; confianza = owners.length<=1?'UNICO':'tambien-en-otros'; }
      else if (ownersAjenos.length===1){ tipo='AJENO'; duenoId=ownersAjenos[0]; confianza='UNICO'; }
      else if (ownersAjenos.length>1){ tipo='AJENO'; duenoId=`AMBIGUO(${ownersAjenos.length})`; confianza='COMPARTIDO'; }
      else { tipo='SIN-DUENO'; duenoId='(nadie: add-on/derivado/ruido)'; confianza='-'; }
      map.push({ valor:money.trim(), pagina:t.slug, dueno:duenoId, tipo, confianza,
                 seccion:sectionAt(body,idx), oracion:s.slice(0,200) });
    }
  }
}

// resumen
const c = { PROPIO:0, AJENO:0, 'SIN-DUENO':0 };
let ajenoUnico=0, ajenoAmbiguo=0;
for (const r of map){ c[r.tipo]++; if(r.tipo==='AJENO'){ r.confianza==='UNICO'?ajenoUnico++:ajenoAmbiguo++; } }

console.log(`=== MAPA MAESTRO — ${map.length} menciones de dinero ===`);
console.log(`PROPIO:    ${c.PROPIO}`);
console.log(`AJENO:     ${c.AJENO}  (único: ${ajenoUnico} | ambiguo: ${ajenoAmbiguo})`);
console.log(`SIN-DUEÑO: ${c['SIN-DUENO']}  (add-on/derivado/ruido)\n`);

fs.writeFileSync('_mapa-maestro.json', JSON.stringify(map,null,2),'utf8');
console.log('Mapa completo -> _mapa-maestro.json\n');

console.log('--- muestra AJENO ÚNICO (identificación limpia) ---');
map.filter(r=>r.tipo==='AJENO'&&r.confianza==='UNICO').slice(0,10).forEach(r=>
  console.log(`  [${r.valor}] en ${r.pagina}\n     dueño: ${r.dueno} (${r.seccion})\n     "${r.oracion.slice(0,120)}"`));
