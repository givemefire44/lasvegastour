// move-shows-to-category.mjs - Reasigna a la categoria "shows" los shows reales
// que el classifier dejo en strip-tours. Dry-run por defecto; --execute escribe.
//
//   node move-shows-to-category.mjs            # dry run: muestra que moveria
//   node move-shows-to-category.mjs --execute  # escribe en Sanity
//
// Identifica por titulo EXACTO (los 8 detectados). Si alguno no matchea, lo reporta
// y sigue. Los falsos positivos (Seven Magic Mountains, Sphere car tour, Hoover comedy)
// NO estan en esta lista a proposito: quedan donde estan.

import { createClient } from '@sanity/client';
import { config } from './config.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const TITLES = [
  "Vegas Magic Theater: Witches & Warlocks Intimate Show",
  "MJ Live Harrah's Vegas: Michael Jackson Tribute Show",
  "Piano Man Vegas: Elton John & Billy Joel Tribute Show",
  "Colin Cloud Mentalist Show Vegas: Mind-Reading Cabaret",
  "Vegas Mentalist Show: Gerry McCambridge Mind Reading",
  "Donny Osmond Vegas Show: Harrah's Residency Performance",
  "Queen Selena Tribute Show Vegas: Live Band Performance",
  "Wayne Newton Vegas Show: Intimate 80-Min Flamingo Experience",
];

const DRY = !process.argv.includes('--execute');

const showsCat = await sanity.fetch(
  `*[_type == "category" && slug.current == "shows"][0]{ _id, title }`
);
if (!showsCat?._id) {
  console.error('No encontré la categoría "shows". Abortando.');
  process.exit(1);
}
console.log(`\nCategoría destino: "${showsCat.title}" (${showsCat._id})`);
console.log(DRY ? 'MODO: DRY RUN (no escribe)\n' : 'MODO: EXECUTE (escribe en Sanity)\n');

let moved = 0, already = 0, missing = 0;
for (const title of TITLES) {
  const post = await sanity.fetch(
    `*[_type == "post" && title == $title][0]{ _id, title, "cat": category->slug.current }`,
    { title }
  );
  if (!post) { console.log(`  NO ENCONTRADO: ${title}`); missing++; continue; }
  if (post.cat === 'shows') { console.log(`  ya en shows:   ${title}`); already++; continue; }

  console.log(`  ${DRY ? 'movería' : 'movido '}:      ${title}   (${post.cat} -> shows)`);
  if (!DRY) {
    await sanity.patch(post._id).set({
      category: { _type: 'reference', _ref: showsCat._id }
    }).commit();
    moved++;
  }
}

console.log(`\nResumen: ${DRY ? 'a mover' : 'movidos'}: ${DRY ? TITLES.length - already - missing : moved}, ya en shows: ${already}, no encontrados: ${missing}`);
if (DRY) console.log('Nada escrito. Corré con --execute para aplicar.');
