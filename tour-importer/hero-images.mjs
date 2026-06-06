#!/usr/bin/env node
/**
 * hero-images.mjs
 *
 * ETAPA 1 — Hero images automáticas para STATIC PAGES.
 *
 * Qué hace:
 *   - Lista pages (_type == "page") sin heroImage definido
 *   - Por cada una:
 *       1) Claude (Sonnet 4.6) lee título + content + richSnippets.about
 *          y genera search_query + alt text (en INGLÉS)
 *       2) Busca en Wikimedia Commons (fallback Unsplash si hay UNSPLASH_ACCESS_KEY)
 *       3) Descarga con fetch + User-Agent (Wikimedia exige UA identificable),
 *          procesa con sharp directo (AVIF→PNG→JPG, igual lógica que tu imageProcessor)
 *       4) Sube buffer a Sanity y patchea SOLO el campo heroImage
 *
 * No toca: content, seoImage, ni ningún otro campo. Solo heroImage.
 *
 * Usage:
 *   node hero-images.mjs --list                    # lista pendientes y sale
 *   node hero-images.mjs                           # dry-run sobre el primero (validación)
 *   node hero-images.mjs --slug <slug>             # dry-run sobre una slug
 *   node hero-images.mjs --slug <slug> --execute   # commit en una sola
 *   node hero-images.mjs --all                     # dry-run sobre TODAS
 *   node hero-images.mjs --all --execute           # commit en TODAS
 *
 * Requiere en env: SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN,
 *                  ANTHROPIC_API_KEY, [UNSPLASH_ACCESS_KEY opcional]
 *   (lee ./config.js para Sanity igual que el resto del importer)
 */

import { createClient } from '@sanity/client';
import { config } from './config.js';
import sharp from 'sharp';

// cargar .env.local (sin dependency)
import fs from 'fs';
try {
  const txt = fs.readFileSync('.env.local', 'utf-8');
  txt.split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch {}

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset:   config.sanity.dataset,
  token:     config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn:    false,
});

// ─────────────── CONFIG POR SITIO (cambiar al portar a otros sitios) ───────────────
const MONUMENT = {
  name: 'Colosseum',
  city: 'Rome',
  country: 'Italy',
  contextHint: 'Colosseum / Rome tourism site',   // se le pasa a Claude
};
// Archivo donde se persiste la atribución (para generar /credits global)
const CREDITS_FILE = './image-credits.json';

// ─────────────── Dedup: cargar fotos ya usadas ───────────────
function loadUsedAssets() {
  try {
    const creds = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf-8'));
    return new Set(creds.map(c => c.file_title).filter(Boolean));
  } catch { return new Set(); }
}
let USED_ASSETS = new Set();   // se popula en main()

// ─────────────── CLI args ───────────────
const args = process.argv.slice(2);
const flags = {
  list:    args.includes('--list'),
  all:     args.includes('--all'),
  execute: args.includes('--execute'),
  slug:    args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null,
};
const DRY = !flags.execute;

// ─────────────── 1. CLASSIFY (Claude vía fetch, sin SDK) ───────────────
async function callClaude(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.content[0].text;
}

