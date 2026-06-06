import Database from 'better-sqlite3';
const db = new Database('./colosseum-corpus.db', { readonly: true });

console.log('=== TABLAS ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log('  ' + t.name));

tables.forEach(t => {
  console.log('\n=== COLUMNAS DE ' + t.name + ' ===');
  const cols = db.prepare('PRAGMA table_info(' + t.name + ')').all();
  cols.forEach(c => console.log('  ' + c.name + ' (' + c.type + ')'));
});

console.log('\n=== MUESTRA DE 1 FILA (primera tabla con datos) ===');
const main = tables.find(t => t.name !== 'sqlite_sequence');
if (main) {
  const row = db.prepare('SELECT * FROM ' + main.name + ' LIMIT 1').get();
  console.log(JSON.stringify(row, null, 2));
}
