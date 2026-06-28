import { getProduct } from "./corpus.js";
import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import fs from "fs";
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

const tours = await sanity.fetch(`*[_type=="post" && defined(tourInfo.price) && defined(getYourGuideUrl) && !(_id in path("drafts.**"))]{ "slug":slug.current, "url":getYourGuideUrl, "price":tourInfo.price, title }`);
const norm = s => String(s||"").toLowerCase().replace(/[^a-z0-9]/g," ").split(/\s+/).filter(w=>w.length>3);

let ok=0, sosp=0, sinCorpus=0, urlRara=0;
const filas = [["slug","code_extraido","url_tiene_guionbajo","corpus_existe","titulo_sanity","titulo_corpus","precio_sanity","precio_corpus","estado"]];

for(const t of tours){
  const rawCode = (String(t.url||"").match(/d\d+-([0-9A-Za-z_]+)/)||[])[1] || "";   // captura CON _ para ver si lo tiene
  const codeLimpio = rawCode.split("_")[0];   // sin sufijo de tracking
  const tieneGuion = rawCode.includes("_");
  const p = getProduct(codeLimpio);
  let estado;
  if(!p){ estado="SIN_CORPUS"; sinCorpus++; }
  else {
    const a = new Set(norm(t.title)), b = norm(p.title);
    const comun = b.filter(w=>a.has(w)).length;
    if(comun >= 2){ estado="OK"; ok++; }
    else { estado="SOSPECHOSO"; sosp++; }
  }
  if(tieneGuion) urlRara++;
  filas.push([t.slug, codeLimpio, tieneGuion?"SI":"no", p?"si":"NO", (t.title||"").replace(/,/g," "), (p?.title||"").replace(/,/g," "), t.price, p?.price??"", estado]);
}

fs.writeFileSync("_auditoria-ids.csv", filas.map(f=>f.join(",")).join("\n"), "utf8");
console.log("=== AUDITORIA 406 IDs ===");
console.log("OK (titulo coincide):       "+ok);
console.log("SOSPECHOSO (no coincide):   "+sosp);
console.log("SIN CORPUS (code no existe):"+sinCorpus);
console.log("URLs con guion bajo (_):    "+urlRara);
console.log("\n-> _auditoria-ids.csv (abrir en Excel para revisar)");
