import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
import fs from "fs";

const tours = await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && defined(getYourGuideUrl) && defined(tourInfo.price)]{ "slug":slug.current, "cat":category->slug.current, "price":tourInfo.price, body }`);
async function tablaDe(slug,cat){ return await sanity.fetch(`*[_type=="post" && !(_id in path("drafts.**")) && category->slug.current==$cat && slug.current!=$slug && defined(tourInfo.price)] | order(getYourGuideData.reviewCount desc)[0...4]{ "slug":slug.current, "price":tourInfo.price }`,{cat,slug}); }
const norm=m=>parseFloat(String(m).replace(/[^\d.]/g,""));

let enTabla=0, colision=0, fueraTabla=0;
const paraAlinear=[];
for(const t of tours){
  if(!t.cat) continue;
  const propio = Number(t.price);
  const tabla = await tablaDe(t.slug, t.cat);
  for(const block of (t.body||[])){
    for(const child of (block.children||[])){
      const txt=child.text||"";
      const montos=[...txt.matchAll(/(?:\$|USD )(\d+(?:\.\d+)?)/g)].map(m=>norm(m[1]));
      for(const v of montos){
        if(Math.abs(v-propio)<0.01 || v===Math.floor(propio)) continue;
        const hits = tabla.filter(a=>Math.abs(v-Number(a.price))<0.01 || v===Math.floor(Number(a.price)));
        if(hits.length===1){ enTabla++; paraAlinear.push({ pagina:t.slug, valorEnTexto:v, exacto:hits[0].price, url:hits[0].slug }); }
        else if(hits.length>1){ colision++; }
        else { fueraTabla++; }
      }
    }
  }
}
console.log("EN TABLA (ajenos a alinear): "+enTabla);
console.log("COLISION (2 mismo precio): "+colision);
console.log("FUERA tabla (no tocar): "+fueraTabla);
const k=x=>x.pagina+"|"+x.valorEnTexto+"|"+x.url;
const uniq=[...new Map(paraAlinear.map(m=>[k(m),m])).values()];
console.log("\nUnicos a alinear: "+uniq.length);
uniq.slice(0,18).forEach(m=>console.log("  "+m.pagina+": $"+m.valorEnTexto+" -> $"+m.exacto+" ("+m.url+")"));
fs.writeFileSync("_ajenos-a-alinear.json", JSON.stringify(uniq,null,2),"utf8");
console.log("\n-> _ajenos-a-alinear.json");
