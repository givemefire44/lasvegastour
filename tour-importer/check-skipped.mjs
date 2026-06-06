import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
const env = {};
readFileSync('.env.local','utf8').split('\n').forEach(l => { const m = l.match(/^([^#=]+)=(.*)$/); if(m) env[m[1].trim()]=m[2].trim(); });
const c = createClient({ projectId: env.SANITY_PROJECT_ID, dataset: 'production', apiVersion: '2024-01-01', token: env.SANITY_TOKEN, useCdn: false });
const tours = await c.fetch('*[_type=="post" && defined(tourInfo)]{ title, "slug": slug.current, "headers": body[style=="h2"]{ "text": children[0].text }, "blockCount": count(body) }');
const skipped = tours.filter(t => { const h = (t.headers||[]).map(x=>x.text.toLowerCase()); return !h.some(x=>x.includes('what makes this tour special')) || !h.some(x=>x.includes('the experience')); });
console.log('SKIPPED TOURS:', skipped.length);
skipped.forEach(t => { console.log('\n---', t.title, '---'); console.log('Slug:', t.slug); console.log('Blocks:', t.blockCount); console.log('Headers:', (t.headers||[]).map(x=>x.text).join(' | ')); });
