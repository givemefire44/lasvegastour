import fs from "fs";
import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const cat = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "slug":slug.current, title, "price":tourInfo.price }`);
const map = JSON.parse(fs.readFileSync("_mapa-maestro.json","utf8"));
const ajenos = map.filter(r=>r.tipo!=="PROPIO");

const STOP=new Set(["from","with","tour","tours","vegas","las","the","and","day","trip","small","group","hour","hours","your","this","that","for","per","person"]);
const toks=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(w=>w.length>3&&!STOP.has(w));
const catTok=cat.map(t=>({...t,tk:toks(t.title)}));
const norm=m=>parseFloat(String(m).replace(/[^\d.]/g,""));

const asignados=[];
for(const r of ajenos){
  const low=r.oracion.toLowerCase();
  const v=norm(r.valor);
  // nombre: tours cuyos tokens de titulo (>=2) estan en la oracion
  const porNombre=catTok.filter(t=>t.slug!==r.pagina && t.tk.length && t.tk.filter(x=>low.includes(x)).length>=2);
  // nombre + precio: de esos, los que ademas matchean el precio
  const cierra=porNombre.filter(t=>Math.abs(v-Number(t.price))<0.01 || v===Math.floor(Number(t.price)));
  if(cierra.length===1){
    asignados.push({ precio:r.valor, url:cierra[0].slug, pagina:r.pagina, seccion:r.seccion, oracion:r.oracion.slice(0,110) });
  }
}

console.log(`Precios ajenos con URL de origen asignada (nombre+precio cierran a 1): ${asignados.length}\n`);
asignados.slice(0,40).forEach((a,i)=>console.log(`${i+1}. [${a.precio}] en ${a.pagina} => ${a.url}`));
fs.writeFileSync("_ajenos-mapa.json", JSON.stringify(asignados,null,2),"utf8");
console.log(`\n-> _ajenos-mapa.json (${asignados.length} ajenos con su URL exacta)`);
