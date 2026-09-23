// utils/serverAutoLinker.ts — AUTOLINKER SERVER-SIDE PARA HUBS (Vegas) 🎰
//
// Vegas es distinto al resto del portfolio: el linking de tours/artículos está
// PERSISTIDO en Sanity (tour-importer/link-tours.mjs + link-articles.mjs escriben
// markDefs una vez). Acá NO hay linkifyBlocks render-time — sería redundante.
//
// Lo que faltaba: los HUBS renderizan hub-content.json (texto plano, sin markDefs)
// y no linkeaban a nada. Este módulo linkifica los intros y FAQs de los hubs al
// momento del render server (determinístico, en memoria, HTML inicial crawleable),
// bajando a las GUÍAS según la jerarquía del portfolio (hubs → artículos).
//
// Reglas: 1 link por keyword por página, máx 2 por texto, cap 8 por página,
// guard anti self-link. Mismo patrón que trastevere/seoul/colosseum/vatican.

interface KeywordConfig {
  maxLinks: number;
  priority: number;
  variations?: string[];
}

// ═══════════════════════════════════════════════
// 🎰 LINKS DESDE HUBS → GUÍAS (artículos reales del sitio, jul 2026)
// ═══════════════════════════════════════════════
const LINKS_FOR_HUBS: Record<string, string> = {
  'west rim': '/grand-canyon-west-vs-south-rim-from-las-vegas',
  'south rim': '/grand-canyon-west-vs-south-rim-from-las-vegas',
  'grand canyon': '/grand-canyon-west-vs-south-rim-from-las-vegas',
  'helicopter tour': '/las-vegas-helicopter-tours-which-worth-it',
  'hoover dam': '/hoover-dam-tour-from-las-vegas',
  'valley of fire': '/valley-of-fire-from-las-vegas',
  'red rock': '/red-rock-canyon-from-las-vegas',
  'sphere': '/sphere-las-vegas-seats-tickets-guide',
  'which show': '/how-to-choose-las-vegas-shows',
  'show tickets': '/how-to-choose-las-vegas-shows',
  'nightlife': '/las-vegas-nightlife-club-crawls',
  'party bus': '/las-vegas-nightlife-club-crawls',
  'first-timer': '/first-time-las-vegas-how-to-plan',
  'budget': '/how-much-las-vegas-trip-costs',
  'resort fees': '/las-vegas-resort-fees-tipping-hidden-charges',
  'tipping': '/las-vegas-resort-fees-tipping-hidden-charges',
  'get around': '/how-to-get-around-las-vegas',
  'mistakes': '/most-expensive-first-timer-mistakes-las-vegas',
};

const KEYWORDS_CONFIG: Record<string, KeywordConfig> = {
  'west rim': { maxLinks: 1, priority: 9, variations: ['grand canyon west'] },
  'south rim': { maxLinks: 1, priority: 9, variations: ['grand canyon south'] },
  'grand canyon': { maxLinks: 1, priority: 5 },
  'helicopter tour': { maxLinks: 1, priority: 8, variations: ['helicopter tours', 'helicopter ride', 'helicopter flight'] },
  'hoover dam': { maxLinks: 1, priority: 8 },
  'valley of fire': { maxLinks: 1, priority: 8 },
  'red rock': { maxLinks: 1, priority: 8, variations: ['red rock canyon'] },
  'sphere': { maxLinks: 1, priority: 8, variations: ['the sphere'] },
  'which show': { maxLinks: 1, priority: 6, variations: ['choose a show', 'choosing a show', 'right show'] },
  'show tickets': { maxLinks: 1, priority: 6 },
  'nightlife': { maxLinks: 1, priority: 6, variations: ['club crawl', 'club crawls'] },
  'party bus': { maxLinks: 1, priority: 6 },
  'first-timer': { maxLinks: 1, priority: 6, variations: ['first time', 'first-time', 'first timer'] },
  'budget': { maxLinks: 1, priority: 5, variations: ['on a budget', 'trip costs'] },
  'resort fees': { maxLinks: 1, priority: 6, variations: ['hidden charges', 'hidden fees'] },
  'tipping': { maxLinks: 1, priority: 5 },
  'get around': { maxLinks: 1, priority: 5, variations: ['getting around', 'without a car'] },
  'mistakes': { maxLinks: 1, priority: 5, variations: ['common mistakes', 'expensive mistakes'] },
};

