import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import fs from 'fs';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const cat = await sanity.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "slug": slug.current, title, "price": tourInfo.price }`
);
const pend = JSON.parse(fs.readFileSync('_pendientes.json','utf8'));

const STOP=new Set(['from','with','tour','tours','vegas','las','the','and','day','trip','small','group','hour','hours']);
const tokens = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3 && !STOP.has(w));
function nameMatches(snip){
  const low=snip.toLowerCase(); const out=[];
  for(const t of cat){ const tk=tokens(t.title); if(!tk.length)continue; const hits=tk.filter(x=>low.includes(x)).length; if(hits>=2) out.push({slug:t.slug,price:Number(t.price),hits}); }
  return out;
}
const norm=m=>parseFloat(String(m).replace(/[^\d.]/g,''));

let ident=0, multi=0, sinPrecioMatch=0, sinNombre=0;
const ejIdent=[], ejMulti=[], ejSinP=[];
const resueltos=[];

for(const p of pend){
  const v=norm(p.valor);
  const byName=nameMatches(p.oracion).filter(s=>s.slug!==p.pagina);
  if(byName.length===0){ sinNombre++; continue; }
  // cruzar precio: candidatos cuyo precio coincide con el valor (exacto o truncado)
  const hit=byName.filter(s=> Math.abs(v-s.price)<0.01 || v===Math.floor(s.price));
  if(hit.length===1){ ident++; resueltos.push({...p, id:hit[0].slug}); if(ejIdent.length<14) ejIdent.push({...p,id:hit[0].slug}); }
  else if(hit.length>1){ multi++; if(ejMulti.length<6) ejMulti.push({...p, hits:hit.map(h=>h.slug)}); }
  else { sinPrecioMatch++; if(ejSinP.length<8) ejSinP.push({...p, cands:byName.slice(0,3).map(h=>`${h.slug}($${h.price})`)}); }
}

console.log(`=== INTERSECCIÓN nombre∩precio sobre ${pend.length} pendientes ===`);
console.log(`IDENTIFICADA (nombre+precio -> 1 tour):     ${ident}`);
console.log(`MULTI (nombre+precio -> varios mismo precio): ${multi}`);
console.log(`NOMBRE pero precio NO matchea candidato:    ${sinPrecioMatch}`);
console.log(`SIN NOMBRE (vago/tercero):                  ${sinNombre}\n`);

const show=(t,a,f)=>{console.log(`--- ${t} ---`);a.forEach(f);console.log('');};
show('IDENTIFICADAS (nombre+precio)', ejIdent, r=>console.log(`  [${r.valor}] ${r.pagina} => ${r.id}\n     "${r.oracion.slice(0,110)}"`));
show('NOMBRE sí, precio NO matchea (¿derivado/vago?)', ejSinP, r=>console.log(`  [${r.valor}] ${r.pagina} -> ${r.cands.join(' | ')}\n     "${r.oracion.slice(0,110)}"`));

fs.writeFileSync('_pend-resueltos.json', JSON.stringify(resueltos,null,2),'utf8');
console.log(`-> ${resueltos.length} resueltos por nombre+precio -> _pend-resueltos.json`);
