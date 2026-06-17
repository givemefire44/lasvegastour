// delete-dupes.js - Borra los 4 documentos duplicados (gemelos sin el bloque).
// Conserva en cada par el doc con "Is It Worth It?" + galeria mas completa.
// Si algun doc esta referenciado por otro, Sanity lo rechaza y se reporta (no rompe el resto).

import { createClient } from '@sanity/client';
import { config } from './config.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  token: config.sanity.token,
  apiVersion: '2024-01-01',
  useCdn: false,
});

// Gemelos a borrar (sin bloque, menos completos). El que se conserva queda en el comentario.
const TO_DELETE = [
  { id: 'jGG2WOdelszhxIsTIXotJb', slug: '4-hour-racing  (conserva rLfF0HtiMhfXMmJwWL88dL)' },
  { id: 'C4DRjy2fhNK4ynnmnk6NsV', slug: 'la-hollywood   (conserva jGG2WOdelszhxIsTIagYO7)' },
  { id: 'rLfF0HtiMhfXMmJwWKkYMl', slug: 'south-rim      (conserva jGG2WOdelszhxIsTIWyhWZ)' },
  { id: 'rLfF0HtiMhfXMmJwWLFhU3', slug: 'willow-beach   (conserva jGG2WOdelszhxIsTIXSSCA)' },
];

let ok = 0, fail = 0;
for (const { id, slug } of TO_DELETE) {
  try {
    await sanity.delete(id);
    console.log(`deleted  ${id}  [${slug}]`);
    ok++;
  } catch (e) {
    console.error(`FAILED   ${id}  [${slug}]  -> ${e.message}`);
    fail++;
  }
}
console.log(`\nDone. deleted: ${ok}, failed: ${fail}`);
console.log('If any FAILED with a references error, that doc is linked from another document - tell me and we resolve it before deleting.');
