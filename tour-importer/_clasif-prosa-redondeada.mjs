import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const docs = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "price":tourInfo.price, body }`);

const DERIV = /\b(more|less|than|save|saving|under|undercut|cheaper|extra|additional|vs\.?|compared)\b/i;

let propios=[], derivados=[];
for(const d of docs){
  const p = Number(d.price);
  if(Number.isInteger(p)) continue;
  const exact = String(p), floor = Math.floor(p), round = Math.round(p);
  for(const block of (d.body||[])){
    for(const child of (block.children||[])){
      const t = child.text || "";
      if(t.includes("💰")) continue; // saltear header (ya alineado)
      for(const ent of new Set([floor, round])){
        if(ent === Number(exact)) continue;
        const re = new RegExp(`(\\$|USD )${ent}(?![\\d.])`);
        if(re.test(t)){
          const item = { slug:d.slug, exact:p, ent, oracion:t.slice(0,120) };
          if(DERIV.test(t)) derivados.push(item); else propios.push(item);
        }
      }
    }
  }
}

console.log("=== PROPIOS en prosa (ALINEAR a exacto) ===");
propios.forEach(x=>console.log(`  ${x.slug}: $${x.ent}→$${x.exact}\n     "${x.oracion}"`));
console.log(`\n=== DERIVADOS/OTROS en prosa (DEJAR, no tocar) ===`);
derivados.forEach(x=>console.log(`  ${x.slug}: $${x.ent} (propio ${x.exact})\n     "${x.oracion}"`));
console.log(`\nPROPIOS a alinear: ${propios.length} | DERIVADOS a dejar: ${derivados.length}`);
