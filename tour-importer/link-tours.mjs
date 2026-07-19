// link-tours.mjs — Linking persistido FASE 1: Tours/posts → hubs y categorías.
// Inserta link annotations en el PortableText (body) de cada post en Sanity.
// Render: SanityContent ya pinta los <a> server-side desde markDefs → visible para crawlers de AI.
//
// Uso:
//   node link-tours.mjs --dry-run            (muestra qué linkearía, NO escribe)
//   node link-tours.mjs --dry-run --slug=X   (un solo tour)
//   node link-tours.mjs --slug=X             (aplica a un tour)
//   node link-tours.mjs                       (aplica a TODOS)
//
// Seguro: idempotente (no re-linkea spans que ya tienen link), no toca headings,
// respeta prioridad, maxLinks por keyword y por página, y nunca linkea a la propia URL.

import { createClient } from '@sanity/client';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

// token del .env.local LOCAL de tour-importer (igual que set-category-content.mjs)
dotenv.config({ path: '.env.local' });

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const slugArg = process.argv.find(a => a.startsWith('--slug='));
const ONLY_SLUG = slugArg ? slugArg.split('=')[1] : null;

const client = createClient({
  projectId: 'kabmqky1',
  dataset: 'production',
  apiVersion: '2023-05-03',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
});

// ─────────────────────────────────────────────────────────────
// MAPA DE KEYWORDS (del research). Cada entrada: kw → url, priority, maxLinks.
// El orden de match es por longitud de kw desc (frase larga gana a corta) y prioridad.
// ─────────────────────────────────────────────────────────────
const RAW = [
  // HUBS (específicos) -------------------------------------------------
  ['west rim', '/grand-canyon-west-rim-tours', 9], ['grand canyon west', '/grand-canyon-west-rim-tours', 9], ['skywalk', '/grand-canyon-west-rim-tours', 9], ['eagle point', '/grand-canyon-west-rim-tours', 9],
  ['south rim', '/grand-canyon-south-rim-tours', 8], ['grand canyon south', '/grand-canyon-south-rim-tours', 8],
  ['grand canyon helicopter', '/grand-canyon-helicopter-tours', 8], ['helicopter landing', '/grand-canyon-helicopter-tours', 8],
  ['antelope canyon', '/antelope-canyon-horseshoe-bend-tours', 9], ['horseshoe bend', '/antelope-canyon-horseshoe-bend-tours', 9],
  ['wizard of oz', '/sphere-las-vegas-shows', 9],
  ['cirque du soleil', '/cirque-du-soleil-shows-las-vegas', 8], ['mystère', '/cirque-du-soleil-shows-las-vegas', 8], ['mystere', '/cirque-du-soleil-shows-las-vegas', 8], ['mad apple', '/cirque-du-soleil-shows-las-vegas', 8], ['michael jackson one', '/cirque-du-soleil-shows-las-vegas', 8], ['cirque', '/cirque-du-soleil-shows-las-vegas', 7],
  // SHOWS genéricos (no sphere/cirque) -> categoría shows
  ['magic show', '/tours/shows', 5], ['tribute show', '/tours/shows', 5], ['comedy show', '/tours/shows', 5], ['dinner show', '/tours/shows', 5], ['variety show', '/tours/shows', 5], ['mind reading', '/tours/shows', 5], ['burlesque', '/tours/shows', 5], ['mentalist', '/tours/shows', 5], ['cabaret', '/tours/shows', 5],
  // NIGHTLIFE -> categoría nightlife
  ['party bus', '/tours/nightlife', 5], ['club crawl', '/tours/nightlife', 5], ['nightclub', '/tours/nightlife', 5], ['bar crawl', '/tours/nightlife', 5], ['pool crawl', '/tours/nightlife', 5], ['dayclub', '/tours/nightlife', 5], ['speakeasy', '/tours/nightlife', 5],
  ['valley of fire', '/las-vegas-nature-parks-tours', 8], ['red rock canyon', '/las-vegas-nature-parks-tours', 7], ['red rock', '/las-vegas-nature-parks-tours', 7], ['death valley', '/las-vegas-nature-parks-tours', 7],
  ['food and drink tour', '/las-vegas-food-drink-tours', 7], ['food tour', '/las-vegas-food-drink-tours', 7], ['culinary tour', '/las-vegas-food-drink-tours', 7], ['tasting tour', '/las-vegas-food-drink-tours', 7], ['cocktail tour', '/las-vegas-food-drink-tours', 7],
  ['sunset tour', '/las-vegas-sunset-tours', 7], ['golden hour', '/las-vegas-sunset-tours', 7],
  ['combo tour', '/las-vegas-combo-tours', 7], ['combination tour', '/las-vegas-combo-tours', 7],
  ['multi-day tour', '/multi-day-tours-road-trips-las-vegas', 7],
  ['tours under $100', '/best-las-vegas-tours-under-100', 6], ['under $100', '/best-las-vegas-tours-under-100', 6],
  ['tours under $50', '/las-vegas-tours-under-50', 6], ['under $50', '/las-vegas-tours-under-50', 6],
];

