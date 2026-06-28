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
const ajenos = map.filter(r => r.tipo !== 'PROPIO');

const STOP = new Set(['from','with','tour','tours','vegas','las','the','and','day','trip','small','group','hour','hours','your','this','that','for']);
const toks = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3 && !STOP.has(w));
const norm = m => parseFloat(String(m).replace(/[^\d.]/g,''));

function findId(snippet, valor, pagina){
  const v = norm(valor);
  const low = snippet.toLowerCase();
  // candidatos por nombre: >=2 tokens del título en el snippet
  const byName = cat.filter(t => {
    if (t.slug === pagina) return false;
    const tk = toks(t.title);
    return tk.length && tk.filter(x => low.includes(x)).length >= 2;
  });
  // de esos, los que ademas matchean el precio
  const both = byName.filter(t => Math.abs(v - Number(t.price)) < 0.01 || v === Math.floor(Number(t.price)));
  return { byName, both };
}

let conId=0, ambiguo=0, sinId=0;
const out=[];
for(const r of ajenos){
  const { byName, both } = findId(r.oracion, r.valor, r.pagina);
  let estado, id=null, cands=[];
  if(both.length===1){ estado='ID'; id=both[0].slug; conId++; }
  else if(both.length>1){ estado='AMBIGUO'; cands=both.map(t=>t.slug); ambiguo++; }
  else { estado='SIN-ID'; cands=byName.slice(0,3).map(t=>t.slug); sinId++; }
  out.push({ valor:r.valor, pagina:r.pagina, seccion:r.seccion, estado, id, cands, oracion:r.oracion.slice(0,140) });
}

console.log(`=== 649 AJENOS — búsqueda de id (nombre+precio) ===`);
console.log(`CON ID (cierra a 1):   ${conId}`);
console.log(`AMBIGUO (cierra varios): ${ambiguo}`);
console.log(`SIN ID (no cierra):     ${sinId}\n`);

fs.writeFileSync('_ajenos-id.json', JSON.stringify(out,null,2),'utf8');
console.log('-> _ajenos-id.json (los 3 estados, con dónde está cada uno)\n');

console.log('--- muestra CON ID ---');
out.filter(r=>r.estado==='ID').slice(0,12).forEach(r=>console.log(`  [${r.valor}] ${r.pagina} (${r.seccion}) => ${r.id}`));
console.log('\n--- muestra AMBIGUO ---');
out.filter(r=>r.estado==='AMBIGUO').slice(0,6).forEach(r=>console.log(`  [${r.valor}] ${r.pagina} => ${r.cands.join(' / ')}`));
