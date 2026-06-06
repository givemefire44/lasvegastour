// check-activity-exists.mjs
// Para los 31 tours con bookingUrl roto: verifica si la ACTIVIDAD todavia
// existe en GYG, probando el getYourGuideUrl (la URL completa con -t<id>).
//
//   EXISTS -> la URL completa carga la actividad (mantiene el -t<id>)
//             => la actividad vive; el short link viejo se puede regenerar
//                o el tour se reimporta/refactoriza al template moderno.
//   GONE   -> rebota a /rome-l33/ (perdió el -t<id>) => actividad discontinuada.
//   NO_URL -> el tour no tiene getYourGuideUrl guardado.
//   ERROR  -> no cargó.
//
// CORRER (desde tour-importer):  node check-activity-exists.mjs
// Salida: consola + activity-status.csv

import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });

import fs from 'fs';
import { createClient } from '@sanity/client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const DELAY_BETWEEN = 4000;

const BROKEN_SLUGS = [
  'colosseum-night-tour-underground-and-arena-floor',
  'skip-the-ticket-line-colosseum-express-guided-tour',
  'guided-tour-colosseum-arena-palatine-hill-and-forum',
  'roman-forum-exclusive-tour-and-colosseum-underground',
  'skip-the-line-colosseum-underground-small-group-tour',
  'roman-colosseum-underground-and-ancient-rome-tour',
  'colosseum-gladiator-gate-underground-and-arena-tour',
  'skip-the-line-colosseum-exclusive-tour',
  'private-colosseum-top-floor-tour-with-roman-forum-access',
  'colosseum-arena-palatine-hill-and-forum-guided-tour',
  'colosseum-arena-palatine-hill-forum-guided-tour',
  'exclusive-tour-colosseum-underground-and-arena-floor',
  'roman-colosseum-arena-ancient-rome-and-optional-underground-tour',
  'colosseum-underground-and-arena-tour',
  'colosseum-underground-roman-forum-exclusive-tour',
  'rome-colosseum-vatican-full-day-tour-with-transfers',
  'private-colosseum-underground-tour-with-roman-forum',
  'tour-with-access-to-the-gladiator-arena',
  'private-colosseum-underground-arena-floor-tour',
  'rome-art-historian-tour-colosseum-vatican-walking',
  'rome-private-tour-vatican-colosseum-with-car-transfers',
  'colosseum-roman-forum-and-palatine-hill-guided-tour',
  'colosseum-vip-tour-top-floor-guided-tour',
  'colosseum-arena-tour-guide-forum-and-palatine',
  'colosseum-night-tour-with-arena-underground-access',
  'colosseum-underground-small-group-guided-tour',
  'roman-colosseum-underground-experience-with-roman-forum',
  'ancient-rome-guided-tour-and-colosseum-underground',
  'rome-colosseum-underground-hypogeum-guided-tour',
  'rome-colosseum-underground-chambers-guided-tour',
  'colosseum-underground-hypogeum-guided-tour',
];

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const activityId = (u) => { const m = (u || '').match(/-t(\d+)/); return m ? m[1] : null; };

async function main() {
  const tours = await sanityClient.fetch(
    `*[_type == "post" && slug.current in $slugs && !(_id in path("drafts.**"))]{
       _id, title, "slug": slug.current, bookingUrl, getYourGuideUrl
     }`,
    { slugs: BROKEN_SLUGS }
  );

  console.log(`Tours encontrados en Sanity: ${tours.length} (de ${BROKEN_SLUGS.length} buscados)\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    ignoreHTTPSErrors: true,
  });

  const results = [];

  for (let i = 0; i < tours.length; i++) {
    const t = tours[i];
    const gygUrl = t.getYourGuideUrl;
    let status, finalUrl = '', liveTitle = '', price = '', err = '';

    if (!gygUrl) {
      status = 'NO_URL';
    } else {
      const page = await browser.newPage();
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(gygUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await delay(3500); // dejar que resuelva un eventual redirect

        finalUrl = page.url();
        const origId = activityId(gygUrl);
        const finalId = activityId(finalUrl);

        if (finalId && finalId === origId) {
          status = 'EXISTS';
          // confirmar con datos reales de la pagina
          try {
            liveTitle = await page.$eval('h1', (el) => el.innerText.trim());
          } catch {}
          try {
            price = await page.$eval('.price-info-actual-price-explanation ins', (el) => el.innerText.trim());
          } catch {}
        } else {
          status = 'GONE';
        }
      } catch (e) {
        status = 'ERROR';
        err = e.message;
      } finally {
        await page.close();
      }
    }

    const tag = status === 'EXISTS' ? 'EXISTS' : status;
    console.log(`[${i + 1}/${tours.length}] [${tag}] ${t.title}`);
    if (status === 'EXISTS') console.log(`            live: "${liveTitle}"  ${price}`);
    else if (status !== 'NO_URL') console.log(`            -> ${finalUrl || err}`);

    results.push({ ...t, status, finalUrl, liveTitle, price, err });
    if (i < tours.length - 1) await delay(DELAY_BETWEEN);
  }

  await browser.close();

  const f = (s) => results.filter((r) => r.status === s);
  console.log('\n========== RESUMEN ==========');
  console.log(`EXISTS (actividad viva):   ${f('EXISTS').length}`);
  console.log(`GONE   (discontinuada):    ${f('GONE').length}`);
  console.log(`NO_URL (sin getYourGuideUrl): ${f('NO_URL').length}`);
  console.log(`ERROR:                     ${f('ERROR').length}`);

  const csv = [
    'status,title,slug,id,getYourGuideUrl,final_url,live_title,price,error',
    ...results.map((r) =>
      [r.status, `"${(r.title || '').replace(/"/g, "'")}"`, r.slug, r._id,
       `"${r.getYourGuideUrl || ''}"`, `"${r.finalUrl}"`,
       `"${(r.liveTitle || '').replace(/"/g, "'")}"`, `"${r.price}"`, `"${r.err}"`].join(',')),
  ].join('\n');
  fs.writeFileSync('activity-status.csv', csv, 'utf8');
  console.log('\nReporte: activity-status.csv');
}

main().catch((e) => { console.error('Error fatal:', e); process.exit(1); });