// Diagnóstico: muestra la estructura REAL del itinerario de Viator para un productCode.
// Uso: node diag-itinerary.mjs 26719P4
import { fetchViatorTour } from './src/viator-client.js';

const code = process.argv[2] || '26719P4';
const data = await fetchViatorTour(code);
const it = (data && data.raw && data.raw.itinerary) || {};

console.log('\n==================== DIAG ITINERARY ====================');
console.log('code               :', code);
console.log('itineraryType      :', it.itineraryType ?? '(ausente)');
console.log('keys del itinerary :', Object.keys(it).join(', ') || '(vacío)');
console.log('itineraryItems     :', Array.isArray(it.itineraryItems) ? it.itineraryItems.length : '-');
console.log('days               :', Array.isArray(it.days) ? it.days.length : '-');
console.log('routes             :', Array.isArray(it.routes) ? it.routes.length : '-');
console.log('unstructuredItinerary  :', JSON.stringify((it.unstructuredItinerary || '').slice(0, 240) || null));
console.log('unstructuredDescription:', JSON.stringify((it.unstructuredDescription || '').slice(0, 240) || null));
console.log('--------------------------------------------------------');
console.log('mapped itineraryText   :', JSON.stringify((data.itineraryText || '').slice(0, 240) || null));
console.log('   (si raw tiene texto pero esto está null -> falta reemplazar viator-client.js)');
console.log('\n---- itinerary RAW (truncado a 1800 chars) ----');
console.log(JSON.stringify(it, null, 2).slice(0, 1800));
console.log('========================================================\n');
