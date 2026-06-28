import fs from "fs";
import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const cat = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "slug":slug.current, "price":tourInfo.price }`);
const all = JSON.parse(fs.readFileSync("_ajenos-validados.json","utf8"));
const amb = all.filter(r=>r.estado==="TITULO-SIN-PRECIO-CONFIRM");
const norm = m => parseFloat(String(m).replace(/[^\d.]/g,""));

const out=[];
for(const r of amb){
  const v = norm(r.valor);
  const hit = cat.filter(t => Math.abs(v-Number(t.price))<0.01 || v===Math.floor(Number(t.price)));
  if(hit.length===1) out.push({ valor:r.valor, pagina:r.pagina, url:hit[0].slug, oracion:r.oracion });
}
console.log(`${out.length} menciones donde el precio invoca 1 sola URL:\n`);
out.forEach((r,i)=>{
  console.log(`${i+1}. [${r.valor}] en ${r.pagina}`);
  console.log(`   URL invocada: ${r.url}`);
  console.log(`   "${r.oracion.slice(0,120)}"`);
  console.log("");
});
fs.writeFileSync("_57-precisadas.json", JSON.stringify(out,null,2),"utf8");
