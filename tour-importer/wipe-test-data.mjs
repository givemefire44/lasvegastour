// wipe-test-data.mjs — borra TODOS los posts y categorías del dataset
// Orden seguro: primero posts (referencian categorías), después categorías.
// Va en la RAÍZ del tour-importer (junto a config.js).
//
// USO:
//   node wipe-test-data.mjs            -> DRY RUN: lista qué borraría, NO toca nada
//   node wipe-test-data.mjs --execute  -> BORRA de verdad
//
import { createClient } from '@sanity/client';
import { config } from './config.js';

const client = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn: false
});

const doExecute = process.argv.includes('--execute');

async function main() {
  console.log('========================================================');
  console.log('   WIPE TEST DATA — posts + categorias');
  console.log(`   Project: ${config.sanity.projectId}  |  Dataset: ${config.sanity.dataset}`);
  console.log(`   Modo: ${doExecute ? 'EXECUTE (borra de verdad)' : 'DRY RUN (no toca nada)'}`);
  console.log('========================================================\n');

  const posts = await client.fetch(`*[_type == "post"]{_id, title}`);
  const cats  = await client.fetch(`*[_type == "category"]{_id, title}`);

  console.log(`Posts encontrados: ${posts.length}`);
  posts.forEach((p, i) => console.log(`   ${i + 1}. ${p.title || '(sin titulo)'}  [${p._id}]`));

  console.log(`\nCategorias encontradas: ${cats.length}`);
  cats.forEach((c, i) => console.log(`   ${i + 1}. ${c.title || '(sin titulo)'}  [${c._id}]`));

  if (posts.length === 0 && cats.length === 0) {
    console.log('\nNo hay nada que borrar. Saliendo.');
    return;
  }

  if (!doExecute) {
    console.log('\n🔶 DRY RUN — no se borro nada.');
    console.log('   Si la lista de arriba es la correcta, borra de verdad con:');
    console.log('   node wipe-test-data.mjs --execute\n');
    return;
  }

  // Borrado en orden seguro: PRIMERO posts (referencian categorias), DESPUES categorias
  console.log('\nBorrando posts...');
  await client.delete({ query: `*[_type == "post"]` });
  console.log(`   ✅ ${posts.length} posts borrados`);

  console.log('Borrando categorias...');
  await client.delete({ query: `*[_type == "category"]` });
  console.log(`   ✅ ${cats.length} categorias borradas`);

  console.log('\n✅ Listo. Dataset limpio. Ya podes re-tirar las pruebas.\n');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
// vegas-wipe-test-data
