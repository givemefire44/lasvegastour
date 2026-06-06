import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });
import { createClient } from '@sanity/client';

// ========================================
// RETIRE DEAD TOURS - bulk
// ========================================
// Pone discontinued=true a TODOS los tours que el cron ya marco como
// activeOnGyg=false y que todavia NO estan retirados.
// Eso dispara (cuando el frontend esta deployado): 301 al hub + fuera de
// sitemap, comparativas y listados.
//
// DRY RUN por defecto. Para aplicar: agregar --execute
//
// PORTABLE: para otro sitio del portfolio, cambiar el path del dotenv y SITE_NAME.
// ========================================

const SITE_NAME = 'colosseumroman.com';

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false
});

async function main() {
  console.log('========================================');
  console.log(`  RETIRE DEAD TOURS - ${SITE_NAME}`);
  console.log('========================================\n');
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (solo muestra)' : 'PRODUCCION (escribe Sanity)'}\n`);

  // Solo las marcadas muertas por el cron y todavia NO retiradas.
  const query = `*[_type == "post" && activeOnGyg == false && discontinued != true && !(_id in path("drafts.**"))] | order(title asc) {
    _id, title, "slug": slug.current, deadSince
  }`;

  const tours = await sanityClient.fetch(query);
  console.log(`Encontradas ${tours.length} muertas sin retirar.\n`);

  if (tours.length === 0) {
    console.log('Nada para retirar. (Todas las muertas ya estan discontinued, o no hay ninguna.)');
    return;
  }

  tours.forEach((t, i) => {
    const since = t.deadSince ? `  [muerta desde ${t.deadSince}]` : '';
    console.log(`${i + 1}. ${t.slug}  (${t.title})${since}`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log(`DRY RUN -> pondria discontinued=true a estas ${tours.length}.`);
    console.log('Para aplicar: agregar --execute');
    return;
  }

  let ok = 0, err = 0;
  for (const t of tours) {
    try {
      await sanityClient.patch(t._id).set({ discontinued: true }).commit();
      console.log(`  retirada: ${t.slug}`);
      ok++;
    } catch (e) {
      console.log(`  ERROR ${t.slug}: ${e.message}`);
      err++;
    }
  }

  console.log('\n========================================');
  console.log('  RESUMEN');
  console.log('========================================');
  console.log(`Retiradas: ${ok}`);
  console.log(`Errores: ${err}`);
  console.log(`Total: ${tours.length}`);
  if (err > 0) process.exit(1);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });