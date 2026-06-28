import { getProduct } from "./corpus.js";
// el heli champagne real: su url es d684-5847NIGHT_TZ
// el heli LASWIN (grand-canyon): d...-5847LASWIN
const codes = ["5847NIGHT", "5847NIGHT_TZ", "5847LASWIN"];
for(const c of codes){
  const p = getProduct(c);
  console.log(c, "->", p ? `"${p.title}" $${p.price} (${p.reviewCount} rev)` : "NO EXISTE en corpus");
}
