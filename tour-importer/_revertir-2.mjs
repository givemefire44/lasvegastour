import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const APPLY = process.argv.includes("--apply");

// revertir: estas 2 páginas tienen su PRECIO PROPIO pisado por error. Volver 139.99 -> su propio.
const FIX = [
  ["black-canyon-river-float-colorado-adventure", "139.99", "140"],
  ["downtown-vegas-segway-food-tour-hidden-eats-tastings", "139.99", "139"],
];
for(const [slug, malo, bueno] of FIX){
  const d = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ _id, "price":tourInfo.price, body }`, { s: slug });
  // OJO: solo revertir donde el contexto es PROPIO (per person, base price, header con 💰). NO tocar citas ajenas reales si las hubiera.
  const re = new RegExp(`(\\$|USD )${malo.replace(".","\\.")}(?![\\d])`, "g");
  let n=0;
  const newBody = (d.body||[]).map(b=>{
    if(!b.children) return b;
    const ch = b.children.map(c=>{
      if(typeof c.text!=="string" || !re.test(c.text)) return c;
      n++; return {...c, text: c.text.replace(re, (m,pref)=>`${pref}${bueno}`)};
    });
    return {...b, children: ch};
  });
  console.log(`${slug}: revertir $${malo} -> $${bueno}  (${n} lugares)`);
  if(APPLY){ await sanity.patch(d._id).set({ body:newBody }).commit(); console.log("   ✓ REVERTIDO"); }
}
console.log(`\n=== ${APPLY?"REVERTIDO":"DRY"} ===`);
if(!APPLY) console.log("Aplicar: node _revertir-2.mjs --apply");
