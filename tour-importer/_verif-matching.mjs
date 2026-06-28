import { getProduct } from "./corpus.js";
import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });
const tours = await sanity.fetch(`*[_type=="post" && defined(tourInfo.price) && defined(getYourGuideUrl) && !(_id in path("drafts.**"))]{ "slug":slug.current, "url":getYourGuideUrl, title }`);
const norm = s => String(s||"").toLowerCase().replace(/[^a-z0-9]/g," ").split(/\s+/).filter(w=>w.length>3);
let sospechosos=0;
for(const t of tours){
  const code = (String(t.url||"").match(/d\d+-([0-9A-Za-z]+)/)||[])[1];
  if(!code) continue;
  const p = getProduct(code);
  if(!p) continue;
  // comparar si los titulos comparten palabras
  const a = new Set(norm(t.title)), b = norm(p.title);
  const comun = b.filter(w=>a.has(w)).length;
  if(comun < 2){ sospechosos++; console.log(`SOSPECHOSO ${code}: Sanity "${t.title.slice(0,40)}" vs Corpus "${(p.title||"").slice(0,40)}"`); }
}
console.log("\nTotal sospechosos (titulos no coinciden):", sospechosos);
