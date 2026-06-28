import fs from "fs";
import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const cat = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "slug":slug.current, "price":tourInfo.price }`);
const all = JSON.parse(fs.readFileSync("_ajenos-validados.json","utf8"));
const amb = all.filter(r=>r.estado==="TITULO-SIN-PRECIO-CONFIRM");
const norm = m => parseFloat(String(m).replace(/[^\d.]/g,""));
// candidatos REALES = tours cuyo precio coincide con el valor mencionado
let con1=0, con2=0, con0=0, masde3=0;
for(const r of amb){
  const v = norm(r.valor);
  const hit = cat.filter(t => Math.abs(v-Number(t.price))<0.01 || v===Math.floor(Number(t.price)));
  if(hit.length===0) con0++;
  else if(hit.length===1) con1++;
  else if(hit.length<=3) con2++;
  else masde3++;
}
console.log(`De las ${amb.length} ambiguas, cruzando SOLO por el precio mencionado:`);
console.log(`  precio matchea 1 tour:    ${con1}`);
console.log(`  precio matchea 2-3 tours: ${con2}`);
console.log(`  precio matchea 4+ tours:  ${masde3}`);
console.log(`  precio matchea 0 tours:   ${con0}`);
