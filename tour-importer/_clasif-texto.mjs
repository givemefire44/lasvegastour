import fs from 'fs';
const map = JSON.parse(fs.readFileSync('_mapa-maestro.json','utf8'));

// solo las NO-propias
const noProp = map.filter(r => r.tipo !== 'PROPIO');

const KW_ADDON = /\b(admission|entrance|entry fee|park fee|permit|deposit|parking|rental|rent|hold|license|gratuit|tip|surcharge|fee|toll|souvenir|upgrade fee)\b/i;
const KW_DERIV = /\b(more|less|cheaper|pricier|save|saving|extra|additional|than|versus|vs\b|compared|premium|off)\b/i;

let addon=0, deriv=0, cita=0;
const ejAddon=[], ejDeriv=[], ejCita=[];

for (const r of noProp) {
  const o = r.oracion || '';
  if (KW_ADDON.test(o))      { addon++; if(ejAddon.length<6) ejAddon.push(r); }
  else if (KW_DERIV.test(o)) { deriv++; if(ejDeriv.length<8) ejDeriv.push(r); }
  else                       { cita++;  if(ejCita.length<10) ejCita.push(r); }
}

console.log(`=== CLASIFICACIÓN POR TEXTO — ${noProp.length} menciones no-propias ===`);
console.log(`ADD-ON / fee de tercero:  ${addon}`);
console.log(`DERIVADO (comparativo):   ${deriv}`);
console.log(`POSIBLE CITA (resto):     ${cita}\n`);

const show=(t,a)=>{console.log(`--- ${t} ---`);a.forEach(r=>console.log(`  [${r.valor}] en ${r.pagina} (${r.seccion})\n     "${r.oracion.slice(0,130)}"`));console.log('');};
show('ADD-ON', ejAddon);
show('DERIVADO', ejDeriv);
show('POSIBLE CITA', ejCita);

fs.writeFileSync('_clasif-texto.json', JSON.stringify({addon,deriv,cita},null,2),'utf8');