async function classifyHero(page) {
  const about = page.about
    ? `Place context: ${[page.about.name, page.about.city, page.about.country].filter(Boolean).join(', ')} (${page.about.type || 'TouristAttraction'}).`
    : `Place context: ${MONUMENT.contextHint}.`;

  const prompt = `You are an image editor for a ${MONUMENT.name} / ${MONUMENT.city} tourism website (English-language).
The page below needs a HERO image: wide, iconic, real photo (not illustration).

${about}

Return EXACTLY this JSON (no markdown fences, no prose). Each query has its OWN alt — the alt MUST describe what the query would return, not the article in general:

{
  "queries": [
    { "query": "ideal: 3-5 keywords matching Wikimedia file names (proper nouns + architectural/geographical descriptors)", "alt": "English alt text describing THIS specific shot, max 125 chars" },
    { "query": "fallback 1: 2-3 broader keywords", "alt": "alt for THIS shot" },
    { "query": "fallback 2: monument canonical name + city (MUST return results)", "alt": "alt for THIS shot" }
  ]
}

CRITICAL — each "alt" must describe what the photo with that "query" would actually show. If query is "Sistine Chapel ceiling", alt is about the Sistine Chapel ceiling, NOT about the article topic. If query is "Colosseum interior arena", alt is about the Colosseum interior arena.

KEYWORD RULES:
✓ GOOD queries (match Wikimedia file titles):
   "Colosseum interior arena" · "Colosseum hypogeum underground" · "Colosseum aerial view"
   "Colosseum night illuminated" · "Vatican St Peter Basilica" · "Vatican Museums Sistine Chapel"
   "Roman Forum Palatine" · "Constantine Arch Rome" · "Trevi Fountain Rome"
✗ BAD queries (narrative, return 0 hits):
   "tourists walking ancient ruins" · "visitors enjoying tour"
   "Colosseum same day combo" · "heat sunny morning"

Avoid: scene descriptions, weather, emotions, verbs like "walking/exploring/visiting".
Use: monument names, locations, parts (interior/exterior/aerial/night), architectural elements.

ALT TEXT RULES:
- English, descriptive, SEO-friendly, max 125 chars
- NO "image of" / "photo of" preamble
- Describe the SHOT, not the article

If the article covers MULTIPLE monuments (e.g. "Vatican + Colosseum combo"), pick varied hero options — e.g. Vatican basilica, or Colosseum interior/aerial — to add variety across the site.

PAGE:
Title: ${page.title}
Slug: /${page.slug?.current || ''}
SEO Description: ${page.seoDescription || '(none)'}
Content (plain text, truncated): ${(page.contentText || '').slice(0, 5000)}`;

  const raw = (await callClaude(prompt)).replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

// ─────────────── 2A. WIKIMEDIA COMMONS ───────────────
async function searchWikimedia(query) {
  const search = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search` +
    `&srsearch=${encodeURIComponent(query + ' filetype:bitmap')}` +
    `&srnamespace=6&srlimit=15&origin=*`
  ).then(r => r.json());

  const hits = search.query?.search || [];
  if (!hits.length) {
    console.log(`     · 0 hits`);
    return null;
  }

  let inspected = 0, rejected = 0, dupSkipped = 0;
  for (const hit of hits) {
    inspected++;

    // Dedup: si esta foto ya se usó en otra page, saltar
    if (USED_ASSETS.has(hit.title)) {
      dupSkipped++;
      continue;
    }

    const info = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
      `&titles=${encodeURIComponent(hit.title)}` +
      `&prop=imageinfo&iiprop=url|size|extmetadata&origin=*`
    ).then(r => r.json());

    const p = Object.values(info.query.pages)[0];
    const ii = p.imageinfo?.[0];
    if (!ii) { rejected++; continue; }
    if (ii.width < 1200) { rejected++; continue; }
    if (ii.height > ii.width * 1.4) { rejected++; continue; }

    const author  = ii.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '').trim() || 'Wikimedia';
    const license = ii.extmetadata?.LicenseShortName?.value || 'CC';

    return {
      url: ii.url,
      width: ii.width,
      height: ii.height,
      source: 'Wikimedia Commons',
      source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(hit.title)}`,
      file_title: hit.title,
      author,
      license,
      attribution: `${author} / Wikimedia Commons (${license})`,
    };
  }
  console.log(`     · ${hits.length} hits  ·  ${dupSkipped} ya usadas  ·  ${rejected} rechazadas`);
  return null;
}

