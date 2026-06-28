import fs from "fs";
const data = JSON.parse(fs.readFileSync("_ajenos-a-alinear.json","utf8"));
const cambian = data.filter(m => Math.abs(Number(m.valorEnTexto) - Number(m.exacto)) > 0.001);
console.log("Total ajenos a alinear: "+data.length);
console.log("Ya iguales (no tocar): "+(data.length-cambian.length));
console.log("CAMBIAN (texto != exacto, alinear): "+cambian.length+"\n");
cambian.forEach(m=>console.log("  "+m.pagina+": $"+m.valorEnTexto+" -> $"+m.exacto+" ("+m.url+")"));
fs.writeFileSync("_ajenos-cambian.json", JSON.stringify(cambian,null,2),"utf8");
console.log("\n-> _ajenos-cambian.json ("+cambian.length+")");
