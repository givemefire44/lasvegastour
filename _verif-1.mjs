import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const d = await sanity.fetch(`*[_type=="post" && slug.current=="red-rock-canyon-heli-tour-with-landing-champagne" && !(_id in path("drafts.**"))][0]{ "price":tourInfo.price, body }`);
console.log("estructurado:", d.price);
for(const b of (d.body||[])) for(const c of (b.children||[])) if((c.text||"").includes("257")) console.log("  ->", c.text.slice(0,90));
