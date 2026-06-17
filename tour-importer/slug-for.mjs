// Resuelve el/los slug de Sanity para un productCode de Viator.
// Uso: node slug-for.mjs 132218P75
import * as configModule from './config.js';
import { createClient } from '@sanity/client';

const config = configModule.config || configModule.default || configModule;
const code = process.argv[2];
if (!code) { console.error('Uso: node slug-for.mjs <productCode>'); process.exit(1); }

const c = createClient({
  projectId: config.sanity.projectId, dataset: config.sanity.dataset,
  token: config.sanity.token, apiVersion: '2024-01-01', useCdn: false,
});
const rows = await c.fetch(
  `*[_type=="post" && !(_id in path("drafts.**")) && getYourGuideUrl match "*${code}*"]{ "slug": slug.current, title }`
);
if (!rows.length) { console.log(`Sin doc para ${code}`); process.exit(0); }
for (const r of rows) console.log(`${r.slug}\t${r.title}`);