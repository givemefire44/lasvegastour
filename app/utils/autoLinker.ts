// utils/autoLinker.ts - SISTEMA JERÁRQUICO DE LINKING 🏛️
// Tours/Artículos → Hubs | Hubs → Artículos

import { client } from '@/sanity/lib/client';

interface AutoLinkerConfig {
  maxLinksPerPage: number;
  maxLinksPerKeyword?: number;
  minWordsBetween: number;
  maxDensity: number;
  currentTourSlug?: string;
  pageType?: 'tour' | 'article' | 'hub';
}

interface KeywordConfig {
  maxLinks: number;
  priority: number;
  variations?: string[];
}

// ═══════════════════════════════════════════════
// 🏛️ LINKS DESDE TOURS Y ARTÍCULOS → HUBS
// ═══════════════════════════════════════════════
const LINKS_FOR_TOURS_AND_ARTICLES: Record<string, string> = {
  // Tour-type keywords → HUBS (transaccional)
  'underground tour': '/best-colosseum-underground-tours',
  'underground access': '/best-colosseum-underground-tours',
  'underground tours': '/best-colosseum-underground-tours',
  'hypogeum': '/best-colosseum-underground-tours',
  'night tour': '/best-colosseum-night-tours',
  'evening tour': '/best-colosseum-night-tours',
  'night tours': '/best-colosseum-night-tours',
  'colosseum at night': '/best-colosseum-night-tours',
  'after dark': '/best-colosseum-night-tours',
  'arena tour': '/best-colosseum-arena-floor-tours',
  'arena floor': '/best-colosseum-arena-floor-tours',
  'arena floor tours': '/best-colosseum-arena-floor-tours',
  'arena tours': '/best-colosseum-arena-floor-tours',
  'gladiator entrance': '/best-colosseum-arena-floor-tours',
  'private tour': '/best-colosseum-private-tours',
  'private colosseum': '/best-colosseum-private-tours',
  'private tours': '/best-colosseum-private-tours',
  'private colosseum tours': '/best-colosseum-private-tours',
  'skip the line': '/best-colosseum-skip-the-line-tours',
  'skip-the-line': '/best-colosseum-skip-the-line-tours',
  'skip the line tours': '/best-colosseum-skip-the-line-tours',
  'fast track': '/best-colosseum-skip-the-line-tours',
  'small group tour': '/best-colosseum-small-group-tours',
  'small group tours': '/best-colosseum-small-group-tours',
  'small group': '/best-colosseum-small-group-tours',
  'intimate tour': '/best-colosseum-small-group-tours',
  'guided tour': '/best-colosseum-guided-tours',
  'guided tours': '/best-colosseum-guided-tours',
  'guided colosseum tours': '/best-colosseum-guided-tours',
  'roman forum': '/best-roman-forum-tours',
  'roman forum tours': '/best-roman-forum-tours',
  'forum tours': '/best-roman-forum-tours',
  'forum romano': '/best-roman-forum-tours',
  'ancient forum': '/best-roman-forum-tours',
  'full experience': '/colosseum-full-experience-tours',
  'full experience tours': '/colosseum-full-experience-tours',
  
};