const MAX_LINKS_PER_KEYWORD = 1;   // mismas keyword: 1 link por página
const MAX_LINKS_PER_PAGE = 10;

// keywords ordenadas: frase larga primero, luego prioridad
const KEYWORDS = RAW
  .map(([kw, url, priority]) => ({ kw, url, priority, re: new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') }))
  .sort((a, b) => b.kw.length - a.kw.length || b.priority - a.priority);

const rkey = () => randomBytes(6).toString('hex');

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PURA: inserta annotations en un body PortableText.
// Devuelve { body, links: [{kw,url}] }. No muta el original.
// ─────────────────────────────────────────────────────────────
function linkifyBody(body, currentUrl) {
  if (!Array.isArray(body)) return { body, links: [] };
  const links = [];
  const usedUrl = new Map();      // url → count en la página
  let pageCount = 0;

  // IDEMPOTENCIA: precargar los topes con los links que el body YA tiene.
  // Sin esto, cada corrida arranca el contador en 0, no "ve" los links viejos y
  // apila una tanda nueva encima (causa de la duplicación). Contando lo existente
  // contra el tope, correr el script 1 o N veces da el mismo resultado.
  for (const block of body) {
    if (block?._type === 'block' && Array.isArray(block.markDefs)) {
      for (const d of block.markDefs) {
        if (d?._type === 'link' && d.href) {
          usedUrl.set(d.href, (usedUrl.get(d.href) || 0) + 1);
          pageCount++;
        }
      }
    }
  }

  // secciones de LOGÍSTICA donde NO se linkea (ahí viven direcciones, horarios, nombres de venues)
  // + 'quick answer': la respuesta citable por AI engines queda limpia de anchors
  const BLOCKED_SECTIONS = ['included', 'practical', 'best for', 'at a glance', 'insider', 'what to bring', 'good to know', 'quick answer'];
  let blockedSection = false;     // se activa según el último heading

  const out = body.map((block) => {
    if (block?._type !== 'block') return block;
    const style = block.style || 'normal';
    // headings: actualizan la sección actual y no se linkean
    if (typeof style === 'string' && style.startsWith('h')) {
      const ht = (block.children || []).map(s => s.text || '').join('').toLowerCase();
      blockedSection = BLOCKED_SECTIONS.some(b => ht.includes(b));
      return block;
    }
    if (style !== 'normal') return block;
    if (blockedSection) return block;            // saltar secciones de logística
    if (!Array.isArray(block.children)) return block;

    const markDefs = Array.isArray(block.markDefs) ? [...block.markDefs] : [];
    const newChildren = [];

    for (const span of block.children) {
      // saltar spans que no son texto, vacíos, o que YA tienen un link mark
      const hasLink = Array.isArray(span.marks) && span.marks.some(m =>
        markDefs.some(d => d._key === m && d._type === 'link'));
      if (span?._type !== 'span' || typeof span.text !== 'string' || !span.text.trim() || hasLink) {
        newChildren.push(span);
        continue;
      }

      if (pageCount >= MAX_LINKS_PER_PAGE) { newChildren.push(span); continue; }

      const text = span.text;
      // recolectar matches NO solapados, priorizando keywords largas/prioritarias
      const taken = [];
      for (const k of KEYWORDS) {
        if (k.url === currentUrl) continue;                        // no self
        if ((usedUrl.get(k.url) || 0) >= MAX_LINKS_PER_KEYWORD) continue;
        if (pageCount >= MAX_LINKS_PER_PAGE) break;
        const re = new RegExp(k.re.source, 'gi');
        let m;
        while ((m = re.exec(text))) {
          const start = m.index, end = m.index + m[0].length;
          if (taken.some(t => start < t.end && end > t.start)) continue;  // no solapar
          taken.push({ start, end, url: k.url, match: m[0] });
          usedUrl.set(k.url, (usedUrl.get(k.url) || 0) + 1);
          pageCount++;
          links.push({ kw: m[0], url: k.url });
          break;                                                   // 1 ocurrencia por keyword
        }
      }

      if (taken.length === 0) { newChildren.push(span); continue; }

      // reconstruir el span en sub-spans: texto plano + segmentos linkeados
      taken.sort((a, b) => a.start - b.start);
      let cursor = 0;
      for (const t of taken) {
        if (t.start > cursor)
          newChildren.push({ _type: 'span', _key: rkey(), text: text.slice(cursor, t.start), marks: span.marks || [] });
        const linkKey = rkey();
        markDefs.push({ _type: 'link', _key: linkKey, href: t.url });
        newChildren.push({ _type: 'span', _key: rkey(), text: text.slice(t.start, t.end), marks: [...(span.marks || []), linkKey] });
        cursor = t.end;
      }
      if (cursor < text.length)
        newChildren.push({ _type: 'span', _key: rkey(), text: text.slice(cursor), marks: span.marks || [] });
    }

    return { ...block, children: newChildren, markDefs };
  });

  return { body: out, links };
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  const filter = ONLY_SLUG
    ? `*[_type == "post" && slug.current == "${ONLY_SLUG}"]`
    : `*[_type == "post" && defined(slug.current) && discontinued != true]`;
  const posts = await client.fetch(`${filter}{ _id, "slug": slug.current, title, body }`);
  console.log(`${posts.length} tour(s) a procesar${DRY ? ' [DRY-RUN]' : ''}\n`);

  let totalLinks = 0, touched = 0, skipped = 0;
  for (const p of posts) {
    const currentUrl = `/tour/${p.slug}`;

    // SKIP a nivel tour: si el tour YA tiene algún link, no lo tocamos (salvo --force).
    // Esto hace la duplicación imposible y deja el estado legible en el resumen.
    const existing = (p.body || []).reduce((acc, b) =>
      acc + (Array.isArray(b.markDefs) ? b.markDefs.filter(d => d?._type === 'link').length : 0), 0);
    if (existing > 0 && !FORCE) {
      skipped++;
      continue;
    }

    const { body, links } = linkifyBody(p.body, currentUrl);
    if (links.length === 0) continue;
    touched++; totalLinks += links.length;
    console.log(`• ${p.slug}: ${links.length} link(s): ${links.map(l => `"${l.kw}" -> ${l.url}`).join(', ')}`);
    if (!DRY) {
      await client.patch(p._id).set({ body }).commit();
    }
  }
  console.log(`\n${DRY ? '[DRY-RUN] ' : ''}${touched} tours tocados, ${totalLinks} links, ${skipped} saltados (ya tenían links)${DRY ? ' (no se escribió nada)' : ''}`);
}

export { linkifyBody };

main().catch(e => { console.error(e.message); process.exit(1); });
