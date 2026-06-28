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

const STOP = new Set(['from','with','tour','tours','vegas','las','the','and','day','trip','small','group','hour','hours','your','this','that','for','per','person']);
const toks = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3 && !STOP.has(w));
const norm = m => parseFloat(String(m).replace(/[^\d.]/g,''));

// pre-calcular tokens de cada titulo
const catTok = cat.map(t => ({ ...t, tk: toks(t.title) }));

function locate(snippet, valor, pagina){
  const v = norm(valor);
  const low = snippet.toLowerCase();
  // 1) titulo lleva a url: tours cuyo titulo aparece en el snippet (>=2 tokens)
  const porTitulo = catTok.filter(t => t.slug!==pagina && t.tk.length && t.tk.filter(x=>low.includes(x)).length>=2);
  // 2) precio confirma: de esos, cual tiene ese precio
  const confirm = porTitulo.filter(t => Math.abs(v-Number(t.price))<0.01 || v===Math.floor(Number(t.price)));
  return { porTitulo, confirm };
}

let validado=0, tituloSinConfirm=0, sinTitulo=0;
const out=[];
for(const r of ajenos){
  const { porTitulo, confirm } = locate(r.oracion, r.valor, r.pagina);
  let estado, url=null;
  if(confirm.length===1){ estado='VALIDADO'; url=confirm[0].slug; validado++; }
  else if(porTitulo.length>=1){ estado='TITULO-SIN-PRECIO-CONFIRM'; tituloSinConfirm++; }
  else { estado='SIN-TITULO'; sinTitulo++; }
  out.push({ valor:r.valor, pagina:r.pagina, seccion:r.seccion, estado, url,
             cands: confirm.length>1?confirm.map(c=>c.slug):porTitulo.slice(0,3).map(c=>`${c.slug}($${c.price})`),
             oracion:r.oracion.slice(0,130) });
}

console.log(`=== ${ajenos.length} AJENOS — ubicar URL por título, precio confirma ===`);
console.log(`VALIDADO (título->1 url + precio confirma): ${validado}`);
console.log(`TÍTULO sin precio que confirme:             ${tituloSinConfirm}`);
console.log(`SIN TÍTULO (precio solo/vago/tercero):      ${sinTitulo}\n`);

fs.writeFileSync('_ajenos-validados.json', JSON.stringify(out,null,2),'utf8');
console.log('-> _ajenos-validados.json\n');
console.log('--- muestra VALIDADO ---');
out.filter(r=>r.estado==='VALIDADO').slice(0,15).forEach(r=>console.log(`  [${r.valor}] ${r.pagina} (${r.seccion}) => ${r.url}`));