// ═══════════════════════════════════════════════
// 🎰 LINKS DESDE ARTICULOS Y TOURS → CATEGORIAS DE TOURS
//
// Portado de tour-importer/link-articles.mjs (mismo mapa que link-tours.mjs).
// Es OTRA direccion que LINKS_FOR_HUBS: aquel baja de hub a guia, este lleva de
// la guia hacia lo que se vende. [keyword, href, prioridad]
// ═══════════════════════════════════════════════
const LINKS_TO_TOURS: [string, string, number][] = [
  ['west rim', '/grand-canyon-west-rim-tours', 9], ['grand canyon west', '/grand-canyon-west-rim-tours', 9],
  ['skywalk', '/grand-canyon-west-rim-tours', 9], ['eagle point', '/grand-canyon-west-rim-tours', 9],
  ['south rim', '/grand-canyon-south-rim-tours', 8], ['grand canyon south', '/grand-canyon-south-rim-tours', 8],
  ['grand canyon helicopter', '/grand-canyon-helicopter-tours', 8], ['helicopter landing', '/grand-canyon-helicopter-tours', 8],
  ['antelope canyon', '/antelope-canyon-horseshoe-bend-tours', 9], ['horseshoe bend', '/antelope-canyon-horseshoe-bend-tours', 9],
  ['wizard of oz', '/sphere-las-vegas-shows', 9],
  ['cirque du soleil', '/cirque-du-soleil-shows-las-vegas', 8], ['mystère', '/cirque-du-soleil-shows-las-vegas', 8],
  ['mystere', '/cirque-du-soleil-shows-las-vegas', 8], ['mad apple', '/cirque-du-soleil-shows-las-vegas', 8],
  ['michael jackson one', '/cirque-du-soleil-shows-las-vegas', 8], ['cirque', '/cirque-du-soleil-shows-las-vegas', 7],
  ['magic show', '/tours/shows', 5], ['tribute show', '/tours/shows', 5], ['comedy show', '/tours/shows', 5],
  ['dinner show', '/tours/shows', 5], ['variety show', '/tours/shows', 5], ['burlesque', '/tours/shows', 5],
  ['party bus', '/tours/nightlife', 5], ['club crawl', '/tours/nightlife', 5], ['nightclub', '/tours/nightlife', 5],
  ['bar crawl', '/tours/nightlife', 5], ['dayclub', '/tours/nightlife', 5], ['speakeasy', '/tours/nightlife', 5],
  ['valley of fire', '/las-vegas-nature-parks-tours', 8], ['red rock canyon', '/las-vegas-nature-parks-tours', 7],
  ['red rock', '/las-vegas-nature-parks-tours', 7], ['death valley', '/las-vegas-nature-parks-tours', 7],
  ['food tour', '/las-vegas-food-drink-tours', 7], ['culinary tour', '/las-vegas-food-drink-tours', 7],
  ['tasting tour', '/las-vegas-food-drink-tours', 7], ['cocktail tour', '/las-vegas-food-drink-tours', 7],
  ['sunset tour', '/las-vegas-sunset-tours', 7], ['combo tour', '/las-vegas-combo-tours', 7],
  ['hoover dam', '/tours/hoover-dam-tours', 7],
  ['helicopter tour', '/tours/helicopter-tours', 6], ['helicopter ride', '/tours/helicopter-tours', 6],
  ['helicopter', '/tours/helicopter-tours', 4],
  ['grand canyon', '/tours/grand-canyon-tours', 5],
  ['day trip', '/tours/day-trips', 5], ['day trips', '/tours/day-trips', 5],
  ['the strip', '/tours/strip-tours', 5], ['las vegas strip', '/tours/strip-tours', 6],
  ['adventure tour', '/tours/adventure-tours', 5], ['zipline', '/tours/adventure-tours', 5],
  // Off-road y pista tienen hub propio desde el 23 sep 2026. Antes caian en la categoria
  // /tours/adventure-tours, que mezcla ATV con tiro, kayak y caballos. Peso mas alto que la
  // categoria para que gane el hub cuando las dos podrian matchear.
  ['atv', '/las-vegas-atv-off-road-tours', 7], ['utv', '/las-vegas-atv-off-road-tours', 7],
  ['rzr', '/las-vegas-atv-off-road-tours', 7], ['dune buggy', '/las-vegas-atv-off-road-tours', 7],
  ['off-road', '/las-vegas-atv-off-road-tours', 7], ['off road', '/las-vegas-atv-off-road-tours', 7],
  ['supercar', '/las-vegas-supercar-driving', 7], ['exotic car', '/las-vegas-supercar-driving', 7],
  ['race track', '/las-vegas-supercar-driving', 6], ['ride-along', '/las-vegas-supercar-driving', 6],
];

