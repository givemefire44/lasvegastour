import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const APPLY = process.argv.includes("--apply");
const ONLY = (process.argv.find(a=>a.startsWith("--slug="))||"").split("=")[1];

let docs = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ _id, "slug":slug.current, "price":tourInfo.price, body }`);
if(ONLY) docs = docs.filter(d=>d.slug===ONLY);

let toursTocados=0;
for(const d of docs){
  const p = Number(d.price);
  if(Number.isInteger(p)) continue;
  const exact = String(p), floor = Math.floor(p), round = Math.round(p);
  let cambio = null;
  const newBody = (d.body||[]).map(block=>{
    if(!block.children) return block;
    const ch = block.children.map(child=>{
      if(typeof child.text!=="string" || !child.text.includes("💰")) return child; // SOLO header
      let out = child.text;
      for(const ent of new Set([floor, round])){
        if(ent === Number(exact)) continue;
        const re = new RegExp(`(💰\\s*\\$)${ent}(?![\\d.])`); // solo el nº tras 💰$
        if(re.test(out)){ out = out.replace(re, `$1${exact}`); cambio = `$${ent}→$${exact}`; }
      }
      return out!==child.text ? {...child, text: out} : child;
    });
    return {...block, children: ch};
  });
  if(cambio){
    toursTocados++;
    console.log(`${d.slug}: header ${cambio}`);
    if(APPLY){ await sanity.patch(d._id).set({ body: newBody }).commit(); console.log(`   ✓ APLICADO`); }
  }
}
console.log(`\n=== ${APPLY?"APLICADO":"DRY-RUN"}: ${toursTocados} headers ===`);
if(!APPLY) console.log("Aplicar a 1: node _normalizar-headers.mjs --apply --slug=red-rock-canyon-heli-tour-with-landing-champagne");
