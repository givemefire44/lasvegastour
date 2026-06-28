import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const APPLY = process.argv.includes("--apply");

// todos los tours con cat + precio
const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price, body }`);
const bySlug = Object.fromEntries(tours.map(t=>[t.slug,t]));

async function tablaDe(pageSlug, cat){
  return await sanity.fetch(
    `*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, "price":tourInfo.price }`,
    { cat, slug: pageSlug }
  );
}

const DERIV = /\b(more|less|than|save|saving|under|undercut|cheaper|extra|additional)\b/i;
let totalCambios=0, paginasTocadas=0;

for(const t of tours){
  if(!t.cat) continue;
  const tabla = await tablaDe(t.slug, t.cat);  // los 4 tours citables, con su precio exacto
  let cambios=[];
  const newBody = (t.body||[]).map(block=>{
    if(!block.children) return block;
    const ch = block.children.map(child=>{
      let txt = child.text;
      if(typeof txt!=="string" || txt.includes("💰")) return child; // no header
      // para cada tour de la tabla, alinear su precio en la prosa al exacto
      for(const alt of tabla){
        const exact = String(alt.price);
        const ent = Math.floor(alt.price);
        const round = Math.round(alt.price);
        for(const form of new Set([ent, round])){
          if(form === Number(exact)) continue;
          const re = new RegExp(`(\\$|USD )${form}(?![\\d.])`, "g");
          txt = txt.replace(re, (m, pref, off, full)=>{
            // no tocar si es un derivado (contexto comparativo en la oración)
            if(DERIV.test(full)) return m;
            cambios.push(`$${form}->$${exact} (de ${alt.slug})`);
            return `${pref}${exact}`;
          });
        }
      }
      return txt!==child.text ? {...child, text: txt} : child;
    });
    return {...block, children: ch};
  });
  if(cambios.length){
    paginasTocadas++; totalCambios+=cambios.length;
    console.log(`### ${t.slug}`);
    cambios.forEach(c=>console.log(`   ${c}`));
    if(APPLY){ await sanity.patch(bySlug[t.slug]._id||(await sanity.fetch(`*[slug.current==$s][0]._id`,{s:t.slug})) ).set({ body:newBody }).commit(); console.log("   ✓"); }
  }
}
console.log(`\n=== ${APPLY?"APLICADO":"DRY"}: ${paginasTocadas} páginas, ${totalCambios} ajenos a alinear ===`);
if(!APPLY) console.log("Aplicar: node _alinear-ajenos.mjs --apply");