// ─────────────── 2B. UNSPLASH (fallback opcional) ───────────────
async function searchUnsplash(query) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null;

  const r = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
    `&per_page=3&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
  ).then(r => r.json());
  if (!r.results?.length) return null;
  const p = r.results[0];

  // TOS: ping download_location
  await fetch(p.links.download_location, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  });

  return {
    url: p.urls.full,
    width: p.width,
    height: p.height,
    source: 'Unsplash',
    author: p.user.name,
    license: 'Unsplash License',
    attribution: `Photo by ${p.user.name} on Unsplash`,
  };
}

async function sourceHero(queries) {
  for (let i = 0; i < queries.length; i++) {
    const { query, alt } = queries[i];
    const label = i === 0 ? 'ideal' : `fallback ${i}`;
    console.log(`  🔎 [${label}] "${query}"`);

    const wm = await searchWikimedia(query);
    if (wm) {
      console.log(`     ✓ Wikimedia: ${wm.author} · ${wm.width}×${wm.height} · ${wm.license}`);
      return { src: wm, alt };
    }

    if (i === queries.length - 1) {
      const us = await searchUnsplash(query);
      if (us) {
        console.log(`     ✓ Unsplash: ${us.author} · ${us.width}×${us.height}`);
        return { src: us, alt };
      }
    }
  }
  throw new Error(`No suitable image found after ${queries.length} queries`);
}

// ─────────────── 3. DOWNLOAD + PROCESS (sharp directo, con User-Agent) ───────────────
// NOTA: Wikimedia exige User-Agent identificable (Wikimedia Foundation UA policy).
// Bypaseamos el imageProcessor del importer para no tocarlo.
const USER_AGENT = 'Intercoper-HeroImages/1.0 (https://colosseumroman.com; mario@mariodalo.com)';

async function downloadAndProcess(url, baseName) {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`Download failed: HTTP ${r.status} ${r.statusText}`);
  const origBuffer = Buffer.from(await r.arrayBuffer());

  const meta = await sharp(origBuffer).metadata();
  console.log(`     📐 ${meta.width}×${meta.height}  format=${meta.format}  ${(origBuffer.length/1024/1024).toFixed(2)} MB`);

  // AVIF necesita conversión en 2 pasos (igual lógica que tu imageProcessor.js)
  let working = origBuffer;
  if (meta.format === 'avif') {
    console.log(`     🔄 AVIF → PNG (intermedio)`);
    working = await sharp(origBuffer).png({ compressionLevel: 0, quality: 100 }).toBuffer();
  }

  const jpg = await sharp(working)
    .jpeg({
      quality: meta.format === 'avif' ? 98 : 95,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
    })
    .toBuffer();

  return {
    buffer: jpg,
    filename: `${baseName}.jpg`,
    width: meta.width,
    height: meta.height,
  };
}

// ─────────────── 4. UPLOAD A SANITY (función local, NO toca sanityUploader.js) ───────────────
async function uploadImageRef(buffer, filename, alt) {
  const asset = await sanity.assets.upload('image', buffer, {
    filename,
    contentType: 'image/jpeg',
  });
  return {
    _type: 'image',
    asset: { _type: 'reference', _ref: asset._id },
    alt,
  };
}

// ─────────────── 4. PROCESAR UNA PAGE ───────────────
async function processPage(pageId) {
  const page = await sanity.fetch(`*[_id == $id][0]{
    _id, title, slug, seoDescription, pageType,
    "contentText": pt::text(content),
    "about": richSnippets.about,
    "hasHero": defined(heroImage)
  }`, { id: pageId });

  if (!page) { console.log(`  ✗ Not found`); return { error: 'not_found' }; }
  if (page.hasHero) { console.log(`  ⊘ Already has heroImage — skipping`); return { skipped: true }; }

  console.log(`\n📄 ${page.title}  ·  /${page.slug?.current || ''}`);

  // 1) Claude classify (devuelve array de {query, alt})
  const spec = await classifyHero(page);

  // 2) Source (cascada de queries) — devuelve {src, alt} de la query ganadora
  const { src, alt } = await sourceHero(spec.queries);
  console.log(`  📝 alt:   "${alt}"`);

  if (DRY) {
    console.log(`  [DRY-RUN] would patch heroImage`);
    console.log(`            file:  ${src.file_title || '(unknown)'}`);
    console.log(`            url:   ${src.url.slice(0, 90)}...`);
    console.log(`            ©      ${src.attribution}`);
    if (src.file_title) USED_ASSETS.add(src.file_title);
    return { dry: true, page, src, alt };
  }

  // 3) Download + process
  const img = await downloadAndProcess(src.url, `${page.slug.current}-hero`);

  // 4) Upload + patch SOLO heroImage
  const ref = await uploadImageRef(img.buffer, img.filename, alt);
  await sanity.patch(page._id).set({ heroImage: ref }).commit();

  if (src.file_title) USED_ASSETS.add(src.file_title);

  await saveCredit({
    site: MONUMENT.name,
    slug: page.slug.current,
    page_title: page.title,
    sanity_asset_ref: ref.asset._ref,
    alt,
    source: src.source,
    source_url: src.source_url || null,
    file_title: src.file_title || null,
    author: src.author,
    license: src.license,
    attribution: src.attribution,
    added_at: new Date().toISOString(),
  });

  console.log(`  ✅ heroImage set  ·  ${img.width}×${img.height}px  ·  © ${src.attribution}`);
  return { dry: false, page, src, alt, ref };
}

// ─────────────── Credits persistence ───────────────
async function saveCredit(entry) {
  let creds = [];
  try {
    creds = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf-8'));
  } catch {}
  // Dedupe por slug
  creds = creds.filter(c => c.slug !== entry.slug);
  creds.push(entry);
  creds.sort((a, b) => a.slug.localeCompare(b.slug));
  fs.writeFileSync(CREDITS_FILE, JSON.stringify(creds, null, 2));
  console.log(`     💾 Atribución guardada en ${CREDITS_FILE}`);
}

// ─────────────── MAIN ───────────────
(async () => {
  console.log(`\n🖼️  hero-images.mjs  ${DRY ? '· DRY-RUN' : '· EXECUTE'}\n`);

  // Cargar fotos ya usadas (de runs anteriores) para evitar repetidas
  USED_ASSETS = loadUsedAssets();
  if (USED_ASSETS.size > 0) {
    console.log(`📚 ${USED_ASSETS.size} fotos ya usadas previamente — serán saltadas si aparecen en búsquedas.\n`);
  }

  const pending = await sanity.fetch(`*[
    _type == "page"
    && !defined(heroImage)
    && (!defined(pageType) || pageType != "simple")
    && defined(slug.current)
    && defined(title)
  ]{
    _id, title, "slug": slug.current, pageType
  } | order(title asc)`);

  console.log(`Pages without heroImage: ${pending.length}\n`);

  if (flags.list) {
    pending.forEach(p => console.log(`  • /${p.slug || '(no-slug)'}  ${p.pageType === 'simple' ? '[simple]' : ''}  — ${p.title}`));
    process.exit(0);
  }

  if (!pending.length) { console.log('Nothing to do. ✨'); process.exit(0); }

  // Selección de qué procesar
  let target = [];
  if (flags.slug) {
    const found = pending.find(p => p.slug === flags.slug);
    if (!found) {
      console.log(`✗ Slug "${flags.slug}" not in pending list. Run with --list to see options.`);
      process.exit(1);
    }
    target = [found];
  } else if (flags.all) {
    target = pending;
  } else {
    target = pending.slice(0, 1);
    console.log(`ℹ️  No --slug ni --all → procesando solo el primero como validación.`);
    console.log(`   Para una específica:  --slug <slug>`);
    console.log(`   Para todas:           --all`);
    console.log(`   Solo listar:          --list\n`);
  }

  let ok = 0, dry = 0, failed = 0, skipped = 0;
  for (const t of target) {
    try {
      const r = await processPage(t._id);
      if (r?.dry) dry++;
      else if (r?.skipped) skipped++;
      else if (r?.error) failed++;
      else ok++;
    } catch (e) {
      failed++;
      console.error(`  ❌ ${t.title}: ${e.message}`);
    }
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`Done  ·  ${ok} updated  ·  ${dry} dry-runs  ·  ${skipped} skipped  ·  ${failed} failed`);
  if (DRY && dry > 0) {
    console.log(`\n👉 Revisá arriba. Si te gustan los resultados:`);
    console.log(`   Para confirmar UNA:   node hero-images.mjs --slug ${target[0].slug} --execute`);
    console.log(`   Para confirmar TODAS: node hero-images.mjs --all --execute\n`);
  }
})();