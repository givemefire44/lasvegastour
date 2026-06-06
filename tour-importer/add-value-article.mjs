import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const PATH = './architecture.json';

// Backup primero
copyFileSync(PATH, './architecture.backup.json');
console.log("Backup creado: architecture.backup.json");

const arch = JSON.parse(readFileSync(PATH, 'utf8'));

const hub = arch.hubs.find(h => h.id === 'ticket-tiers-comparison');
if (!hub) {
  console.error("ERROR: hub ticket-tiers-comparison no encontrado");
  process.exit(1);
}

// Chequear que no exista ya (evitar duplicados si se corre 2 veces)
const exists = hub.supporting_articles.some(a => a.title.includes('Worth It, or Should You Go In Alone'));
if (exists) {
  console.log("El articulo ya existe, no se duplica.");
  process.exit(0);
}

const newArticle = {
  title: "Is a Guided Colosseum Tour Worth It, or Should You Go In Alone? What Guide Quality and Crowds Reveal",
  category: "decision",
  covers_gap_or_cluster: "Whether paying for a guided tour is worth it over a self-guided ticket: guide quality and crowds drive value perception more than price; when the guide and crowd-timing justify the cost vs when visitors feel they wasted money",
  intent: "transactional"
};

hub.supporting_articles.push(newArticle);

writeFileSync(PATH, JSON.stringify(arch, null, 2), 'utf8');

// Validar que se puede re-parsear
const check = JSON.parse(readFileSync(PATH, 'utf8'));
const added = check.hubs.find(h => h.id === 'ticket-tiers-comparison').supporting_articles;
console.log("OK. ticket-tiers-comparison ahora tiene " + added.length + " supporting articles.");
console.log("El nuevo es el SUP " + added.length + ":");
console.log("  " + added[added.length - 1].title);
