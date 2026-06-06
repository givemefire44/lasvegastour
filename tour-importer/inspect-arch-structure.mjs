import { readFileSync } from 'fs';
const arch = JSON.parse(readFileSync('./architecture.json', 'utf8'));

// Buscar el hub ticket-tiers (donde mejor encaja "value") y mostrar 1 supporting completo
const hub = arch.hubs.find(h => h.id === 'ticket-tiers-comparison');
console.log('=== ESTRUCTURA DE UN SUPPORTING ARTICLE (campos exactos) ===');
console.log(JSON.stringify(hub.supporting_articles[0], null, 2));

console.log('\n=== CAMPOS DEL PILLAR ===');
console.log('Pillar keys: ' + Object.keys(hub.pillar).join(', '));

console.log('\n=== CAMPOS A NIVEL HUB ===');
console.log('Hub keys: ' + Object.keys(hub).join(', '));
