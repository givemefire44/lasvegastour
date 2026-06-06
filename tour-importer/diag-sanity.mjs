import { createClient } from '@sanity/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || 'production';
const token = process.env.SANITY_TOKEN || process.env.SANITY_API_TOKEN;

console.log('projectId :', projectId || 'FALTA');
console.log('dataset   :', dataset);
console.log('token len :', token ? token.length : 'FALTA');
console.log('token      :', token ? (token.slice(0, 8) + '...' + token.slice(-6)) : 'FALTA');
console.log('==========================================');

if (!projectId || !token) { console.log('Falta projectId o token.'); process.exit(1); }

const client = createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });

// 1) READ
try {
  const c = await client.fetch('count(*[])');
  console.log('READ   OK  -> documentos en dataset:', c);
} catch (e) {
  console.log('READ   FALLO:', e.message);
}

// 2) Identidad / roles del token
if (typeof fetch === 'function') {
  try {
    const r = await fetch(`https://${projectId}.api.sanity.io/v2021-06-07/users/me`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const txt = await r.text();
    console.log('ME     status:', r.status);
    console.log('ME     body  :', txt.slice(0, 800));
  } catch (e) {
    console.log('ME     FALLO:', e.message);
  }
} else {
  console.log('ME     (fetch no disponible en esta version de Node, salteado)');
}

// 3) CREATE
try {
  const doc = await client.create({ _type: 'permCheck', title: 't' + Date.now() });
  console.log('WRITE  OK  -> creado', doc._id);
  await client.delete(doc._id);
  console.log('cleanup OK');
} catch (e) {
  console.log('WRITE  FALLO:', e.message);
}
