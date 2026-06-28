import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "cat":category->slug.current }`);

async function tablaDe(slug, cat){
  return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "price":tourInfo.price }`, { cat, slug });
}
// colisión = dos precios de la tabla que, redondeados al entero, coinciden (porque en prosa el ajeno aparece como entero)
function hayColision(precios){
  const ent = precios.map(p=>Math.floor(Number(p)));
  return new Set(ent).size !== ent.length;
}

let unicas=0, colision=0;
const ejColision=[];
for(const t of tours){
  if(!t.cat) continue;
  const tabla = await tablaDe(t.slug, t.cat);
  if(tabla.length<2) continue;
  if(hayColision(tabla.map(x=>x.price))){ colision++; if(ejColision.length<12) ejColision.push(`${t.slug}: tabla precios [${tabla.map(x=>x.price).join(", ")}]`); }
  else unicas++;
}
console.log(`=== Colisión de precio DENTRO de la tabla (los 4) ===`);
console.log(`Páginas con 4 precios distintos (alinear por precio SEGURO): ${unicas}`);
console.log(`Páginas con 2+ mismo precio en la tabla (necesitan nombre):  ${colision}`);
console.log(`\n--- ejemplos de colisión ---`);
ejColision.forEach(e=>console.log("  "+e));