// ═══════════════════════════════════════════════
// 🏛️ LINKS DESDE HUBS → ARTÍCULOS
// ═══════════════════════════════════════════════
const LINKS_FOR_HUBS: Record<string, string> = {
  'underground tour': '/colosseum-underground-tour-ticket',
  'underground access': '/colosseum-underground-tour-ticket',
  'hypogeum': '/colosseum-underground-tour-ticket',
  'night tour': '/colosseum-night-tour-is-the-evening-visit-worth-it',
  'evening tour': '/colosseum-night-tour-is-the-evening-visit-worth-it',
  'colosseum at night': '/colosseum-night-tour-is-the-evening-visit-worth-it',
  'after dark': '/colosseum-night-tour-is-the-evening-visit-worth-it',
  'arena tour': '/colosseum-arena-tour',
  'arena floor': '/colosseum-arena-tour',
  'gladiator entrance': '/colosseum-arena-tour',
  'private tour': '/private-colosseum-tour',
  'private colosseum': '/private-colosseum-tour',
  'skip the line': '/skip-the-colosseum-roman-tour-line',
  'skip-the-line': '/skip-the-colosseum-roman-tour-line',
  'fast track': '/skip-the-colosseum-roman-tour-line',
  'complete guide': '/complete-guide-to-visiting-the-roman-colosseum-step-by-step',
  'comprehensive guide': '/complete-guide-to-visiting-the-roman-colosseum-step-by-step',
  'full guide': '/complete-guide-to-visiting-the-roman-colosseum-step-by-step',
  'common mistakes': '/7-mistakes-people-make-when-booking-colosseum-tickets',
  'mistakes to avoid': '/7-mistakes-people-make-when-booking-colosseum-tickets',
  'booking tips': '/colosseum-tours-and-tickets-how-to-book-and-fix-common-problems',
  'how to book': '/colosseum-tours-and-tickets-how-to-book-and-fix-common-problems',
  'ticket options': '/colosseum-tickets-what-s-really-included-and-what-isn-t-in-each-option',
  'what is included': '/colosseum-tickets-what-s-really-included-and-what-isn-t-in-each-option',
  'roman forum': '/roman-forum',
  'forum romano': '/roman-forum',
  'palatine hill': '/palatine-hill',
  'palatino': '/palatine-hill',
  'best tour': '/best-colosseum-tour-for-every-type-of-traveler',
  'colosseum faq': '/colosseum-rome-faq-visitor-tips-or-LasVegasTour-com',
};

// Variable legacy para compatibilidad
const ARTICLE_LINKS = LINKS_FOR_TOURS_AND_ARTICLES;

