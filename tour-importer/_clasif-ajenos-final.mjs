import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price, body }`);
async function tablaDe(slug,cat){ return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, "price":tourInfo.price }`,{cat,slug}); }
const norm=m=>parseFloat(String(m).replace(/[^\d.]/g,""));
const DERIV=/\b(more|less|than|save|saving|under|undercut|cheaper)\b/i;
const ADDON=/\b(admission|fee|permit|parking|deposit|rental|gratuity|tip|entrance|pass|value)\b/i;

let enTabla=0, fueraTabla=0, derivCont=0, addonCont=0;
const ejEnTabla=[], ejFuera=[];
for(const t of tours){
  if(!t.cat) continue;
  const tabla = await tablaDe(t.slug, t.cat);
  const preciosTabla = tabla.map(a=>Number(a.price));
  const propio = Number(t.price);
  for(const block of (t.body||[])){
    for(const child of (block.children||[])){
      const txt=child.text||""; if(txt.includes("💰")) continue;
      const montos=[...txt.matchAll(/(?:\$|USD )(\d+(?:\.\d+)?)/g)].map(m=>norm(m[1]));
      for(const v of montos){
        if(Math.abs(v-propio)<0.01) continue;
        const esDeriv=DERIV.test(txt), esAddon=ADDON.test(txt);
        // ¿el monto está en la tabla (es un tour comparado)?
        const inTabla = preciosTabla.some(p=>Math.abs(v-p)<0.01||v===Math.floor(p));
        if(esDeriv){ derivCont++; continue; }
        if(esAddon){ addonCont++; continue; }
        if(inTabla){ enTabla++; if(ejEnTabla.length<12) ejEnTabla.push(`${t.slug}: $${v}  "${txt.slice(0,75)}"`); }
        else { fueraTabla++; if(ejFuera.length<12) ejFuera.push(`${t.slug}: $${v}  "${txt.slice(0,75)}"`); }
      }
    }
  }
}
console.log(`=== Clasificación de los montos ajenos (no propios) ===`);
console.log(`DERIVADOS (more/less/under): ${derivCont}`);
console.log(`ADD-ONS (fee/parking/admission): ${addonCont}`);
console.log(`EN TABLA (cita de tour, valor coincide con tabla): ${enTabla}`);
console.log(`FUERA TABLA (no es tour comparado): ${fueraTabla}\n`);
console.log("--- ej EN TABLA (citas reales, precio coincide) ---"); ejEnTabla.forEach(e=>console.log("  "+e));
console.log("\n--- ej FUERA TABLA ---"); ejFuera.forEach(e=>console.log("  "+e));
