import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

for(const slug of ["black-canyon-river-float-colorado-adventure","downtown-vegas-segway-food-tour-hidden-eats-tastings"]){
  const d = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ "price":tourInfo.price, body }`, { s: slug });
  console.log(`\n### ${slug} (propio real ${d.price})`);
  let i=0;
  for(const b of (d.body||[])) for(const c of (b.children||[])){
    const t = c.text||"";
    let idx = t.indexOf("139.99");
    while(idx!==-1){
      i++;
      console.log(`  ${i}. "...${t.slice(Math.max(0,idx-70), idx+25)}..."`);
      idx = t.indexOf("139.99", idx+1);
    }
  }
}