// ═══════════════════════════════════════════════
// 🛡️ KEYWORDS CONFIG
// ═══════════════════════════════════════════════
const KEYWORDS_CONFIG: Record<string, KeywordConfig> = {

  // 📚 ARTÍCULOS - ALTA PRIORIDAD
  'complete guide': {
    maxLinks: 1,
    priority: 9,
    variations: ['comprehensive guide', 'full guide']
  },

  // 🏛️ TOUR TYPES (apuntan a hub o artículo según pageType)
  'underground tour': {
    maxLinks: 1,
    priority: 8,
    variations: ['underground access', 'hypogeum', 'underground tours']
  },
  
  'night tour': {
    maxLinks: 1,
    priority: 8,
    variations: ['evening tour', 'colosseum at night', 'after dark', 'night tours']
  },

  'arena tour': {
    maxLinks: 1,
    priority: 8,
    variations: ['arena floor', 'gladiator entrance', 'arena floor tours', 'arena tours']
  },

  'private tour': {
    maxLinks: 1,
    priority: 8,
    variations: ['private colosseum', 'private tours', 'private colosseum tours']
  },
  
  'skip the line': {
    maxLinks: 1,
    priority: 8,
    variations: ['skip-the-line', 'fast track', 'skip the line tours']
  },

  'small group tour': {
    maxLinks: 1,
    priority: 8,
    variations: ['intimate tour', 'small group', 'small group tours']
  },

  'guided tour': {
    maxLinks: 1,
    priority: 8,
    variations: ['guided tours', 'guided colosseum tours']
  },

  'roman forum': {
    maxLinks: 1,
    priority: 7,
    variations: ['forum romano', 'ancient forum', 'roman forum tours', 'forum tours']
  },

  'full experience': {
    maxLinks: 1,
    priority: 7,
    variations: ['full experience tours']
  },

  'palatine hill': {
    maxLinks: 1,
    priority: 7,
    variations: ['palatino']
  },

  // 📚 ARTÍCULOS INFORMATIVOS

  


  
 

  // 💰 COMMERCIAL ANCHORS
  'colosseum tickets': {
    maxLinks: 1,
    priority: 6,
    variations: ['tickets', 'entrance passes']
  },

  'vip access': {
    maxLinks: 1,
    priority: 5,
    variations: ['exclusive access', 'premium experience']
  },

  // 📚 INFORMATIONAL
  'ancient amphitheater': {
    maxLinks: 1,
    priority: 6,
    variations: ['roman amphitheater', 'historic amphitheater']
  },

  'gladiator history': {
    maxLinks: 1,
    priority: 5,
    variations: ['gladiator stories', 'ancient entertainment']
  },

  'roman empire': {
    maxLinks: 1,
    priority: 5,
    variations: ['ancient rome', 'imperial rome']
  },

  // 🏷️ BRANDED ANCHORS
  'our experience': {
    maxLinks: 1,
    priority: 6,
    variations: ['our tours', 'our guides', 'our recommendations']
  },

  'we recommend': {
    maxLinks: 1,
    priority: 5,
    variations: ['we suggest', 'our advice']
  },

  // 🔗 GENERIC ANCHORS
  'more information': {
    maxLinks: 1,
    priority: 5,
    variations: ['learn more', 'read more', 'discover more']
  },

  'detailed guide': {
    maxLinks: 1,
    priority: 5,
    variations: ['travel guide']
  },

  // 🎯 NAKED ANCHORS
  'here': {
    maxLinks: 1,
    priority: 4,
    variations: ['click here', 'this link']
  },

  // 🏛️ ATTRACTIONS
  'colosseum': {
    maxLinks: 1,
    priority: 4,
    variations: ['roman colosseum', 'ancient colosseum']
  },

  // ⛪ VATICAN
  'vatican': {
    maxLinks: 1,
    priority: 4,
    variations: ['vatican city', 'vatican museums']
  },

  'sistine chapel': {
    maxLinks: 1,
    priority: 4,
    variations: ['sistine chapel tour', 'michelangelo chapel']
  },

  "st peter's basilica": {
    maxLinks: 1,
    priority: 4,
    variations: ['st peters basilica', 'papal basilica']
  },

  // 🏛️ ROME
  'pantheon': {
    maxLinks: 1,
    priority: 3,
    variations: ['roman pantheon']
  },

  'trevi fountain': {
    maxLinks: 1,
    priority: 3,
    variations: ['fontana di trevi']
  },

  'spanish steps': {
    maxLinks: 1,
    priority: 3,
    variations: ['scalinata di spagna']
  },

  'colosseum faq': {
    maxLinks: 1,
    priority: 5,
    variations: ['frequently asked']
  }
};

// ═══════════════════════════════════════════════
// 🛡️ CONFIGURACIÓN SEGURA
// ═══════════════════════════════════════════════
const defaultConfig: AutoLinkerConfig = {
  maxLinksPerPage: 8,
  maxLinksPerKeyword: 1,
  minWordsBetween: 120,
  maxDensity: 1.5
};

// 🔄 CACHE Y PÁGINAS ORDENADAS
let urlsCache: string[] = [];
let cacheInitialized = false;
let sortedPages: PageInfo[] = [];

interface PageInfo {
  url: string;
  slug: string;
  createdAt: string;
}

// 🎯 STORAGE GLOBAL DE CONTADORES 
const globalCounters = new Map<string, Map<string, number>>();

interface LinkOpportunity {
  keyword: string;
  baseKeyword: string;
  url: string;
  position: number;
  length: number;
  priority: number;
  maxAllowed: number;
}

class CircularProximityAutoLinker {
  private config: AutoLinkerConfig;
  private allPages: PageInfo[] = [];
  private keywordCounts: Map<string, number>;
  private pageId: string;

