import { createClient } from "@sanity/client";
import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token:process.env.SANITY_API_TOKEN, useCdn:false });

// los 6 detectados: slug, comparado (de la tabla), valor viejo en texto
const CASOS = [
  ["grand-canyon-helicopter-landing-tour-from-las-vegas", "grand-canyon-west-helicopter-with-canyon-floor-landing", 26],
  ["10-hour-west-rim-skywalk-luxury-mercedes-tour-from-vegas", "grand-canyon-west-eagle-point-bus-tour-optional-upgrades", 135],
  ["vip-hoover-dam-interior-comedy-club-tour-from-vegas", "comedy-hoover-dam-tour-interior-access-show-tickets", 50],
  ["red-rock-canyon-electric-scooter-adventure-las-vegas", "valley-of-fire-small-group-day-trip-from-las-vegas", 26],
  ["red-rock-canyon-electric-scooter-adventure-las-vegas", "red-rock-canyon-guided-ebike-adventure-from-las-vegas", 12],
];
for(const [slug, comp, viejo] of CASOS){
  const a = await sanity.fetch(`*[_type=="post" && slug.current==$s][0]{ "p":tourInfo.price }`, { s: slug });
  const b = await sanity.fetch(`*[_type=="post" && slug.current==$s][0]{ "p":tourInfo.price }`, { s: comp });
  if(!a||!b){ console.log(slug+": no encontrado"); continue; }
  const exacto = Math.abs(Number(a.p)-Number(b.p));
  const nuevo = Math.floor(exacto);
  const cambia = nuevo !== viejo;
  console.log(`${slug}: dice $${viejo}, real ${exacto.toFixed(2)}, floor=${nuevo} ${cambia?"-> CAMBIA a $"+nuevo:"(ya ok)"}`);
}
console.log("\nNOTA: valley-of-fire '$25-38' es RANGO, revisar a mano aparte.");
