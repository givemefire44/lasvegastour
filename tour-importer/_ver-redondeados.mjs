import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const docs = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "price":tourInfo.price, body }`);

let total=0;
for(const d of docs){
  const p = Number(d.price);
  if(Number.isInteger(p)) continue;
  const ent = Math.floor(p);
  // redondeado presente y NO parte del exacto
  const reRed = new RegExp(`(\\$|USD )${ent}(?![\\d.])`);
  const txt = (d.body||[]).flatMap(b=>(b.children||[]).map(c=>c.text||"")).join(" ");
  if(!reRed.test(txt)) continue;

  console.log(`\n### ${d.slug}  (estructurado: ${p}, redondeado en prosa: ${ent})`);
  let i=0;
  for(const block of (d.body||[])){
    const style = block.style || block._type;
    for(const child of (block.children||[])){
      const t = child.text || "";
      if(reRed.test(t)){
        i++; total++;
        // marcar dónde está el redondeado
        console.log(`   [${style}] "${t.slice(0,150)}"`);
      }
    }
  }
}
console.log(`\n=== TOTAL apariciones redondeadas a normalizar: ${total} ===`);