  constructor(config: Partial<AutoLinkerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.pageId = config.currentTourSlug || 'default-page';
    
    if (!globalCounters.has(this.pageId)) {
      globalCounters.set(this.pageId, new Map());
    }
    this.keywordCounts = globalCounters.get(this.pageId)!;
  }

  async processText(text: string): Promise<string> {
    if (!text || typeof text !== 'string') return text;
    
    // 🛡️ NO PROCESAR SI YA TIENE HTML
    if (text.includes('<a ') || text.includes('</a>') || text.includes('href=')) {
      return text;
    }
  
    await this.syncPagesFromSanity();
    
    const totalWords = this.countWords(text);
    const opportunities = this.findCircularOpportunities(text);
    const selectedLinks = this.selectLinksWithSafety(opportunities, totalWords);
    
    return this.applyLinks(text, selectedLinks);
  }

  // 🔄 SYNC PÁGINAS CON FECHA DE CREACIÓN
  private async syncPagesFromSanity(): Promise<void> {
    if (cacheInitialized && sortedPages.length > 0) {
      this.allPages = sortedPages;
      return;
    }

    try {
      const data = await client.fetch(`
        {
          "posts": *[_type == "post" && defined(slug.current) && discontinued != true][0...100] | order(_createdAt asc) {
            "slug": slug.current,
            "createdAt": _createdAt,
            "type": "post"
          },
          "pages": *[_type == "page" && defined(slug.current)][0...20] | order(_createdAt asc) {
            "slug": slug.current,
            "createdAt": _createdAt,
            "type": "page"
          }
        }
      `);

      const pages: PageInfo[] = [];
      
      if (data.posts) {
        data.posts.forEach((post: any) => {
          if (post.slug) {
            pages.push({
              url: `/tour/${post.slug}`,
              slug: post.slug,
              createdAt: post.createdAt
            });
          }
        });
      }

      if (data.pages) {
        data.pages.forEach((page: any) => {
          if (page.slug) {
            pages.push({
              url: `/${page.slug}`,
              slug: page.slug,
              createdAt: page.createdAt
            });
          }
        });
      }

      sortedPages = pages.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      cacheInitialized = true;
      this.allPages = sortedPages;

      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log(`🛡️ SAFE AutoLinker: ${pages.length} pages synced - Safe config active`);
      }
      
    } catch (error) {
      this.allPages = [];
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.error('❌ AutoLinker sync failed');
      }
    }
  }

  // 🎯 BUSCAR OPORTUNIDADES CON SISTEMA CIRCULAR
  private findCircularOpportunities(text: string): LinkOpportunity[] {
    const opportunities: LinkOpportunity[] = [];
    
    Object.entries(KEYWORDS_CONFIG).forEach(([baseKeyword, config]) => {
      const targetUrl = this.findCircularTarget(baseKeyword);
      if (!targetUrl) return;

      const allVariations = [baseKeyword, ...(config.variations || [])];
      
      allVariations.forEach(variation => {
        const regex = new RegExp(`\\b${this.escapeRegex(variation)}\\b`, 'gi');
        let match;
        let linkCount = 0;

        while ((match = regex.exec(text)) !== null && linkCount < config.maxLinks) {
          if (this.isInsideLink(text, match.index)) continue;
          
          // 🛡️ PROBABILIDAD DE SALTEAR (35% chance)
          if (Math.random() < 0.35) continue;
          
          if (linkCount > 0) {
            const lastOpportunity = opportunities
              .filter(opp => opp.baseKeyword === baseKeyword)
              .pop();
            
            if (lastOpportunity) {
              const distance = match.index - (lastOpportunity.position + lastOpportunity.length);
              const wordDistance = distance / 5;
              
              if (wordDistance < this.config.minWordsBetween) {
                continue;
              }
            }
          }

          opportunities.push({
            keyword: match[0],
            baseKeyword: baseKeyword,
            url: targetUrl,
            position: match.index,
            length: match[0].length,
            priority: config.priority,
            maxAllowed: config.maxLinks
          });
          
          linkCount++;
        }
      });
    });

    return opportunities.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.position - b.position;
    });
  }

  // 🏛️ ENCONTRAR TARGET SEGÚN JERARQUÍA
  // Tours/Artículos → Hubs | Hubs → Artículos
  private findCircularTarget(keyword: string): string | null {
    const keywordLower = keyword.toLowerCase();
    
    // 🎯 Elegir mapa según tipo de página
    const linkMap = this.config.pageType === 'hub' 
      ? LINKS_FOR_HUBS 
      : LINKS_FOR_TOURS_AND_ARTICLES;
    
    // 🎯 PRIMERO: Buscar en links fijos según jerarquía
    if (linkMap[keywordLower]) {
      const targetUrl = linkMap[keywordLower];
      // No linkear a la misma página
      if (targetUrl.includes(this.pageId) || this.pageId.includes(targetUrl.replace('/', '').replace('/tour/', ''))) {
        return null;
      }
      return targetUrl;
    }
    
    // 🔄 SEGUNDO: Búsqueda circular en Sanity (fallback)
    if (this.allPages.length === 0) return null;
    
    const currentPageIndex = this.allPages.findIndex(page => 
      page.slug === this.pageId
    );
    
    if (currentPageIndex === -1) return null;

    const totalPages = this.allPages.length;
    
    for (let i = 1; i < totalPages; i++) {
      const nextIndex = (currentPageIndex + i) % totalPages;
      const candidatePage = this.allPages[nextIndex];
      
      if (this.slugContainsKeyword(candidatePage.slug, keyword)) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log(`🔄 Safe circular link: "${keyword}" → ${candidatePage.url}`);
        }
        return candidatePage.url;
      }
    }
    
    return null;
  }

  // 🔍 VERIFICAR SI SLUG CONTIENE KEYWORD
  private slugContainsKeyword(slug: string, keyword: string): boolean {
    const slugLower = slug.toLowerCase();
    const keywordLower = keyword.toLowerCase();
    
    const keywordWords = keywordLower.split(' ');
    
    return keywordWords.every(word => 
      slugLower.includes(word.trim())
    );
  }

  // 🛡️ SELECCIÓN DE LINKS CON SAFETY CHECKS
  private selectLinksWithSafety(opportunities: LinkOpportunity[], totalWords: number): LinkOpportunity[] {
    const selected: LinkOpportunity[] = [];
    
    const categoryCounts = {
      commercial: 0,
      informational: 0,
      branded: 0,
      generic: 0,
      naked: 0,
      article: 0,
      hub: 0
    };

    const getKeywordCategory = (keyword: string): keyof typeof categoryCounts => {
      const kw = keyword.toLowerCase();
      // Hub links
      if (this.config.pageType !== 'hub' && LINKS_FOR_TOURS_AND_ARTICLES[kw]?.includes('best-colosseum')) return 'hub';
      // Article links
      if (ARTICLE_LINKS[kw]) return 'article';
      
      const commercial = ['colosseum tickets', 'vip access'];
      const branded = ['our experience', 'we recommend', 'this site'];
      const generic = ['more information', 'detailed guide', 'useful information'];
      const naked = ['here', 'this article'];
      
      if (commercial.includes(keyword)) return 'commercial';
      if (branded.includes(keyword)) return 'branded';
      if (generic.includes(keyword)) return 'generic';
      if (naked.includes(keyword)) return 'naked';
      return 'informational';
    };

    for (const opp of opportunities) {
      if (selected.length >= this.config.maxLinksPerPage) break;
      
      const currentCount = this.keywordCounts.get(opp.baseKeyword) || 0;
      const maxForKeyword = Math.min(
        opp.maxAllowed,
        this.config.maxLinksPerKeyword || opp.maxAllowed
      );
      
      if (currentCount >= maxForKeyword) continue;
      
      const density = (selected.length / totalWords) * 100;
      if (density >= this.config.maxDensity) break;

      const category = getKeywordCategory(opp.baseKeyword);
      const maxCommercial = Math.ceil(this.config.maxLinksPerPage * 0.20);
      
      if (category === 'commercial' && categoryCounts.commercial >= maxCommercial) {
        continue;
      }
      
      selected.push(opp);
      categoryCounts[category]++;
      this.keywordCounts.set(opp.baseKeyword, currentCount + 1);
    }

    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && selected.length > 0) {
      console.log(`🛡️ [${this.config.pageType || 'default'}] Anchor distribution:`, categoryCounts);
    }

    return selected;
  }

  // MÉTODOS AUXILIARES
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isInsideLink(text: string, pos: number): boolean {
    const before = text.substring(0, pos);
    const after = text.substring(pos);
    const lastOpen = before.lastIndexOf('<a ');
    const lastClose = before.lastIndexOf('</a>');
    return lastOpen > lastClose && after.indexOf('</a>') !== -1;
  }

  private applyLinks(text: string, selectedLinks: LinkOpportunity[]): string {
    if (selectedLinks.length === 0) return text;
    
    const sorted = selectedLinks.sort((a, b) => b.position - a.position);
    
    let result = text;
    
    // Filtrar overlaps
    const filtered: LinkOpportunity[] = [];
    for (const link of sorted) {
      const hasOverlap = filtered.some(existing => 
        link.position < existing.position + existing.length &&
        link.position + link.length > existing.position
      );
      if (!hasOverlap) {
        filtered.push(link);
      }
    }
    
    for (const link of filtered) {
      const before = result.substring(0, link.position);
      const linkText = result.substring(link.position, link.position + link.length);
      const after = result.substring(link.position + link.length);
      
      if (linkText.includes('<') || linkText.includes('>')) {
        continue;
      }
      
      const html = `<a href="${link.url}" class="auto-link safe-link" title="More about ${linkText}">${linkText}</a>`;
      result = before + html + after;
    }
    
    return result;
  }
}

