import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const docs = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "price":tourInfo.price, body }`);

let headerExacto=0, headerRedondeado=0, headerOtro=0, sinHeader=0, enteros=0;
const ejExacto=[], ejRedondeado=[], ejOtro=[];

for(const d of docs){
  const p = Number(d.price);
  if(Number.isInteger(p)){ enteros++; continue; }
  const ent = Math.floor(p);
  // buscar el bloque header: el que tiene 💰
  let headerText = null;
  for(const block of (d.body||[])){
    for(const child of (block.children||[])){
      if((child.text||"").includes("💰")){ headerText = child.text; break; }
    }
    if(headerText) break;
  }
  if(!headerText){ sinHeader++; continue; }
  // qué precio muestra el header tras 💰
  const m = headerText.match(/💰\s*\$?\s*([\d.]+)/);
  const shown = m ? m[1] : null;
  if(shown === String(p)){ headerExacto++; if(ejExacto.length<5) ejExacto.push(`${d.slug}: header $${shown} (exacto)`); }
  else if(shown === String(ent)){ headerRedondeado++; if(ejRedondeado.length<5) ejRedondeado.push(`${d.slug}: header $${shown} (redondeado, real ${p})`); }
  else { headerOtro++; if(ejOtro.length<8) ejOtro.push(`${d.slug}: header muestra "${shown}" vs estructurado ${p}`); }
}

console.log(`=== Formato del HEADER en tours con precio decimal (${docs.length-enteros}) ===`);
console.log(`  Header EXACTO ($257.10):     ${headerExacto}`);
console.log(`  Header REDONDEADO ($257):    ${headerRedondeado}`);
console.log(`  Header OTRO valor (revisar): ${headerOtro}`);
console.log(`  Sin header con 💰:           ${sinHeader}`);
console.log(`  (enteros, no aplica: ${enteros})`);
console.log(`\n--- ej EXACTO ---`); ejExacto.forEach(e=>console.log("  "+e));
console.log(`\n--- ej REDONDEADO ---`); ejRedondeado.forEach(e=>console.log("  "+e));
console.log(`\n--- ej OTRO (no coincide ni exacto ni redondeado) ---`); ejOtro.forEach(e=>console.log("  "+e));
