import { createClient } from '@sanity/client';
const client = createClient({ projectId: 'kabmqky1', dataset: 'production', apiVersion: '2024-01-01', token: process.env.SANITY_API_TOKEN, useCdn: false });
const r = await client.fetch('*[_type == "post"][0]{title, "headings": body[style in ["h2","h3","h4"]]{style, "text": children[0].text}}');
console.log(JSON.stringify(r, null, 2));
