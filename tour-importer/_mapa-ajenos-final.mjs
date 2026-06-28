import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
import fs from "fs";

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, title, "cat":category->slug.current, "price":tourInfo.price, body }`);
async function tablaDe(slug,cat){ return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, title, "price":tourInfo.price }`,{cat,slug}); }

const STOP=new Set(["from","with","tour","tours","vegas","las","the","and","day","trip","small","group","hour","hours","your","this","that","for","per","person"]);
const toks=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>3&&!STOP.has(w));
const norm=m=>parseFloat(String(m).replace(/[^\d.]/g,""));
const DERIV=/\b(more|less|than|save|saving|under|undercut|cheaper)\b/i;

// detectar montos en prosa que NO son el propio
let mapeados=[], sinNombre=[];
for(const t of tours){
  if(!t.cat) continue;
  const tabla = await tablaDe(t.slug, t.cat);
  const propio = Number(t.price);
  const tablaTok = tabla.map(a=>({...a, tk: toks(a.title)}));
  for(const block of (t.body||[])){
    for(const child of (block.children||[])){
      const txt = child.text||"";
      if(txt.includes("💰")) continue;
      const low = txt.toLowerCase();
      // montos $X o USD X en esta oración
      const montos = [...txt.matchAll(/(?:\$|USD )(\d+(?:\.\d+)?)/g)].map(m=>norm(m[1]));
      for(const v of montos){
        if(Math.abs(v-propio)<0.01) continue;           // propio, saltar
        if(DERIV.test(txt)) continue;                    // derivado, saltar (aparte)
        // candidatos de la tabla cuyo NOMBRE aparece en la oración
        const porNombre = tablaTok.filter(a=>a.tk.length && a.tk.filter(x=>low.includes(x)).length>=2);
        // de esos, el que el precio confirma
        const confirm = porNombre.filter(a=>Math.abs(v-Number(a.price))<0.01 || v===Math.floor(Number(a.price)));
        if(confirm.length===1){ mapeados.push({ pagina:t.slug, valor:v, url:confirm[0].slug, exact:confirm[0].price, oracion:txt.slice(0,90) }); }
        else { sinNombre.push({ pagina:t.slug, valor:v, cands:porNombre.map(a=>a.slug), oracion:txt.slice(0,90) }); }
      }
    }
  }
}
// dedupe mapeados por pagina+valor+url
const key=x=>`${x.pagina}|${x.valor}|${x.url}`;
const uniq=[...new Map(mapeados.map(m=>[key(m),m])).values()];

console.log(`=== MAPA AJENOS (por nombre+tabla, error 0) ===`);
console.log(`Mapeados (nombre identifica + precio confirma): ${uniq.length}`);
console.log(`Sin identificar por nombre:                     ${sinNombre.length}\n`);
console.log("--- muestra MAPEADOS ---");
uniq.slice(0,20).forEach(m=>console.log(`  ${m.pagina}: $${m.valor} => ${m.url} (exacto ${m.exact})`));
fs.writeFileSync("_mapa-ajenos-final.json", JSON.stringify(uniq,null,2),"utf8");
console.log(`\n-> _mapa-ajenos-final.json (${uniq.length})`);
