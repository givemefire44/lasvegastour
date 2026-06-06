#!/usr/bin/env node
/**
 * check-hero.mjs — Muestra la URL del hero de una page específica
 *
 * Usage:
 *   node check-hero.mjs <slug>
 *
 * Devuelve la URL directa del asset en Sanity CDN para abrir en el navegador
 * y validar visualmente, sin tener que entrar a Studio.
 */

import { createClient } from '@sanity/client';
import { config } from './config.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset:   config.sanity.dataset,
  token:     config.sanity.token,
  apiVersion: config.sanity.apiVersion,
  useCdn:    false,
});

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node check-hero.mjs <slug>');
  process.exit(1);
}

const r = await sanity.fetch(`*[_type == "page" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  "heroAssetUrl": heroImage.asset->url,
  "heroAlt": heroImage.alt,
  "heroDimensions": heroImage.asset->metadata.dimensions,
  "heroSize": heroImage.asset->size,
}`, { slug });

if (!r) { console.error(`Page not found for slug: ${slug}`); process.exit(1); }

console.log(`\n📄 ${r.title}`);
console.log(`   _id:    ${r._id}`);
console.log(`   slug:   /${r.slug}`);

if (!r.heroAssetUrl) {
  console.log(`\n   ⚠️  No heroImage set on this page.\n`);
  process.exit(0);
}

console.log(`\n🖼️  HERO IMAGE`);
console.log(`   alt:       "${r.heroAlt || '(empty)'}"`);
if (r.heroDimensions) console.log(`   size:      ${r.heroDimensions.width}×${r.heroDimensions.height}px`);
if (r.heroSize) console.log(`   filesize:  ${(r.heroSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`\n   👉 Abrí esta URL en el navegador:`);
console.log(`      ${r.heroAssetUrl}\n`);