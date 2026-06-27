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

const byPrice = new Map();
for (const t of tours){ if(t.price==null)continue; const p=Number(t.price); if(!byPrice.has(p))byPrice.set(p,[]); byPrice.get(p).push(t.slug); }
function ownersOf(v){ const out=new Set(); for(const [p,slugs] of byPrice){ if(Math.abs(v-p)<0.01||v===Math.floor(p)) slugs.forEach(s=>out.add(s)); } return [...out]; }

const SECTIONS=[['Quick Answer','💡 Quick Answer'],['Worth It','🤔 Is It Worth'],['Why People Book','🎯 Why People Book'],['Experience','🗺️ The Experience'],['Practical Info','🛡️ Practical Info'],['Best For','👤 Best For'],['Insider Tip','💡 Insider Tip'],['Included',"✅ What's Included"],['Header','⭐']];
function sectionAt(text,idx){ let best='?',bp=-1; for(const [n,m] of SECTIONS){ const p=text.lastIndexOf(m,idx); if(p>bp){bp=p;best=n;} } return best; }

// SPLIT que NO corta en punto decimal: fin de oración = .!?\n NO precedido por dígito-y-seguido-de-dígito
function splitSentences(text){
  // protege decimales: reemplaza temporalmente d.d por d<DOT>d
  const safe = text.replace(/(\d)\.(\d)/g, '$1\u0001$2');
  const parts=[]; const re=/[^.!?\n]*[.!?\n]+/g; let m;
  while((m=re.exec(safe))!==null){ const s=m[0].replace(/\u0001/g,'.').trim(); if(s) parts.push({s, idx:m.index}); }
  return parts;
}

const map=[];
for(const t of tours){
  const body=t.body||'';
  for(const {s,idx} of splitSentences(body)){
    const monies=s.match(/(USD\s?\d[\d,]*(?:\.\d+)?)|(\$\s?\d[\d,]*(?:\.\d+)?)/gi);
    if(!monies)continue;
    for(const money of monies){
      const v=parseFloat(money.replace(/[^\d.]/g,'')); if(!v)continue;
      const owners=ownersOf(v);
      const isPropio=t.price!=null&&(Math.abs(v-Number(t.price))<0.01||v===Math.floor(Number(t.price)));
      const ajenos=owners.filter(o=>o!==t.slug);
      let tipo;
      if(isPropio) tipo='PROPIO';
      else tipo='NO-PROPIO';
      map.push({valor:money.trim(), pagina:t.slug, tipo, seccion:sectionAt(body,idx), oracion:s.slice(0,220), ajenos});
    }
  }
}

const noProp=map.filter(r=>r.tipo!=='PROPIO');
const KW_ADDON=/\b(admission|entrance|entry fee|park fee|permit|deposit|parking|rental|rent|hold|license|gratuit|tip|surcharge|fee|toll|souvenir|upgrade fee)\b/i;
const KW_DERIV=/\b(more|less|cheaper|pricier|save|saving|extra|additional|than|versus|vs\b|compared|premium|off)\b/i;
let addon=0,deriv=0,cita=0; const ejCita=[],ejDeriv=[];
for(const r of noProp){ const o=r.oracion||''; if(KW_ADDON.test(o))addon++; else if(KW_DERIV.test(o)){deriv++;if(ejDeriv.length<6)ejDeriv.push(r);} else {cita++;if(ejCita.length<12)ejCita.push(r);} }

console.log(`=== MAPA (split decimal corregido) — ${map.length} menciones ===`);
console.log(`PROPIO: ${map.length-noProp.length} | NO-PROPIO: ${noProp.length}\n`);
console.log(`Clasificación no-propias:`);
console.log(`  ADD-ON:       ${addon}`);
console.log(`  DERIVADO:     ${deriv}`);
console.log(`  POSIBLE CITA: ${cita}\n`);
const show=(t,a)=>{console.log(`--- ${t} ---`);a.forEach(r=>console.log(`  [${r.valor}] en ${r.pagina} (${r.seccion})\n     "${r.oracion.slice(0,140)}"`));console.log('');};
show('POSIBLE CITA', ejCita);
show('DERIVADO', ejDeriv);

fs.writeFileSync('_mapa-maestro.json', JSON.stringify(map,null,2),'utf8');
console.log('Mapa -> _mapa-maestro.json');
