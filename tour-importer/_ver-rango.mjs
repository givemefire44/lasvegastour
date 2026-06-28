import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const d = await sanity.fetch(`*[_type=="post" && slug.current=="valley-of-fire-small-group-day-trip-from-las-vegas" && !(_id in path("drafts.**"))][0]{ "price":tourInfo.price, body }`);
console.log("propio:", d.price);
for(const b of (d.body||[])) for(const c of (b.children||[])){ const t=c.text||""; if(t.includes("25-38")||t.includes("$25")||t.includes("$38")) console.log("  \""+t.slice(0,160)+"\""); }
