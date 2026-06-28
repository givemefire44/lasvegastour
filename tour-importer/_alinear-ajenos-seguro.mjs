import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const APPLY = process.argv.includes("--apply");

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ _id, "slug":slug.current, "cat":category->slug.current, body }`);

async function tablaDe(slug, cat){
  return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, "price":tourInfo.price }`, { cat, slug });
}
const DERIV = /\b(more|less|than|save|saving|under|undercut|cheaper|extra|additional)\b/i;

let paginas=0, totalCambios=0;
for(const t of tours){
  if(!t.cat) continue;
  const tabla = await tablaDe(t.slug, t.cat);
  if(tabla.length<2) continue;
  // SALTAR si hay colisión de precio (entero) entre los 4
  const ent = tabla.map(x=>Math.floor(Number(x.price)));
  if(new Set(ent).size !== ent.length) continue;   // 60 colisión -> saltear

  let cambios=[];
  const newBody = (t.body||[]).map(block=>{
    if(!block.children) return block;
    const ch = block.children.map(child=>{
      let txt = child.text;
      if(typeof txt!=="string" || txt.includes("💰")) return child;
      for(const alt of tabla){
        const exact = String(alt.price);
        if(Number.isInteger(Number(exact))) continue; // si el exacto ya es entero, no hay redondeo que alinear
        const e = Math.floor(alt.price), r = Math.round(alt.price);
        for(const form of new Set([e,r])){
          if(form===Number(exact)) continue;
          const re = new RegExp(`(\\$|USD )${form}(?![\\d.])`, "g");
          txt = txt.replace(re,(m,pref,off,full)=>{ if(DERIV.test(full)) return m; cambios.push(`$${form}->$${exact}`); return `${pref}${exact}`; });
        }
      }
      return txt!==child.text ? {...child,text:txt} : child;
    });
    return {...block,children:ch};
  });
  if(cambios.length){
    paginas++; totalCambios+=cambios.length;
    console.log(`${t.slug}: ${cambios.join(", ")}`);
    if(APPLY){ await sanity.patch(t._id).set({body:newBody}).commit(); console.log("   ✓"); }
  }
}
console.log(`\n=== ${APPLY?"APLICADO":"DRY"}: ${paginas} páginas, ${totalCambios} ajenos alineados (solo tablas sin colisión) ===`);
if(!APPLY) console.log("Aplicar: node _alinear-ajenos-seguro.mjs --apply");
