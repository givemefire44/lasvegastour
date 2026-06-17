// orderTourBody.ts - Orden canonico de secciones, aplicado en el SERVER (page.tsx)
// en cada carga. El orden deja de vivir en el dato de Sanity (que puede quedar como
// sea, lo toque un injector o una edicion a mano) y pasa a ser una GARANTIA del render.
//
// Funcion PURA y determinista: mismo body -> mismo orden, en server y cliente, asi que
// no hay riesgo de hidratacion. Las huerfanas se descartan del render (no del dato).
// Las secciones ausentes simplemente no aparecen; las desconocidas se preservan al final.
//
// Convivencia de ordenes: el orden se elige por categoria (ver getOrder). Los tours usan
// ORDER_TOUR; los de categoria 'shows' usan ORDER_SHOW (igual pero sin included/not-included).
// Para afinar cualquiera de los dos, se edita SOLO su lista de abajo, nada mas.

type Block = any;

const isHeading = (b: Block) =>
  b && b._type === 'block' && ['h1', 'h2', 'h3', 'h4'].includes(b.style);
const headingText = (b: Block) =>
  (b?.children || []).map((c: any) => c.text || '').join('');
const isGlanceTable = (b: Block) =>
  b && b._type === 'simpleTable' && /at a glance/i.test(b.title || '');

// Huerfanas a DESCARTAR del render (heading que matchee alguno de estos).
const ORPHANS = [/the itinerary/i, /what you'?ll see/i, /tour format/i, /best for/i];

// Identificacion de secciones por su heading. Se evalua EN ORDEN:
// 'not-included' va antes que 'included' (mas especifico) para no robarselo.
const MATCHERS: { key: string; test: (h: string) => boolean }[] = [
  { key: 'quick-answer', test: h => /quick answer/i.test(h) },
  { key: 'at-a-glance',  test: h => /at a glance/i.test(h) },
  { key: 'why-book',     test: h => /why people book/i.test(h) },
  { key: 'experience',   test: h => /the experience/i.test(h) },
  { key: 'worth-it',     test: h => /worth it/i.test(h) },
  { key: 'not-included', test: h => /not\s+included/i.test(h) },
  { key: 'included',     test: h => /included/i.test(h) },
  { key: 'practical',    test: h => /practical info/i.test(h) },
  { key: 'insider-tip',  test: h => /insider tip/i.test(h) },
];

// Orden canonico de TOURS (las secciones que el body controla; FAQs / Compare /
// Editorial los renderiza el front, no estan en el body).
const ORDER_TOUR = [
  'quick-answer', 'at-a-glance', 'why-book', 'experience',
  'worth-it', 'included', 'not-included', 'practical', 'insider-tip',
];

// Orden de SHOWS. Un show es el ticket, no un recorrido: se le caen included /
// not-included (no hay almuerzo, transporte ni guia que enumerar). Las categorias de
// asiento van por NOMBRE dentro de Practical; el detalle/precio lo resuelve Viator al
// hacer click. Si un show arrastra included/not-included del molde de tour, al no estar
// en esta lista se descartan del render (como las huerfanas), no del dato en Sanity.
const ORDER_SHOW = [
  'quick-answer', 'at-a-glance', 'why-book', 'experience',
  'worth-it', 'practical', 'insider-tip',
];

function getOrder(categorySlug?: string | null): string[] {
  return categorySlug === 'shows' ? ORDER_SHOW : ORDER_TOUR;
}

function classifyHeading(h: string): string | null {
  if (ORPHANS.some(re => re.test(h))) return '__orphan__';
  for (const m of MATCHERS) if (m.test(h)) return m.key;
  return null; // desconocida -> se preserva al final, nunca se pierde
}

export function orderTourBody(body: Block[], categorySlug?: string | null): Block[] {
  if (!Array.isArray(body) || body.length === 0) return body;
  const ORDER = getOrder(categorySlug);

  // 1. Sacar los simpleTable "at a glance" a un buffer (van a la seccion at-a-glance).
  const glanceTables: Block[] = [];
  const rest: Block[] = [];
  for (const b of body) (isGlanceTable(b) ? glanceTables : rest).push(b);

  // 2. Particionar `rest` por headings: intro (antes del 1er heading) + secciones.
  const intro: Block[] = [];
  const sections: { key: string | null; blocks: Block[] }[] = [];
  let cur: { key: string | null; blocks: Block[] } | null = null;
  for (const b of rest) {
    if (isHeading(b)) {
      cur = { key: classifyHeading(headingText(b)), blocks: [b] };
      sections.push(cur);
    } else if (cur) {
      cur.blocks.push(b);
    } else {
      intro.push(b);
    }
  }

  // 3. Agrupar por key. Descartar huerfanas. Preservar desconocidas al final.
  const byKey: Record<string, Block[]> = {};
  const unknown: Block[] = [];
  for (const s of sections) {
    if (s.key === '__orphan__') continue;
    if (s.key === null) { unknown.push(...s.blocks); continue; }
    byKey[s.key] = byKey[s.key] ? [...byKey[s.key], ...s.blocks] : [...s.blocks];
  }
  if (glanceTables.length) {
    byKey['at-a-glance'] = [...(byKey['at-a-glance'] || []), ...glanceTables];
  }

  // 4. Ensamblar en orden canonico. Desconocidas al final (no se pierden).
  const out: Block[] = [...intro];
  for (const key of ORDER) if (byKey[key]) out.push(...byKey[key]);
  out.push(...unknown);

  return out;
}