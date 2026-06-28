import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const slugs = ["grand-canyon-helicopter-landing-tour-from-las-vegas","sunset-grand-canyon-heli-tour-with-strip-flyover","red-rock-canyon-sunset-heli-flight-with-champagne-landing","grand-canyon-heli-emerald-cave-kayak-combo-adventure"];
for(const s of slugs){
  const d = await sanity.fetch(`*[_type=="post" && slug.current==$s && !(_id in path("drafts.**"))][0]{ "price":tourInfo.price, body }`, { s });
  console.log("\n### "+s+" (estructurado: "+d.price+")");
  for(const b of (d.body||[])) for(const c of (b.children||[])){ const t=c.text||""; if(t.includes("520.5")) console.log("   520.5 -> \""+t.slice(0,75)+"\""); }
}
