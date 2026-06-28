import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const docs = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "price":tourInfo.price, body }`);

function textOf(body){ return (body||[]).flatMap(b=>(b.children||[]).map(c=>c.text||"")).join(" "); }

let soloExacto=0, soloRedondeado=0, mixto=0, ninguno=0, sinDecimal=0;
const ejMixto=[], ejRedondeado=[];

for(const d of docs){
  const p = Number(d.price);
  const txt = textOf(d.body);
  const esEntero = Number.isInteger(p);
  if(esEntero){ sinDecimal++; continue; } // precios enteros: exacto=redondeado, no aplica

  const ent = Math.floor(p);
  // exacto: "505.25" presente ; redondeado: "505" presente pero NO como parte de "505.25"
  const hayExacto = txt.includes(String(p));               // 505.25
  // redondeado = el entero con $ o USD, no seguido de "."
  const reRed = new RegExp(`(\\$|USD )${ent}(?![\\d.])`);
  const hayRedondeado = reRed.test(txt);

  if(hayExacto && !hayRedondeado) soloExacto++;
  else if(!hayExacto && hayRedondeado){ soloRedondeado++; if(ejRedondeado.length<10) ejRedondeado.push(`${d.slug} (${p}): prosa usa $${ent}`); }
  else if(hayExacto && hayRedondeado){ mixto++; if(ejMixto.length<10) ejMixto.push(`${d.slug} (${p}): prosa tiene AMBOS $${p} y $${ent}`); }
  else ninguno++;
}

console.log(`=== Consistencia prosa vs estructurado (solo precios con decimal) ===`);
console.log(`Tours con precio DECIMAL: ${docs.length - sinDecimal} (de ${docs.length})`);
console.log(`  SOLO EXACTO (prosa=505.25, estable):     ${soloExacto}`);
console.log(`  SOLO REDONDEADO (prosa=505, Claude redondeó): ${soloRedondeado}`);
console.log(`  MIXTO (prosa tiene 505.25 Y 505):        ${mixto}`);
console.log(`  NINGUNO (precio no aparece en prosa):     ${ninguno}`);
console.log(`Tours con precio ENTERO (no aplica decimal): ${sinDecimal}`);
console.log(`\n--- ej SOLO REDONDEADO ---`); ejRedondeado.forEach(e=>console.log("  "+e));
console.log(`\n--- ej MIXTO ---`); ejMixto.forEach(e=>console.log("  "+e));
