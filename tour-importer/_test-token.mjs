import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
import { createClient } from "@sanity/client";
const token = process.env.SANITY_API_TOKEN;
console.log("Token local:", token ? token.slice(0,8)+"..."+token.slice(-6)+" ("+token.length+" chars)" : "NO HAY");
const sanity = createClient({ projectId:"kabmqky1", dataset:"production", apiVersion:"2023-05-03", token, useCdn:false });
// prueba de escritura: leer 1 tour y reescribir el mismo valor (no cambia nada)
const t = await sanity.fetch(`*[_type=="post" && defined(tourInfo.price)][0]{ _id, "p":tourInfo.price }`);
console.log("Tour:", t._id, "precio", t.p);
try {
  await sanity.patch(t._id).set({ "tourInfo.price": t.p }).commit();
  console.log("✓ ESCRITURA OK - el token local SI puede escribir");
} catch(e) {
  console.log("✗ ESCRITURA FALLA:", e.message);
}
