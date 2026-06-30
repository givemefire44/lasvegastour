import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
const s = createClient({ projectId:'kabmqky1', dataset:'production', apiVersion:'2023-05-03', token:process.env.SANITY_API_TOKEN, useCdn:false });
const r = await s.fetch(`*[_type=="category"]{ "slug":slug.current, seoDescription, metaDescription, description }`);
console.log('Categorias:', r.length, '\n');
for (const c of r) {
  console.log(`${c.slug}`);
  console.log(`   seoDescription: ${c.seoDescription ? 'SI ('+c.seoDescription.length+' chars)' : 'NO'}`);
  console.log(`   metaDescription: ${c.metaDescription ? 'SI' : 'NO'}`);
  console.log(`   description: ${c.description ? 'SI' : 'NO'}`);
}
