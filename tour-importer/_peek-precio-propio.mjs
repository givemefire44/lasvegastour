import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const SLUG = "grand-canyon-helicopter-landing-tour-from-las-vegas"; // propio 505.25
const doc = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ "price":tourInfo.price, body, seoDescription }`, { s: SLUG });

console.log(`PRECIO PROPIO (estructurado): ${doc.price}\n`);
console.log("=== dónde aparece el precio propio en el BODY (cualquier forma) ===\n");

// formas a buscar del precio propio
const p = doc.price;                       // 505.25
const ent = Math.floor(p);                 // 505
const formas = [String(p), `$${p}`, `USD ${p}`, String(ent), `$${ent}`, `USD ${ent}`, `${ent}.`];

let i=0;
for(const block of (doc.body||[])){
  const style = block.style || block._type || "?";
  for(const child of (block.children||[])){
    const t = child.text || "";
    // ¿menciona alguna forma del precio propio?
    if(formas.some(f => t.includes(f))){
      i++;
      console.log(`${i}. [style:${style}] marks:${JSON.stringify(child.marks||[])}`);
      console.log(`   "${t.slice(0,160)}"`);
      console.log("");
    }
  }
}
console.log(`Total apariciones del precio propio en body: ${i}`);
console.log(`\n=== seoDescription ===`);
console.log(doc.seoDescription || "(vacío)");
