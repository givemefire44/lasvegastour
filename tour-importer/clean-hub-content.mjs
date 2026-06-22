// clean-hub-content.mjs
// Deja data/hub-content.json SOLO con las claves que son hubs válidos de Vegas
// (según data/tourHubs.json). Quita los resabios de Colosseum del clon.
//
//   node clean-hub-content.mjs --dry-run   (reporta qué quitaría, NO escribe)
//   node clean-hub-content.mjs             (hace backup y limpia)
//
// Correr desde tour-importer (data/ está en la raíz = ../data desde acá).

import fs from 'fs';
import path from 'path';

const DRY = process.argv.includes('--dry-run');
const DATA = path.resolve(process.cwd(), '..', 'data');
const hubsPath = path.join(DATA, 'tourHubs.json');
const contentPath = path.join(DATA, 'hub-content.json');

if (!fs.existsSync(contentPath)) {
  console.error(`No encuentro ${contentPath}. ¿Estás corriendo desde tour-importer?`);
  process.exit(1);
}

const validHubs = JSON.parse(fs.readFileSync(hubsPath, 'utf8')).hubs.map(h => h.slug);
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const allKeys = Object.keys(content);
const keep = allKeys.filter(k => validHubs.includes(k));
const remove = allKeys.filter(k => !validHubs.includes(k));

console.log(`Total claves en hub-content.json: ${allKeys.length}`);
console.log(`Mantener (hubs Vegas): ${keep.length}`);
console.log(`Quitar (residuales del clon): ${remove.length}`);
remove.forEach(k => console.log('  - ' + k));

if (DRY) {
  console.log('\n[DRY-RUN] No se escribió nada.');
} else {
  const backupPath = contentPath.replace(/\.json$/, '.backup.json');
  fs.copyFileSync(contentPath, backupPath);
  const cleaned = {};
  keep.forEach(k => { cleaned[k] = content[k]; });
  fs.writeFileSync(contentPath, JSON.stringify(cleaned, null, 2) + '\n', 'utf8');
  console.log(`\nBackup guardado en hub-content.backup.json`);
  console.log(`hub-content.json reescrito con ${keep.length} claves de Vegas.`);
}
