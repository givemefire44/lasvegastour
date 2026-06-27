import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import fs from 'fs';

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID, dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN,
  apiVersion: '2024-01-01', useCdn: false,
});

const cat = await sanity.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{
     "slug": slug.current, title, "price": tourInfo.price }`
);

const map = JSON.parse(fs.readFileSync('_mapa-maestro.json','utf8'));
const KW_ADDON=/\b(admission|entrance|entry fee|park fee|permit|deposit|parking|rental|rent|hold|license|gratuit|tip|surcharge|fee|toll|souvenir|upgrade fee)\b/i;
const KW_DERIV=/\b(more|less|cheaper|pricier|save|saving|extra|additional|than|versus|vs\b|compared|premium|off)\b/i;
const citas = map.filter(r => r.tipo!=='PROPIO' && !KW_ADDON.test(r.oracion) && !KW_DERIV.test(r.oracion));

// tokens significativos de un título (palabras >3 chars, sin stopwords)
const STOP=new Set(['from','with','tour','tours','vegas','las','the','and','day','trip','small','group','hour','hours','las vegas']);
const tokens = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3 && !STOP.has(w));

// para cada cita: ¿qué tours matchean por NOMBRE (>=2 tokens del título en el snippet)?
function nameMatches(snippet){
  const snipLow = snippet.toLowerCase();
  const out=[];
  for(const t of cat){
    const toks = tokens(t.title);
    if(toks.length===0) continue;
    const hits = toks.filter(tok => snipLow.includes(tok)).length;
    if(hits >= 2) out.push({slug:t.slug, price:t.price, hits});
  }
  return out.sort((a,b)=>b.hits-a.hits);
}
const norm = m => parseFloat(String(m).replace(/[^\d.]/g,''));
function priceMatch(v, slugList){ return slugList.filter(s => Math.abs(norm(v)-Number(s.price))<0.01 || norm(v)===Math.floor(Number(s.price))); }

let ident=0, soloNombre=0, soloPrecio=0, ninguna=0;
const ejIdent=[], ejSoloN=[];
for(const c of citas){
  const byName = nameMatches(c.oracion).filter(s=>s.slug!==c.pagina);
  const byNameAndPrice = priceMatch(c.valor, byName);
  if(byNameAndPrice.length===1){ ident++; if(ejIdent.length<12) ejIdent.push({...c, id:byNameAndPrice[0].slug}); }
  else if(byName.length>=1){ soloNombre++; if(ejSoloN.length<6) ejSoloN.push({...c, cand:byName.slice(0,3).map(x=>x.slug)}); }
  else if(byNameAndPrice.length>1){ soloPrecio++; }
  else ninguna++;
}

console.log(`=== IDENTIFICACIÓN nombre+precio — ${citas.length} posibles citas ===`);
console.log(`IDENTIFICADA (nombre+precio -> 1 tour): ${ident}`);
console.log(`SOLO NOMBRE (matchea nombre, precio no cierra/varios): ${soloNombre}`);
console.log(`NINGUNA (ni nombre): ${ninguna}\n`);
console.log('--- IDENTIFICADAS (cita -> id) ---');
ejIdent.forEach(r=>console.log(`  [${r.valor}] en ${r.pagina}\n     => ${r.id}\n     "${r.oracion.slice(0,120)}"`));
console.log('\n--- SOLO NOMBRE (candidatos, precio no confirmó) ---');
ejSoloN.forEach(r=>console.log(`  [${r.valor}] en ${r.pagina} -> cand: ${r.cand.join(', ')}\n     "${r.oracion.slice(0,120)}"`));
