import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const slug = (process.argv.find(a=>a.startsWith("--slug="))||"").split("=")[1];
const nuevo = (process.argv.find(a=>a.startsWith("--nuevo="))||"").split("=")[1];
const EXEC = process.argv.includes("--execute");
if(!slug||!nuevo){ console.log("Uso: --slug=X --nuevo=PRECIO [--execute]"); process.exit(0); }
const newPrice = Number(nuevo);

const X = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ _id, "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price, body }`, { s: slug });
const oldPrice = Number(X.price);
const reOld = new RegExp("(\\$|USD )"+String(oldPrice).replace(".","\\.")+"(?![\\d])","g");
const newStr = String(newPrice);

console.log("CRON "+(EXEC?"EXECUTE":"DRY")+" | "+slug+" : "+oldPrice+" -> "+newPrice+"\n");

// (1) PROPIO: estructurado + prosa de su pagina
let p=0;
const newBodyX = (X.body||[]).map(b=>{
  if(!b.children) return b;
  return {...b, children: b.children.map(c=>{
    if(typeof c.text==="string" && reOld.test(c.text)){ p++; return {...c, text:c.text.replace(reOld,(m,pre)=>pre+newStr)}; }
    return c;
  })};
});
console.log(">>> PROPIO: "+p+" lugares en prosa + estructurado");
if(EXEC){ await sanity.patch(X._id).set({ "tourInfo.price": newPrice, body: newBodyX }).commit(); console.log("    ✓ escrito"); }

// (2) AJENO: paginas que lo citan
const mismaCat = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)]{ _id, "slug":slug.current, body }`, { cat:X.cat, slug });
async function tablaDe(pg){ return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug2 && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current }`, { cat:X.cat, slug2:pg }); }

let citan=0;
for(const pg of mismaCat){
  const tabla = await tablaDe(pg.slug);
  if(!tabla.some(tt=>tt.slug===slug)) continue;
  let n=0;
  const nb = (pg.body||[]).map(b=>{
    if(!b.children) return b;
    return {...b, children: b.children.map(c=>{
      if(typeof c.text==="string" && reOld.test(c.text)){ n++; return {...c, text:c.text.replace(reOld,(m,pre)=>pre+newStr)}; }
      return c;
    })};
  });
  if(n){ citan++; console.log(">>> AJENO en "+pg.slug+": "+n+" lugares"); if(EXEC){ await sanity.patch(pg._id).set({ body: nb }).commit(); console.log("    ✓ escrito"); } }
}
console.log("\nTOTAL: "+p+" propios + "+citan+" paginas ajenas. "+(EXEC?"ESCRITO":"DRY"));
