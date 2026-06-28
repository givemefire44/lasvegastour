import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const APPLY = process.argv.includes("--apply");

const slug = "red-rock-canyon-electric-scooter-adventure-las-vegas";
const d = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ _id, body }`, { s: slug });
// reemplazar "$26 less" por "$25 less" (el derivado del valley-of-fire). Solo en contexto "less"/"more" para no tocar otro $26.
let n=0;
const nb = (d.body||[]).map(b=>{
  if(!b.children) return b;
  return {...b, children: b.children.map(c=>{
    if(typeof c.text!=="string") return c;
    if(/\$26\s+(less|more)/.test(c.text)){ n++; return {...c, text: c.text.replace(/\$26(\s+(?:less|more))/, "$25$1")}; }
    return c;
  })};
});
console.log(`${slug}: $26->$25 en contexto derivado (${n} lugares)`);
if(APPLY && n){ await sanity.patch(d._id).set({ body: nb }).commit(); console.log("   ✓ aplicado"); }
console.log(APPLY?"APLICADO":"DRY — aplicar: node _fix-scooter-deriv.mjs --apply");
