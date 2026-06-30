import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@sanity/client';
const s = createClient({ projectId:'kabmqky1', dataset:'production', apiVersion:'2023-05-03', token:process.env.SANITY_API_TOKEN, useCdn:false });
const r = await s.fetch(`*[defined(quickAnswer.bestPick)]{ "hub":slug.current, "name":quickAnswer.bestPick.name, "price":quickAnswer.bestPick.price, "rating":quickAnswer.bestPick.rating }`);
console.log('Hubs con bestPick:', r.length);
for (const x of r) console.log(`  ${x.hub} -> ${x.name} | $${x.price} | ${x.rating}/5`);
