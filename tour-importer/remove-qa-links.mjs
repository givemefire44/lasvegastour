// remove-qa-links.mjs — Limpieza de datos: saca los link annotations que quedaron
// DENTRO de secciones Quick Answer (la respuesta citable por AI engines va limpia).
// Complemento del guard 'quick answer' agregado a BLOCKED_SECTIONS en link-tours/link-articles:
// el guard protege corridas futuras; esto limpia lo ya persistido.
//
// Solo remueve el mark de link y su markDef en bloques entre un heading "quick answer"
// y el próximo heading. Los spans quedan partidos (inofensivo). No toca nada más.
//
// Uso:
//   node remove-qa-links.mjs --dry-run    (reporte, NO escribe)
//   node remove-qa-links.mjs              (aplica a posts y pages)
import { createClient } from '@sanity/client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY = process.argv.includes('--dry-run');

const client = createClient({
  projectId: 'kabmqky1',
  dataset: 'production',
  apiVersion: '2023-05-03',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// Devuelve { blocks, removed } — blocks nuevos sin links en secciones QA.
function stripQaLinks(blocks) {
  if (!Array.isArray(blocks)) return { blocks, removed: [] };
  let inQA = false;
  const removed = [];
  const out = blocks.map((block) => {
    if (block?._type !== 'block') return block;
    const style = block.style || 'normal';
    if (typeof style === 'string' && style.startsWith('h')) {
      const ht = (block.children || []).map(s => s.text || '').join('').toLowerCase();
      inQA = ht.includes('quick answer');
      return block;
    }
    if (!inQA) return block;

    const linkDefs = new Map((block.markDefs || []).filter(d => d?._type === 'link').map(d => [d._key, d.href]));
    if (linkDefs.size === 0) return block;

    const droppedKeys = new Set();
    const children = (block.children || []).map((span) => {
      if (span?._type !== 'span' || !Array.isArray(span.marks)) return span;
      const linkMarks = span.marks.filter(m => linkDefs.has(m));
      if (linkMarks.length === 0) return span;
      for (const m of linkMarks) {
        droppedKeys.add(m);
        removed.push({ text: span.text, href: linkDefs.get(m) });
      }
      return { ...span, marks: span.marks.filter(m => !linkDefs.has(m)) };
    });
    if (droppedKeys.size === 0) return block;

    return {
      ...block,
      children,
      markDefs: (block.markDefs || []).filter(d => !droppedKeys.has(d._key)),
    };
  });
  return { blocks: out, removed };
}

async function processDocs(type, field, urlPrefix) {
  const docs = await client.fetch(`*[_type == "${type}" && defined(slug.current)]{ _id, "slug": slug.current, ${field} }`);
  let touched = 0, totalRemoved = 0;
  for (const d of docs) {
    const { blocks, removed } = stripQaLinks(d[field]);
    if (removed.length === 0) continue;
    touched++; totalRemoved += removed.length;
    console.log(`• ${urlPrefix}${d.slug}: -${removed.length}: ${removed.map(r => `"${r.text}" (${r.href})`).join(', ')}`);
    if (!DRY) {
      await client.patch(d._id).set({ [field]: blocks }).commit();
    }
  }
  return { touched, totalRemoved, total: docs.length };
}

const p = await processDocs('post', 'body', '/tour/');
const g = await processDocs('page', 'content', '/');
console.log(`\n${DRY ? '[DRY-RUN] ' : ''}posts: ${p.touched}/${p.total} tocados (-${p.totalRemoved} links) | pages: ${g.touched}/${g.total} tocados (-${g.totalRemoved} links)${DRY ? ' (no se escribió nada)' : ''}`);
