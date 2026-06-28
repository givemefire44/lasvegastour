import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';
import fs from 'fs';

const DRY = process.argv.includes('--dry-run');
const LIMIT = (process.argv.find(a=>a.startsWith('--limit='))||'').split('=')[1];

const sanity = createClient({ projectId:'kabmqky1', dataset:'production', apiVersion:'2023-05-03', token:process.env.SANITY_API_TOKEN, useCdn:false });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = new Database(process.env.CORPUS_DB || './corpus/products.db', { readonly:true });
const MODEL = 'claude-opus-4-8';

// catálogo con datos duros + code
const cat = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "slug":slug.current, title, "url":getYourGuideUrl, "price":tourInfo.price, "rating":getYourGuideData.rating, "reviews":getYourGuideData.reviewCount }`);
const bySlug = Object.fromEntries(cat.map(t=>[t.slug,t]));
const codeOf = u => (String(u||'').match(/d\d+-([0-9A-Za-z_]+)/)||[])[1] || null;
const getDur = db.prepare('SELECT duration FROM products WHERE product_code = ?');

// candidatos por nombre (>=2 tokens) para una oración
const STOP=new Set(['from','with','tour','tours','vegas','las','the','and','day','trip','small','group','hour','hours','your','this','that','for','per','person']);
const toks=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3&&!STOP.has(w));
const catTok=cat.map(t=>({...t,tk:toks(t.title)}));
function cands(snip,pagina){ const low=snip.toLowerCase(); return catTok.filter(t=>t.slug!==pagina && t.tk.length && t.tk.filter(x=>low.includes(x)).length>=2); }

// las 281 ambiguas
const all = JSON.parse(fs.readFileSync('_ajenos-validados.json','utf8'));
let amb = all.filter(r=>r.estado==='TITULO-SIN-PRECIO-CONFIRM');
if(LIMIT) amb = amb.slice(0, Number(LIMIT));
console.log(`Ambiguas a resolver: ${amb.length}${DRY?' (DRY: muestra 5 prompts, no llama IA)':''}\n`);

function buildPrompt(r, cs){
  const lista = cs.map((t,i)=>{
    const dur = getDur.get(codeOf(t.url))?.duration || 's/d';
    return `${i+1}. slug:${t.slug} | título:"${t.title}" | precio:$${t.price} | rating:${t.rating} | reviews:${t.reviews} | duración:${dur}`;
  }).join('\n');
  return `Una oración de una página de tours cita OTRO tour. Identificá cuál de los candidatos es el citado, comparando lo que la oración dice (precio, rating, duración, nombre) contra los datos de cada candidato.

ORACIÓN: "${r.oracion}"
VALOR MENCIONADO: ${r.valor}

CANDIDATOS:
${lista}

Respondé SOLO con el número del candidato correcto (1, 2, 3...) o "0" si ninguno coincide claramente. Nada más.`;
}

const out=[];
let resueltos=0, ninguno=0;
for(let i=0;i<amb.length;i++){
  const r=amb[i];
  const cs=cands(r.oracion, r.pagina);
  if(cs.length===0){ out.push({...r, ia:'sin-candidatos', id:null}); continue; }
  if(DRY){ if(i<5){ console.log('--- PROMPT '+(i+1)+' ---'); console.log(buildPrompt(r,cs)); console.log(''); } continue; }
  try{
    const msg = await anthropic.messages.create({ model:MODEL, max_tokens:10, messages:[{role:'user',content:buildPrompt(r,cs)}] });
    const ans = (msg.content[0].text||'').trim();
    const n = parseInt(ans,10);
    if(n>=1 && n<=cs.length){
      const pick=cs[n-1];
      // verificación por precio
      const v=parseFloat(String(r.valor).replace(/[^\d.]/g,''));
      const ok = Math.abs(v-Number(pick.price))<0.01 || v===Math.floor(Number(pick.price));
      out.push({...r, id:pick.slug, code:codeOf(pick.url), precioVerifica:ok});
      resueltos++;
    } else { out.push({...r, ia:'ninguno', id:null}); ninguno++; }
  }catch(e){ out.push({...r, ia:'error:'+e.message, id:null}); }
  if((i+1)%25===0) console.log(`  ${i+1}/${amb.length}...`);
}

if(!DRY){
  console.log(`\nResueltos: ${resueltos} | Ninguno: ${ninguno}`);
  const verif = out.filter(o=>o.id && o.precioVerifica).length;
  const noVerif = out.filter(o=>o.id && o.precioVerifica===false).length;
  console.log(`  con precio que verifica: ${verif} | id pero precio NO verifica (revisar): ${noVerif}`);
  fs.writeFileSync('_ambiguas-resueltas.json', JSON.stringify(out,null,2),'utf8');
  console.log('-> _ambiguas-resueltas.json');
}
db.close();
