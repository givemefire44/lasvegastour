import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
import fs from "fs";

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "price":tourInfo.price, body }`);
const norm=m=>parseFloat(String(m).replace(/[^\d.]/g,""));

let totalPropios=0, totalAjenosCandidatos=0;
const mapa=[];
for(const t of tours){
  const propio = Number(t.price);
  let propiosEnTexto=0, ajenos=[];
  for(const block of (t.body||[])){
    for(const child of (block.children||[])){
      const txt=child.text||"";
      const montos=[...txt.matchAll(/(?:\$|USD )(\d+(?:\.\d+)?)/g)].map(m=>norm(m[1]));
      for(const v of montos){
        if(Math.abs(v-propio)<0.01 || v===Math.floor(propio)){ propiosEnTexto++; }  // PROPIO
        else { ajenos.push(v); }                                                      // candidato ajeno
      }
    }
  }
  totalPropios+=propiosEnTexto;
  totalAjenosCandidatos+=ajenos.length;
  if(ajenos.length) mapa.push({ slug:t.slug, propio, propiosEnTexto, ajenos });
}
console.log(`=== Marca de propios vs ajenos en TEXTO ===`);
console.log(`Total apariciones PROPIO en texto:        ${totalPropios}`);
console.log(`Total apariciones AJENO (candidatas):     ${totalAjenosCandidatos}`);
console.log(`Páginas con algún ajeno:                  ${mapa.length}\n`);
console.log("--- muestra (página: propio | ajenos encontrados) ---");
mapa.slice(0,15).forEach(m=>console.log(`  ${m.slug} (propio $${m.propio}): ajenos [${m.ajenos.join(", ")}]`));
fs.writeFileSync("_mapa-propios-ajenos.json", JSON.stringify(mapa,null,2),"utf8");
console.log(`\n-> _mapa-propios-ajenos.json`);
