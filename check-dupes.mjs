import { createClient } from '@sanity/client';
const client = createClient({ projectId: 'kabmqky1', dataset: 'production', apiVersion: '2024-01-01', token: process.env.SANITY_API_TOKEN, useCdn: false });
const tours = await client.fetch('*[_type == "post"]{title, "slug": slug.current}');
const titles = {};
tours.forEach(t => { titles[t.title] = (titles[t.title] || []); titles[t.title].push(t.slug); });
Object.entries(titles).filter(([k,v]) => v.length > 1).forEach(([title, slugs]) => console.log(`DUPLICADO: ${title}\n  ${slugs.join('\n  ')}\n`));
