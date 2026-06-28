import dotenv from "dotenv"; dotenv.config({ path: ".env.local" });
const key = process.env.INDEXNOW_KEY;
console.log("Key leída:", key ? key.slice(0,8)+"..." : "NO ENCONTRADA");
const r = await fetch("https://api.indexnow.org/indexnow", {
  method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify({ host:"lasvegastour.com", key, urlList:["https://lasvegastour.com/"] })
});
console.log("IndexNow status:", r.status, r.status===200?"(OK)":r.status===202?"(aceptado)":"(revisar)");
