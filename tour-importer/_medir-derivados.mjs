import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
import fs from "fs";

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price, body }`);
async function tablaDe(slug,cat){ return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, "price":tourInfo.price }`,{cat,slug}); }

// detectar "$N more" / "$N less" / "$N more than" / "save $N"
const reDeriv = /\$(\d+(?:\.\d+)?)\s+(more|less)\b|save\s+\$(\d+(?:\.\d+)?)/gi;

let total=0, matchExacto=0, descalzado=0, ambiguo=0;
const ejMatch=[], ejDesc=[];
for(const t of tours){
  if(!t.cat) continue;
  const txt=(t.body||[]).flatMap(b=>(b.children||[]).map(c=>c.text||"")).join(" ");
  let m, found=[];
  while((m=reDeriv.exec(txt))!==null){ const n=Number(m[1]||m[3]); const ctx=txt.slice(Math.max(0,m.index-30),m.index+70); found.push({n,ctx}); }
  if(!found.length) continue;
  const tabla=await tablaDe(t.slug,t.cat);
  const propio=Number(t.price);
  for(const d of found){
    total++;
    // ¿algún comparado de la tabla da |propio - comparado| = N exacto?
    const exact = tabla.filter(a=>Math.abs(Math.abs(propio-Number(a.price))-d.n)<0.01);
    const aprox = tabla.filter(a=>Math.abs(Math.abs(propio-Number(a.price))-d.n)<2);
    if(exact.length===1){ matchExacto++; if(ejMatch.length<8) ejMatch.push(`${t.slug}: $${d.n} = |${propio}-${exact[0].price}| (${exact[0].slug})`); }
    else if(aprox.length>=1){ descalzado++; if(ejDesc.length<12) ejDesc.push(`${t.slug}: "$${d.n}" propio=${propio} cerca de ${aprox.map(a=>`${a.price}(dif ${Math.abs(propio-a.price).toFixed(2)})`).join("/")} -> "${d.ctx.slice(0,55)}"`); }
    else { ambiguo++; }
  }
}
console.log("=== DERIVADOS (con base exacta + tabla) ===");
console.log("Total detectados: "+total);
console.log("MATCH EXACTO (resta da justo, identifica comparado): "+matchExacto);
console.log("DESCALZADO (cerca pero no exacto, la resta cambió): "+descalzado);
console.log("SIN MATCH en tabla (ambiguo/no-derivado): "+ambiguo);
console.log("\n--- ej MATCH EXACTO ---"); ejMatch.forEach(e=>console.log("  "+e));
console.log("\n--- ej DESCALZADO ---"); ejDesc.forEach(e=>console.log("  "+e));
