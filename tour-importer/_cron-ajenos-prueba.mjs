import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const slug = (process.argv.find(a=>a.startsWith("--slug="))||"").split("=")[1];
const nuevo = (process.argv.find(a=>a.startsWith("--nuevo="))||"").split("=")[1];
if(!slug || !nuevo){ console.log("Uso: --slug=X --nuevo=PRECIO"); process.exit(0); }
const newPrice = Number(nuevo);

// datos del tour que cambia
const X = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price }`, { s: slug });
const oldPrice = Number(X.price);
console.log(`Tour que cambia: ${slug}  ($${oldPrice} -> $${newPrice}), cat=${X.cat}\n`);

// la misma query fetchAlternatives: para CADA página de su categoría, ¿X está en su top-4?
const mismaCategoria = await sanity.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && defined(tourInfo.price)]{ "slug":slug.current, body }`,
  { cat: X.cat }
);

async function tablaDe(pageSlug){
  return await sanity.fetch(
    `*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current }`,
    { cat: X.cat, slug: pageSlug }
  );
}

const reOld = new RegExp(`(\\$|USD )${String(oldPrice).replace(".","\\.")}(?![\\d])`, "g");
const newStr = String(newPrice);

let paginasQueCitan = 0, lugaresReemplazo = 0;
for(const pg of mismaCategoria){
  if(pg.slug === slug) continue;
  const tabla = await tablaDe(pg.slug);
  const citaAX = tabla.some(t=>t.slug===slug);
  if(!citaAX) continue;        // esta página NO tiene a X en su tabla -> no lo cita
  paginasQueCitan++;
  // en su prosa, buscar el precio viejo de X
  let hits = [];
  for(const block of (pg.body||[])){
    for(const child of (block.children||[])){
      const t = child.text||"";
      if(reOld.test(t)){ hits.push(t.slice(0,90)); }
    }
  }
  if(hits.length){
    console.log(`### ${pg.slug} (cita a X)`);
    hits.forEach(h=>{ lugaresReemplazo++; console.log(`   $${oldPrice}->$${newStr}:  "${h}"`); });
  } else {
    console.log(`### ${pg.slug} (cita a X en tabla, pero NO menciona $${oldPrice} en prosa)`);
  }
}
console.log(`\n=== ${paginasQueCitan} páginas citan a X | ${lugaresReemplazo} lugares de prosa a reemplazar. DRY, nada escrito. ===`);
