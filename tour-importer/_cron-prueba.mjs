import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const slug = (process.argv.find(a=>a.startsWith("--slug="))||"").split("=")[1];
const nuevo = (process.argv.find(a=>a.startsWith("--nuevo="))||"").split("=")[1];
const EXEC = process.argv.includes("--execute");
if(!slug || !nuevo){ console.log("Uso: --slug=X --nuevo=PRECIO [--execute]"); process.exit(0); }
const newPrice = Number(nuevo);

const d = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ _id, "price":tourInfo.price, body }`, { s: slug });
if(!d){ console.log("No encontrado"); process.exit(0); }
const oldPrice = Number(d.price);

console.log(`${EXEC?"=== EXECUTE (escribe) ===":"=== DRY ==="}`);
console.log(`${slug}: estructurado ${oldPrice} -> ${newPrice}\n`);

const reOld = new RegExp(`(\\$|USD )${String(oldPrice).replace(".","\\.")}(?![\\d])`, "g");
const newStr = String(newPrice);
let changes = 0;
const newBody = (d.body||[]).map(block=>{
  if(!block.children) return block;
  const ch = block.children.map(child=>{
    if(typeof child.text!=="string" || !reOld.test(child.text)) return child;
    changes++;
    return {...child, text: child.text.replace(reOld, (m,pref)=>`${pref}${newStr}`)};
  });
  return {...block, children: ch};
});
console.log(`Prosa: ${changes} lugar/es. Estructurado: tourInfo.price -> ${newPrice}`);

if(EXEC){
  await sanity.patch(d._id).set({ "tourInfo.price": newPrice, body: newBody }).commit();
  console.log(`\n✓ ESCRITO en Sanity`);
} else {
  console.log(`\n(dry — nada escrito)`);
}
