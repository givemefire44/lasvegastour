import fs from 'fs';
const data = JSON.parse(fs.readFileSync('_ajenos-validados.json','utf8'));
// los 281 que nombran tour pero el precio no confirmó a 1
const amb = data.filter(r => r.estado === 'TITULO-SIN-PRECIO-CONFIRM');

console.log(`Total a desmenuzar: ${amb.length}\n`);

// agrupar por el primer candidato (origen probable) para ver concentración
const porOrigen = {};
for(const r of amb){
  const key = (r.cands && r.cands.length) ? r.cands[0] : '(sin candidato)';
  (porOrigen[key] = porOrigen[key] || []).push(r);
}

const orígenes = Object.entries(porOrigen).sort((a,b)=>b[1].length-a[1].length);
console.log(`Orígenes distintos (candidato top): ${orígenes.length}\n`);
console.log('--- concentración: tour-origen probable -> nº menciones ---');
orígenes.slice(0,30).forEach(([k,arr])=>console.log(`  ${arr.length.toString().padStart(3)}  ${k}`));

// cuántos tienen 1 candidato (fácil), cuántos 2-3, cuántos 4+
let c1=0,c2=0,c4=0,c0=0;
for(const r of amb){
  const n = r.cands ? r.cands.length : 0;
  if(n===0)c0++; else if(n===1)c1++; else if(n<=3)c2++; else c4++;
}
console.log(`\n--- por nº de candidatos ---`);
console.log(`  0 candidatos (ruido genérico): ${c0}`);
console.log(`  1 candidato (casi directo):    ${c1}`);
console.log(`  2-3 candidatos (IA desempata): ${c2}`);
console.log(`  4+ candidatos (IA + entorno):  ${c4}`);

fs.writeFileSync('_281-agrupados.json', JSON.stringify(orígenes.map(([k,v])=>({origen:k,n:v.length,menciones:v})),null,2),'utf8');
console.log('\n-> _281-agrupados.json');
