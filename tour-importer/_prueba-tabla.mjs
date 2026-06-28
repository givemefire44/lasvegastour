import fs from "fs";
import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

// EXACTA misma query del injector (fetchAlternatives) + slug para cruzar
async function fetchAlternatives(cat, slug){
  return await sanity.fetch(`
    *[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{
      "slug":slug.current, title, "price":tourInfo.price
    }`, { cat, slug });
}

// los tours con su categoría
const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl)]{ "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price }`);
const bySlug = Object.fromEntries(tours.map(t=>[t.slug,t]));

// menciones ajenas del mapa
const map = JSON.parse(fs.readFileSync("_mapa-maestro.json","utf8"));
const ajenos = map.filter(r=>r.tipo!=="PROPIO");
const norm = m => parseFloat(String(m).replace(/[^\d.]/g,""));

// muestra: 8 páginas distintas que tienen ajenos
const paginasConAjenos = [...new Set(ajenos.map(a=>a.pagina))].slice(0,8);

let totalAjenos=0, enTabla=0, fueraTabla=0;
const fuera=[];
for(const slug of paginasConAjenos){
  const t = bySlug[slug];
  if(!t || !t.cat) continue;
  const alts = await fetchAlternatives(t.cat, slug);
  const preciosTabla = alts.map(a=>Number(a.price));
  const ajenosDeEsta = ajenos.filter(a=>a.pagina===slug);
  console.log(`\n### ${slug} (cat: ${t.cat})`);
  console.log(`   TABLA (alternatives): ${alts.map(a=>`${a.slug}($${a.price})`).join(', ')}`);
  for(const a of ajenosDeEsta){
    const v = norm(a.valor);
    const match = preciosTabla.some(p=>Math.abs(v-p)<0.01 || v===Math.floor(p));
    totalAjenos++;
    if(match) enTabla++; else { fueraTabla++; if(fuera.length<20) fuera.push(`${slug}: [${a.valor}] "${a.oracion.slice(0,70)}"`); }
  }
}

console.log(`\n\n=== RESULTADO (muestra ${paginasConAjenos.length} páginas) ===`);
console.log(`Ajenos cuyo precio ESTÁ en la tabla:    ${enTabla}`);
console.log(`Ajenos cuyo precio NO está en la tabla: ${fueraTabla}`);
console.log(`Total ajenos en la muestra:             ${totalAjenos}`);
console.log(`\n--- los que NO están en la tabla (revisar qué son) ---`);
fuera.forEach(f=>console.log("  "+f));
