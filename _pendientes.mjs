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
const map = JSON.parse(fs.readFileSync('_mapa-maestro.json','utf8'));

const KW_ADDON=/\b(admission|entrance|entry fee|park fee|permit|deposit|parking|rental|rent|hold|license|gratuit|tip|surcharge|fee|toll|souvenir|upgrade fee)\b/i;
const KW_DERIV=/\b(more|less|cheaper|pricier|save|saving|extra|additional|than|versus|vs\b|compared|premium|off)\b/i;
const citas = map.filter(r => r.tipo!=='PROPIO' && !KW_ADDON.test(r.oracion) && !KW_DERIV.test(r.oracion));

const STOP=new Set(['from','with','tour','tours','vegas','las','the','and','day','trip','small','group','hour','hours']);
const tokens = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3 && !STOP.has(w));
function nameMatches(snip){
  const low=snip.toLowerCase(); const out=[];
  for(const t of cat){ const tk=tokens(t.title); if(!tk.length)continue; const hits=tk.filter(x=>low.includes(x)).length; if(hits>=2) out.push({slug:t.slug,price:t.price,hits}); }
  return out.sort((a,b)=>b.hits-a.hits);
}
const norm=m=>parseFloat(String(m).replace(/[^\d.]/g,''));

const pendientes=[];
for(const c of citas){
  const byName=nameMatches(c.oracion).filter(s=>s.slug!==c.pagina);
  const byNameAndPrice=byName.filter(s=>Math.abs(norm(c.valor)-Number(s.price))<0.01||norm(c.valor)===Math.floor(Number(s.price)));
  if(byNameAndPrice.length===1) continue; // ya identificado, no pendiente
  pendientes.push({ valor:c.valor, pagina:c.pagina, seccion:c.seccion, oracion:c.oracion,
    nCand:byName.length, cands:byName.slice(0,4).map(x=>`${x.slug}($${x.price},${x.hits}t)`) });
}

// agrupar por nCand
const grupos={};
for(const p of pendientes){ const k=p.nCand; (grupos[k]=grupos[k]||[]).push(p); }

console.log(`=== ${pendientes.length} PENDIENTES, agrupados por nº de candidatos por nombre ===\n`);
Object.keys(grupos).sort((a,b)=>a-b).forEach(k=>{
  console.log(`### ${k} candidato(s) por nombre: ${grupos[k].length} casos`);
});
console.log('');

// mostrar muestras de cada grupo
for(const k of Object.keys(grupos).sort((a,b)=>a-b)){
  console.log(`\n===== GRUPO ${k} CANDIDATO(S) (muestra) =====`);
  grupos[k].slice(0,6).forEach(p=>{
    console.log(`[${p.valor}] en ${p.pagina} (${p.seccion})`);
    console.log(`   "${p.oracion.slice(0,140)}"`);
    console.log(`   candidatos: ${p.cands.length?p.cands.join(' | '):'(ninguno)'}`);
  });
}

fs.writeFileSync('_pendientes.json', JSON.stringify(pendientes,null,2),'utf8');
console.log(`\n-> _pendientes.json (${pendientes.length} casos)`);
