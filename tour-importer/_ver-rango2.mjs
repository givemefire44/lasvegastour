import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const d = await sanity.fetch(`*[_type=="post" && slug.current=="valley-of-fire-small-group-day-trip-from-las-vegas" && !(_id in path("drafts.**"))][0]{ "price":tourInfo.price, body }`);
console.log("propio:", d.price, "\n");
// reconstruir el texto de cada bloque entero (juntando sus children) y mostrar el que tenga 25-38
for(const b of (d.body||[])){
  const full = (b.children||[]).map(c=>c.text||"").join("");
  if(full.includes("25-38") || full.includes("save")){ console.log("BLOQUE: \""+full.slice(0,300)+"\"\n"); }
}
