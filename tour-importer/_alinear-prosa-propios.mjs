import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const APPLY = process.argv.includes("--apply");

// lista EXPLÍCITA revisada a mano (slug + entero a reemplazar). NO detector automático.
const ALINEAR = [
  ["9-hour-atv-valley-fire-dune-buggy-combo-vegas-adventure", 1158],
  ["fremont-street-bar-crawl-3-venues-drink-specials", 99],
  ["5-hour-ranch-horseback-adventure-with-breakfast-vegas", 130],
  ["red-rock-canyon-small-group-desert-tour-las-vegas", 88],
  ["red-rock-canyon-sunset-heli-flight-with-champagne-landing", 286],
  ["5-hour-wild-west-horseback-with-meal-las-vegas", 130],
  ["colorado-river-kayak-6-hot-springs-4-waterfalls", 293],
];

for(const [slug, ent] of ALINEAR){
  const d = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ _id, "price":tourInfo.price, body }`, { s: slug });
  if(!d){ console.log(`${slug}: NO ENCONTRADO`); continue; }
  const exact = String(d.price);
  const re = new RegExp(`(\\$|USD )${ent}(?![\\d.])`, "g");
  let cambios = 0;
  const newBody = (d.body||[]).map(b=>{
    if(!b.children) return b;
    const ch = b.children.map(c=>{
      if(typeof c.text!=="string" || c.text.includes("💰")) return c; // no header
      if(re.test(c.text)){ cambios++; return {...c, text: c.text.replace(re, `$1${exact}`)}; }
      return c;
    });
    return {...b, children: ch};
  });
  console.log(`${slug}: $${ent}→$${exact}  (${cambios} cambio/s)`);
  if(APPLY && cambios){ await sanity.patch(d._id).set({ body:newBody }).commit(); console.log("   ✓ APLICADO"); }
}
console.log(`\n=== ${APPLY?"APLICADO":"DRY-RUN"} ===`);
if(!APPLY) console.log("Aplicar: node _alinear-prosa-propios.mjs --apply");
