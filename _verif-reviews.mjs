import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const d = await sanity.fetch(`*[_type=="post" && slug.current=="grand-canyon-helicopter-landing-tour-from-las-vegas" && !(_id in path("drafts.**"))][0]{ "rating":getYourGuideData.rating, "reviews":getYourGuideData.reviewCount, body }`);
console.log("estructurado: rating", d.rating, "| reviews", d.reviews);
for(const b of (d.body||[])) for(const c of (b.children||[])){ const t=c.text||""; if(t.includes("2645")||t.includes("2640")) console.log("  prosa:", t.slice(0,90)); }
