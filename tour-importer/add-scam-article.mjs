import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const PATH = './architecture.json';
copyFileSync(PATH, './architecture.backup.json');
console.log("Backup creado: architecture.backup.json");

const arch = JSON.parse(readFileSync(PATH, 'utf8'));
const hub = arch.hubs.find(h => h.id === 'tickets-booking-system');
if (!hub) { console.error("ERROR: hub tickets-booking-system no encontrado"); process.exit(1); }

const exists = hub.supporting_articles.some(a => a.title.includes('Two Kinds of Colosseum Scam'));
if (exists) { console.log("Ya existe, no se duplica."); process.exit(0); }

const newArticle = {
  title: "Two Kinds of Colosseum Scam: Only One Affects How You Book",
  category: "warning",
  covers_gap_or_cluster: "Separating two distinct scam categories travelers fear: street-level cons outside the monument (fake guides, bracelet scams, scalpers, con artists) versus real online booking risks (undelivered vouchers, no-show operators, all-access tickets delivered as basic, meeting-point failures). Which scam fears actually affect someone buying a tour online vs which are irrelevant street noise. How to recognize a legitimate online tour purchase. Reference operators by category (reseller marketplace, official site, street seller) never by brand name.",
  intent: "transactional"
};

hub.supporting_articles.push(newArticle);
writeFileSync(PATH, JSON.stringify(arch, null, 2), 'utf8');

const check = JSON.parse(readFileSync(PATH, 'utf8'));
const added = check.hubs.find(h => h.id === 'tickets-booking-system').supporting_articles;
console.log("OK. tickets-booking-system ahora tiene " + added.length + " supporting articles.");
console.log("El nuevo es el SUP " + added.length + ":");
console.log("  " + added[added.length - 1].title);
