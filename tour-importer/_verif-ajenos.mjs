import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const paginas = [
  ["black-canyon-river-float-colorado-adventure","139.99"],
  ["downtown-vegas-segway-food-tour-hidden-eats-tastings","139.99"],
  ["private-hoover-dam-interior-vegas-city-tour","109.99"],
  ["sunset-grand-canyon-heli-tour-with-strip-flyover","505.25"],
  ["red-rock-canyon-sunset-heli-flight-with-champagne-landing","505.25"],
];
for(const [slug, val] of paginas){
  const d = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ "price":tourInfo.price, body }`, { s: slug });
  console.log(`\n### ${slug} (propio ${d.price}) — busco "${val}" que quedó escrito`);
  for(const b of (d.body||[])) for(const c of (b.children||[])){
    const t = c.text||"";
    if(t.includes(val)){
      // mostrar el contexto alrededor de cada aparición
      let idx = t.indexOf(val);
      while(idx!==-1){
        console.log(`   ..."${t.slice(Math.max(0,idx-55), idx+15)}"...`);
        idx = t.indexOf(val, idx+1);
      }
    }
  }
}