// ═══════════════════════════════════════════════
// 🚀 FUNCIÓN PRINCIPAL EXPORTADA
// ═══════════════════════════════════════════════
export async function addAutoLinks(
  text: string, 
  config?: Partial<AutoLinkerConfig>,
  context?: { tourSlug?: string; pageType?: 'tour' | 'article' | 'hub' }
): Promise<string> {
  const linker = new CircularProximityAutoLinker({
    ...config,
    currentTourSlug: context?.tourSlug,
    pageType: context?.pageType
  });
  
  return linker.processText(text);
}

// 🧹 RESET CONTADORES
export function resetPageCounters(pageSlug?: string): void {
  if (pageSlug) {
    globalCounters.delete(pageSlug);
  } else {
    globalCounters.clear();
  }
}

// Hook React SEGURO para Vercel
import { useState, useEffect } from 'react';

export function useSanityAutoLinker(
  content: string,
  config?: Partial<AutoLinkerConfig>,
  context?: { tourSlug?: string; pageType?: 'tour' | 'article' | 'hub' }
): { linkedContent: string; isProcessing: boolean } {
  const [linkedContent, setLinkedContent] = useState(content);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!content?.trim()) {
      setLinkedContent(content);
      return;
    }

    let isMounted = true;
    setIsProcessing(true);

    addAutoLinks(content, config, context)
      .then(result => {
        if (isMounted) {
          setLinkedContent(result);
        }
      })
      .catch(error => {
        if (isMounted) {
          setLinkedContent(content);
        }
        if (process.env.NODE_ENV === 'development') {
          console.error('AutoLinker error:', error);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsProcessing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [content, JSON.stringify(config), context?.tourSlug, context?.pageType]);

  return { linkedContent, isProcessing };
}