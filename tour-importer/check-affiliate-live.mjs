// check-affiliate-live.mjs
// Verifica si los links de afiliado de GYG estan funcionales.
// Usa el MISMO metodo que ya funciona en el repo: puppeteer-extra + stealth.
// Revisa el link REAL que ve el usuario: bookingUrl || getYourGuideUrl.
//
// Clasificacion (sobre la URL final que resuelve el navegador):
//   OK     -> resuelve a una actividad real de GYG (-t<id> presente)
//   DEAD   -> abrio pero rebotó (perdió el -t<id>, o salió de getyourguide.com)
//   ERROR  -> no cargo (timeout u otro) -> revisar a mano
//
// CORRER (desde tour-importer):
//   node check-affiliate-live.mjs
//
// Salida: consola + affiliate-live.csv

import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/Noxi-PC/colosseumroman-blog/tour-importer/.env.local' });

import fs from 'fs';
import { createClient } from '@sanity/client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const DELAY_BETWEEN = 5000;

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const hasActivityId = (u) => /-t\d+/.test(u || '');

async function main() {
  const tours = await sanityClient.fetch(`
    *[_type == "post" && (defined(bookingUrl) || defined(getYourGuideUrl)) && !(_id in path("drafts.**"))]{
      _id, title, "slug": slug.current, bookingUrl, getYourGuideUrl
    }
  `);

  console.log(`Tours a verificar: ${tours.length}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    ignoreHTTPSErrors: true,
  });

  const results = [];

  for (let i = 0; i < tours.length; i++) {
    const t = tours[i];
    const realUrl = t.bookingUrl || t.getYourGuideUrl;
    const field = t.bookingUrl ? 'bookingUrl' : 'getYourGuideUrl';

    let status, finalUrl = '', err = '';
    const page = await browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(realUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await delay(1500); // por si hay redireccion JS
      finalUrl = page.url();

      if (!finalUrl.includes('getyourguide.com')) status = 'DEAD';
      else if (!hasActivityId(finalUrl)) status = 'DEAD';
      else status = 'OK';
    } catch (e) {
      status = 'ERROR';
      err = e.message;
    } finally {
      await page.close();
    }

    const tag = status === 'OK' ? 'OK  ' : status;
    console.log(`[${i + 1}/${tours.length}] [${tag}] ${t.title}`);
    if (status !== 'OK') console.log(`            (${field}) -> ${finalUrl || err}`);

    results.push({ ...t, field, realUrl, status, finalUrl, err });
    if (i < tours.length - 1) await delay(DELAY_BETWEEN);
  }

  await browser.close();

  const ok = results.filter((r) => r.status === 'OK');
  const dead = results.filter((r) => r.status === 'DEAD');
  const errored = results.filter((r) => r.status === 'ERROR');

  console.log('\n========== RESUMEN ==========');
  console.log(`Total:   ${results.length}`);
  console.log(`OK:      ${ok.length}`);
  console.log(`MUERTOS: ${dead.length}`);
  console.log(`ERROR:   ${errored.length}  (revisar a mano)`);

  if (dead.length) {
    console.log('\n--- LINKS MUERTOS ---');
    for (const r of dead) console.log(`  ${r.slug} | ${r.title}\n     -> ${r.finalUrl}`);
  }

  const csv = [
    'status,field,title,slug,id,real_url,final_url,error',
    ...results.map((r) =>
      [r.status, r.field, `"${(r.title || '').replace(/"/g, "'")}"`, r.slug, r._id,
       `"${r.realUrl}"`, `"${r.finalUrl}"`, `"${r.err}"`].join(',')),
  ].join('\n');
  fs.writeFileSync('affiliate-live.csv', csv, 'utf8');
  console.log('\nReporte: affiliate-live.csv');
}

main().catch((e) => { console.error('Error fatal:', e); process.exit(1); });