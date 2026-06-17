// fix-failed.mjs - Quita de regenerate-done.json los 69 tours que fallaron (threw)
// en la corrida del backfill, para que "node regenerate.js --all --execute" los reintente.
// La lista ya viene adentro: no hay que crear ningun log ni pegar nada.
// Hace backup de regenerate-done.json antes de tocarlo.
//
// Uso (parado en la carpeta tour-importer):
//   node fix-failed.mjs
//   node regenerate.js --all --execute

import fs from 'fs';

const DONE = './regenerate-done.json';
const BACKUP = './regenerate-done.backup.json';

const FAILED = [
  "17-hour-grand-canyon-antelope-horseshoe-bend-combo-vegas",
  "17-hour-south-rim-antelope-horseshoe-multi-park-vegas-trip",
  "2-day-black-canyon-kayak-camping-colorado-river-trip",
  "24-hour-self-drive-atv-rental-mojave-desert-vegas",
  "3-5-hour-apocalypse-12-gun-shooting-range-las-vegas",
  "3-5-hour-desert-storm-8-gun-shooting-adventure-vegas",
  "3-hour-eagle-s-nest-multi-gun-shooting-las-vegas",
  "3-hour-grey-wolf-military-shooting-range-las-vegas",
  "4-hour-climate-controlled-bronco-desert-drive-boathouse-cove",
  "4-hour-hoover-dam-top-walk-bridge-views-from-vegas",
  "48-hour-3-park-southwest-experience-canyon-bryce-zion",
  "48-hour-grand-circle-6-parks-monument-valley-antelope",
  "5-hour-hoover-dam-emerald-cave-kayak-adventure",
  "5-hour-lake-mead-kayak-hoover-dam-water-views",
  "6-hour-small-group-hoover-dam-power-plant-interior-tour",
  "arts-district-bar-crawl-speakeasies-hidden-venues",
  "candlelight-magic-show-intimate-theater-las-vegas",
  "colorado-river-kayak-hot-springs-dam-base-adventure",
  "colorado-river-rzr-ghost-town-5-5hr-desert-adventure",
  "death-valley-family-desert-adventure-small-group-vegas",
  "death-valley-vip-small-group-desert-adventure-las-vegas",
  "grand-canyon-atv-horseback-combo-adventure-from-vegas",
  "grand-canyon-heli-emerald-cave-kayak-combo-adventure",
  "grand-canyon-helicopter-wedding-with-limo-photos",
  "grand-canyon-ranch-overnight-helicopter-ground-adventure",
  "grand-canyon-west-hoover-dam-spanish-guide-day-trip-vegas",
  "it-escape-room-vegas-multi-room-horror-puzzle-challenge",
  "joshua-tree-horseback-ride-buffalo-ranch-adventure-vegas",
  "joshua-tree-self-guided-audio-adventure-from-vegas",
  "lake-mead-atv-and-racing-track-combo-adventure-vegas",
  "lake-mead-sunset-kayak-with-dinner-and-campfire-vegas",
  "las-vegas-helicopter-wedding-ceremony-night-flight",
  "lower-antelope-horseshoe-bend-bilingual-day-trip-vegas",
  "moonlight-kayak-with-neon-lights-colorado-river-vegas",
  "night-desert-dune-buggy-chase-adventure-las-vegas",
  "private-hoover-dam-interior-vegas-city-tour",
  "private-strip-party-bus-champagne-toast-welcome-sign",
  "private-utv-desert-drive-katherine-mine-vegas",
  "private-vegas-party-bus-20-person-luxury-rental",
  "queen-selena-tribute-show-vegas-live-band-performance",
  "red-rock-canyon-private-wedding-limo-package-las-vegas",
  "red-rock-canyon-spring-mountain-ranch-combo-tour-vegas",
  "red-rock-sunrise-self-guided-ebike-tour-las-vegas",
  "route-66-grand-canyon-caverns-underground-adventure-vegas",
  "self-drive-jeep-mojave-desert-adventure-from-las-vegas",
  "spanish-grand-canyon-west-skywalk-hoover-dam-vip-day-tour",
  "spirit-of-the-king-elvis-tribute-show-las-vegas-theater",
  "strip-nightclub-crawl-3-venues-party-bus-transport",
  "upper-antelope-lake-powell-day-trip-las-vegas",
  "utah-parks-shuttle-las-vegas-bryce-zion-st-george",
  "valley-fire-self-drive-rock-crawler-jeep-adventure",
  "valley-of-fire-photography-hiking-tour-small-group-vegas",
  "valley-of-fire-single-seater-utv-adventure-vegas",
  "valley-of-fire-small-group-hiking-experience-las-vegas",
  "vegas-airport-escalade-transfer-private-luxury-service",
  "vegas-axe-throwing-fremont-street-weapon-experience",
  "vegas-crime-history-tour-true-stories-evidence-walk",
  "vegas-monster-party-bus-3-vip-clubs-strip-transport",
  "vegas-red-light-district-walk-historic-downtown-sin-city",
  "vegas-sign-wedding-45-min-outdoor-ceremony-photos",
  "vegas-strip-bar-crawl-hidden-speakeasies-local-gems",
  "vegas-strip-limo-photo-tour-professional-photographer",
  "vegas-strip-military-hummer-tour-small-group-adventure",
  "vegas-strip-small-group-walk-drink-hidden-gems-tour",
  "vegas-to-la-day-trip-santa-monica-hollywood-adventure",
  "vegas-wine-tour-sommelier-luxury-bus-experience",
  "west-rim-airplane-tour-canyon-flight-from-vegas",
  "wizard-of-oz-sphere-las-vegas-4d-show-experience",
  "zion-utah-red-rock-canyon-day-trip-from-las-vegas",
];

const failedSet = new Set(FAILED);

let done = [];
try { done = JSON.parse(fs.readFileSync(DONE, 'utf8')); } catch {
  console.error(`No pude leer ${DONE}. Asegurate de correr esto parado en la carpeta tour-importer.`);
  process.exit(1);
}

fs.writeFileSync(BACKUP, JSON.stringify(done, null, 2)); // backup por las dudas

const before = done.length;
const cleaned = done.filter(s => !failedSet.has(s));
fs.writeFileSync(DONE, JSON.stringify(cleaned, null, 2));

const quitados = before - cleaned.length;
console.log(`Backup guardado en ${BACKUP}`);
console.log(`done.json: ${before} -> ${cleaned.length}  (quitados ${quitados} para reintentar)`);
console.log(`\nListo. Ahora corre:  node regenerate.js --all --execute`);
console.log(`Va a reintentar solo esos ${quitados}; los demas (buenos) los saltea solos.`);
