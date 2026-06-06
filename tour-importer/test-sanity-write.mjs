import { createClient } from '@sanity/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN;

console.log('projectId :', projectId || 'FALTA');
console.log('dataset   :', dataset);
console.log('token len :', token ? token.length : 'FALTA');
console.log('token      :', token ? (token.slice(0, 6) + '...' + token.slice(-4)) : 'FALTA');
console.log('-----------------------------------------');

if (!projectId || !token) {
  console.log('Falta projectId o token. Corregir .env.local primero.');
  process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });

try {
  const doc = await client.create({ _type: 'permCheck', title: 'write test ' + Date.now() });
  console.log('WRITE OK  -> creado:', doc._id);
  await client.delete(doc._id);
  console.log('cleanup   -> borrado OK');
  console.log('>>> El token PUEDE crear. Si el importer falla, el problema esta en el uploader, no en el token.');
} catch (e) {
  console.log('WRITE FALLO:', e.message);
  console.log('>>> Si dice "permission create required": ESTE token es Viewer. Genera uno EDITOR y reemplaza el valor en .env.local.');
}