export type PageType = 'hub' | 'article' | 'tour';

const MAX_LINKS_PER_PAGE = 8;

interface LinkState {
  usedKeywords: Set<string>;
  totalLinks: number;
}

export function createLinkState(): LinkState {
  return { usedKeywords: new Set(), totalLinks: 0 };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function orderedKeywords(currentSlug: string) {
  return Object.entries(KEYWORDS_CONFIG)
    .map(([base, cfg]) => ({
      base,
      href: LINKS_FOR_HUBS[base],
      priority: cfg.priority,
      variations: [base, ...(cfg.variations || [])].sort((a, b) => b.length - a.length),
    }))
    .filter((k) => {
      if (!k.href) return false;
      const target = k.href.replace(/^\//, '');
      if (currentSlug && (target === currentSlug || currentSlug === target)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXTO PLANO → HTML linkificado (intros y FAQs de hubs). Escapa HTML primero.
// Compartir `state` entre párrafos de la misma página para respetar los caps.
// ─────────────────────────────────────────────────────────────────────────────
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function linkifyText(
  text: string,
  currentSlug: string,
  state: LinkState = createLinkState()
): string {
  let html = escapeHtml(String(text || ''));
  if (!html) return html;
  const keywords = orderedKeywords(currentSlug);
  let linksInThisText = 0;
  const MAX_PER_TEXT = 2; // un intro corto no debería llevar más de 2

  for (const kw of keywords) {
    if (state.totalLinks >= MAX_LINKS_PER_PAGE || linksInThisText >= MAX_PER_TEXT) break;
    if (state.usedKeywords.has(kw.base)) continue;
    for (const variation of kw.variations) {
      const re = new RegExp(`\\b(${escapeRegex(escapeHtml(variation))})\\b(?![^<]*<\\/a>)`, 'i');
      if (re.test(html)) {
        html = html.replace(re, `<a href="${kw.href}" class="auto-link safe-link" title="More about $1">$1</a>`);
        state.usedKeywords.add(kw.base);
        state.totalLinks++;
        linksInThisText++;
        break;
      }
    }
  }
  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUES DE SANITY → bloques con markDefs. Para articulos (page.content) y
// tours (post.body).
//
// POR QUE EXISTE. Vegas nacio persistiendo los links en Sanity con
// link-articles.mjs / link-tours.mjs, que hay que acordarse de correr. Nadie los
// corrio desde junio: medido el 10 sep 2026, 175 de 409 tours y 6 de 24
// articulos quedaron sin un solo enlace interno, y 158 de esos tours SI tienen
// palabras del mapa en su texto. O sea que no faltaba vocabulario: faltaba que
// alguien corriera el script. Esto lo hace solo, en cada render.
//
// NO PISA LO QUE YA ESTA. Si un span ya tiene marca de link -los que escribio el
// script en junio- lo saltea. Por eso se activa sin limpiar nada antes.
//
// EL QUICK ANSWER NO SE LINKEA: es la respuesta que citan los motores de IA y
// tiene que quedar limpia. Mismo criterio que colosseum, vatican y trastevere.
// ─────────────────────────────────────────────────────────────────────────────
let autoKeyCounter = 0;
const nextAutoKey = () => `al${(++autoKeyCounter).toString(36)}`;

function tourKeywords(currentSlug: string) {
  return LINKS_TO_TOURS
    .filter(([, href]) => href.replace(/^\//, '') !== currentSlug)
    .map(([kw, href, priority]) => ({ kw, href, priority }))
    .sort((a, b) => b.kw.length - a.kw.length || b.priority - a.priority);
}

export function linkifyBlocks(
  blocks: any[],
  pageType: PageType,
  currentSlug: string,
  state: LinkState = createLinkState()
): any[] {
  if (!Array.isArray(blocks)) return blocks;
  if (pageType === 'hub') return blocks;
  const keywords = tourKeywords(currentSlug);

  // PRE-BARRIDO, y sin esto se duplica. La guarda de mas abajo evita re-linkear
  // el MISMO span, pero no sabe que ese destino ya se uso en otro parrafo: sin
  // este paso, un documento con "Hoover Dam" linkeado en el parrafo 2 recibia un
  // segundo link a la misma categoria en el parrafo 7. Medido en local el 10 sep
  // 2026 sobre /hoover-dam-tour-from-las-vegas: daba 12 links donde tenia 6.
  // Aca se anotan los destinos que el documento YA trae, para no repetirlos.
  const hrefsYaUsados = new Set<string>();
  for (const b of blocks) {
    if (!b || b._type !== 'block') continue;
    for (const d of (b.markDefs || [])) {
      if (d && d._type === 'link' && d.href) hrefsYaUsados.add(d.href);
    }
  }
  for (const kw of keywords) {
    if (hrefsYaUsados.has(kw.href)) state.usedKeywords.add(kw.kw);
  }
  state.totalLinks += hrefsYaUsados.size;

  // UN LINK POR DESTINO, y sin esto queda spam. Varias palabras distintas
  // apuntan al mismo lado -"cirque du soleil", "cirque", "mystere" y "michael
  // jackson one" van todas a /cirque-du-soleil-shows-las-vegas- y el contador
  // de keywords no lo ve. Medido en local el 10 sep 2026 sobre
  // /las-vegas-show-ratings-what-they-hide: cuatro links a la misma pagina.
  // `hrefsYaUsados` se va llenando a medida que se linkea, y se consulta antes.

  let inQuickAnswer = false;

  return blocks.map((block: any) => {
    if (!block || block._type !== 'block') return block;

    const texto = (block.children || []).map((c: any) => c.text || '').join('');

    // Un heading abre o cierra la zona protegida del Quick Answer.
    if (block.style && block.style !== 'normal') {
      inQuickAnswer = /quick answer/i.test(texto);
      return block;
    }
    if (inQuickAnswer) return block;
    if (state.totalLinks >= MAX_LINKS_PER_PAGE) return block;

    const existingLinkKeys = new Set(
      (block.markDefs || []).filter((d: any) => d._type === 'link').map((d: any) => d._key)
    );

    let children = block.children || [];
    const nuevosDefs: any[] = [];

    for (const kw of keywords) {
      if (state.totalLinks >= MAX_LINKS_PER_PAGE) break;
      if (state.usedKeywords.has(kw.kw)) continue;
      if (hrefsYaUsados.has(kw.href)) continue; // ese destino ya tiene su link

      const re = new RegExp('\\b' + escapeRegex(kw.kw) + '\\b', 'i');
      let hecho = false;
      const salida: any[] = [];

      for (const child of children) {
        if (hecho || child._type !== 'span' || !child.text) { salida.push(child); continue; }
        // Ya linkeado por el script de junio: no se toca.
        if ((child.marks || []).some((m: string) => existingLinkKeys.has(m))) { salida.push(child); continue; }

        const m = child.text.match(re);
        if (!m || m.index === undefined) { salida.push(child); continue; }

        const i = m.index;
        const defKey = nextAutoKey();
        if (i > 0) salida.push({ ...child, _key: nextAutoKey(), text: child.text.slice(0, i) });
        salida.push({ ...child, _key: nextAutoKey(), text: m[0], marks: [...(child.marks || []), defKey] });
        const resto = child.text.slice(i + m[0].length);
        if (resto) salida.push({ ...child, _key: nextAutoKey(), text: resto });

        nuevosDefs.push({ _key: defKey, _type: 'link', href: kw.href });
        state.usedKeywords.add(kw.kw);
        hrefsYaUsados.add(kw.href);
        state.totalLinks++;
        hecho = true;
      }
      if (hecho) children = salida;
    }

    if (!nuevosDefs.length) return block;
    return { ...block, children, markDefs: [...(block.markDefs || []), ...nuevosDefs] };
  });
}
