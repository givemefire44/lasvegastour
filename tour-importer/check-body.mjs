import { createClient } from '@sanity/client';
import { readFileSync } from 'fs';
const env = {};
readFileSync('.env.local','utf8').split('\n').forEach(l => { const m = l.match(/^([^#=]+)=(.*)$/); if(m) env[m[1].trim()]=m[2].trim(); });
const c = createClient({ projectId: env.SANITY_PROJECT_ID, dataset: 'production', apiVersion: '2024-01-01', token: env.SANITY_TOKEN, useCdn: false });
const tour = await c.fetch('*[_type=="post" && slug.current=="guided-tour-of-the-colosseum-palatine-hill-and-roman-forum"][0]{ title, "slug": slug.current, tourInfo, tourFeatures, getYourGuideData, body }');
console.log('TITLE:', tour.title);
console.log('TOUR INFO:', JSON.stringify(tour.tourInfo));
console.log('FEATURES:', JSON.stringify(tour.tourFeatures));
console.log('GYG DATA:', JSON.stringify(tour.getYourGuideData));
console.log('BODY BLOCKS:', tour.body.length);
console.log('\n--- BODY STRUCTURE ---');
tour.body.forEach((b, i) => {
  if (b._type === 'block') {
    const text = (b.children||[]).map(c=>c.text||'').join('');
    console.log(i + ': [' + b.style + '] ' + text.substring(0, 100));
  } else {
    console.log(i + ': [' + b._type + ']');
  }
});
