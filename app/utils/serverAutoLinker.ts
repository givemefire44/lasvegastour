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
