import Database from "better-sqlite3";
const db = new Database("./corpus/products.db", { readonly: true });
const rows = db.prepare("SELECT product_code, title, price FROM products WHERE product_code LIKE '5847%'").all();
console.log("Codes que empiezan con 5847 en el corpus:");
rows.forEach(r => console.log(`  ${r.product_code} -> "${r.title}" $${r.price}`));
console.log("\nTotal:", rows.length);
// tambien buscar si hay algun code con _ 
const conGuion = db.prepare("SELECT product_code FROM products WHERE product_code LIKE '%\\_%' ESCAPE '\\' LIMIT 10").all();
console.log("\nCodes con guion bajo (_):", conGuion.length, conGuion.map(r=>r.product_code).join(", "));
