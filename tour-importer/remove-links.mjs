// remove-links.mjs
// Quita SOLO las link annotations que insertó link-tours del body de los tours.
// Deja el texto exactamente igual. No borra contenido.
//
// Uso:
//   node remove-links.mjs --dry-run --slug=<slug>   (prueba en UN tour, NO escribe)
//   node remove-links.mjs --slug=<slug>             (aplica a UN tour)
//   node remove-links.mjs --dry-run                 (muestra todos, NO escribe)
//   node remove-links.mjs                            (aplica a TODOS)

import { createClient } from '@sanity/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY = process.argv.includes('--dry-run');
const slugArg = process.argv.find(a => a.startsWith('--slug='));
const ONLY_SLUG = slugArg ? slugArg.split('=')[1] : null;

const client = createClient({
  projectId: 'kabmqky1',
  dataset: 'production',
  apiVersion: '2023-05-03',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// quita los markDefs de tipo 'link' y los marks que los referencian
function stripLinks(body) {
  if (!Array.isArray(body)) return { body, removed: 0 };
  let removed = 0;
  const out = body.map((block) => {
    if (block?._type !== 'block' || !Array.isArray(block.markDefs)) return block;
    const linkKeys = block.markDefs.filter(d => d._type === 'link').map(d => d._key);
    if (linkKeys.length === 0) return block;
    removed += linkKeys.length;
    return {
      ...block,
      markDefs: block.markDefs.filter(d => d._type !== 'link'),
      children: (block.children || []).map(s =>
        Array.isArray(s.marks)
          ? { ...s, marks: s.marks.filter(m => !linkKeys.includes(m)) }
          : s
      ),
    };
  });
  return { body: out, removed };
}

async function main() {
  const filter = ONLY_SLUG
    ? `*[_type=="post" && slug.current=="${ONLY_SLUG}"]`
    : `*[_type=="post" && defined(slug.current)]`;
  const posts = await client.fetch(`${filter}{ _id, "slug": slug.current, body }`);
  console.log(`${posts.length} tour(s)${DRY ? ' [DRY-RUN]' : ''}\n`);

  let touched = 0, totalRemoved = 0;
  for (const p of posts) {
    const { body, removed } = stripLinks(p.body);
    if (removed === 0) continue;
    touched++; totalRemoved += removed;
    console.log(`• ${p.slug}: ${removed} link(s) quitado(s)`);
    if (!DRY) await client.patch(p._id).set({ body }).commit();
  }
  console.log(`\n${DRY ? '[DRY-RUN] ' : ''}${touched} tours, ${totalRemoved} links quitados${DRY ? ' (no se escribió nada)' : ''}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
