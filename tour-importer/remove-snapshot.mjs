/**
 * remove-snapshot.mjs
 * Removes the redundant "Tour Snapshot" section (H3 + bullets) from all tours.
 * The data is already in "By the Numbers" — snapshot is duplicate content.
 *
 * Usage:
 *   node remove-snapshot.mjs --dry-run          # Preview changes
 *   node remove-snapshot.mjs                    # Apply changes
 *   node remove-snapshot.mjs --slug=tour-slug   # Single tour
 *
 * Works with: Pompeii, Louvre, Colosseum, Scooters
 * NOT needed for: Milan, Sagrada Familia (already clean)
 */

import { createClient } from '@sanity/client';
import { config } from './config.js';

const sanity = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  useCdn: false,
  apiVersion: '2024-01-01',
  token: config.sanity.token,
});

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SLUGS = args.find(a => a.startsWith('--slug='))?.split('=')[1]?.split(',') || null;

console.log(`\n🧹 Tour Snapshot Remover`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
if (SLUGS) console.log(`Target: ${SLUGS.join(', ')}`);
console.log('');

// ─── Find snapshot section in body ──────────────────────────────────────────
function findSnapshotRange(body) {
  if (!body || !Array.isArray(body)) return null;

  for (let i = 0; i < body.length; i++) {
    const block = body[i];
    const text = block.children?.map(c => c.text || '').join('') || '';

    // Match H3 containing "Tour Snapshot" (with or without emoji)
    if ((block.style === 'h3' || block.style === 'h2') && text.toLowerCase().includes('tour snapshot')) {
      const startIndex = i;
      let endIndex = i + 1;

      // Consume all following list items / normal blocks that are part of the snapshot
      while (endIndex < body.length) {
        const next = body[endIndex];
        const nextText = next.children?.map(c => c.text || '').join('') || '';

        // Stop at next section header
        if (next.style === 'h2' || next.style === 'h3') break;

        // Snapshot bullets are listItem blocks or normal blocks with snapshot-like content
        const isSnapshotBullet = next.listItem === 'bullet' || next.listItem === 'number';
        const isSnapshotContent = nextText.match(/^(duration|price|group size|guide|skip|departure|rating|language|operator|key feature)/i);

        if (isSnapshotBullet || isSnapshotContent) {
          endIndex++;
        } else if (next.style === 'normal' && nextText.trim() === '') {
          // Skip empty paragraphs between snapshot and next section
          endIndex++;
        } else {
          break;
        }
      }

      return { startIndex, endIndex, blockCount: endIndex - startIndex };
    }
  }

  return null;
}

// ─── Main ───────────────────────────────────────────────────────────────────
const tours = await sanity.fetch(`
  *[_type == "post" && !(_id in path("drafts.**"))] | order(_createdAt asc) [0...1000] {
    _id,
    title,
    "slug": slug.current,
    "body": coalesce(content, body),
  }
`);

let toProcess = tours;

if (SLUGS) {
  toProcess = toProcess.filter(t => SLUGS.includes(t.slug));
  const found = toProcess.map(t => t.slug);
  const missing = SLUGS.filter(s => !found.includes(s));
  if (missing.length) console.log(`⚠️  Slugs not found: ${missing.join(', ')}\n`);
}

// Only process tours that have a snapshot section
const withSnapshot = toProcess.filter(t => findSnapshotRange(t.body));

console.log(`Found ${tours.length} tours total, ${withSnapshot.length} with Tour Snapshot sections\n`);

let updated = 0;
let errors = 0;

for (const tour of withSnapshot) {
  const range = findSnapshotRange(tour.body);
  if (!range) continue;

  const removedTexts = tour.body
    .slice(range.startIndex, range.endIndex)
    .map(b => b.children?.map(c => c.text || '').join('') || '[non-text block]');

  try {
    if (DRY_RUN) {
      console.log(`📋 ${tour.slug}`);
      console.log(`   Removing ${range.blockCount} blocks (index ${range.startIndex}–${range.endIndex - 1}):`);
      removedTexts.forEach(t => console.log(`   ❌ ${t.slice(0, 80)}`));
      console.log('');
      updated++;
    } else {
      // Build new body without the snapshot blocks
      const newBody = [
        ...tour.body.slice(0, range.startIndex),
        ...tour.body.slice(range.endIndex)
      ];

      const fieldName = tour.content ? 'content' : 'body';

      await sanity
        .patch(tour._id)
        .set({ [fieldName]: newBody })
        .commit();

      console.log(`✅ ${tour.slug} — removed ${range.blockCount} blocks`);
      updated++;
    }
  } catch (err) {
    console.error(`❌ ${tour.slug}: ${err.message}`);
    errors++;
  }
}

console.log(`\n═══════════════════════`);
console.log(`✅ ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated}`);
console.log(`❌ Errors: ${errors}`);
console.log(`📊 Tours without snapshot: ${toProcess.length - withSnapshot.length}`);