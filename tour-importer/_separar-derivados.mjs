import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price, body }`);
async function tablaDe(slug,cat){ return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, "price":tourInfo.price }`,{cat,slug}); }
const reDeriv = /\$(\d+(?:\.\d+)?)\s+(more|less)\b|save\s+\$(\d+(?:\.\d+)?)/gi;

let exactoOk=0, colisionOk=0, recalcular=0;
const ejRecalc=[];
for(const t of tours){
  if(!t.cat) continue;
  const txt=(t.body||[]).flatMap(b=>(b.children||[]).map(c=>c.text||"")).join(" ");
  let m, found=[];
  while((m=reDeriv.exec(txt))!==null){ const n=Number(m[1]||m[3]); const ctx=txt.slice(Math.max(0,m.index-25),m.index+65); found.push({n,ctx}); }
  if(!found.length) continue;
  const tabla=await tablaDe(t.slug,t.cat);
  const propio=Number(t.price);
  for(const d of found){
    const exact = tabla.filter(a=>Math.abs(Math.abs(propio-Number(a.price))-d.n)<0.01);
    if(exact.length===1){ exactoOk++; }
    else if(exact.length>1){ colisionOk++; }       // resta exacta pero 2 comparados iguales
    else {
      // ninguno da exacto: ¿hay alguno cuya resta REDONDEADA daría N? (descalzado por decimal)
      const cerca = tabla.filter(a=>Math.abs(Math.abs(propio-Number(a.price))-d.n)<1);
      if(cerca.length){ recalcular++; const dif=Math.abs(propio-Number(cerca[0].price)); if(ejRecalc.length<20) ejRecalc.push(`${t.slug}: dice "$${d.n}" pero ${propio}-${cerca[0].price}=${dif.toFixed(2)} (${cerca[0].slug}) -> "${d.ctx.slice(0,50)}"`); }
    }
  }
}
console.log("=== Derivados descalzados: separación ===");
console.log("RESTA EXACTA, 1 comparado (OK):        "+exactoOk);
console.log("RESTA EXACTA, colisión (OK, desambig): "+colisionOk);
console.log("RECALCULAR (resta cambió por decimal): "+recalcular+"\n");
console.log("--- los que hay que RECALCULAR ---");
ejRecalc.forEach(e=>console.log("  "+e));
