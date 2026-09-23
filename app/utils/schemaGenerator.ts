// app/utils/schemaGenerator.ts

// ============================================================
// CONSTANTS â€” Anclas canÃ³nicas del programa Research
// ============================================================
export const SITE_URL = 'https://lasvegastour.com';
export const RESEARCH_PAGE_URL = `${SITE_URL}/las-vegas-research`;
export const RESEARCH_DATASET_ID = `${RESEARCH_PAGE_URL}#dataset`;
export const RESEARCH_COLLECTION_ID = `${RESEARCH_PAGE_URL}#collection`;
export const LAS_VEGAS_ENTITY_ID = `${SITE_URL}/#las-vegas`;
export const INTERCOPER_ID = 'https://intercoper.com/#organization';

// Tipos especÃ­ficos para Schema.org
interface ImageObject {
  '@type': 'ImageObject';
  url: string;
  width?: number;
  height?: number;
}

interface Organization {
  '@type': 'Organization';
  '@id'?: string;
  name: string;
  logo?: ImageObject;
  url?: string;
  parentOrganization?: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
}

interface Person {
  '@type': 'Person';
  '@id'?: string;
  name: string;
  url?: string;
  jobTitle?: string;
  sameAs?: string[];
}

// Tipos base para diferentes schemas
interface BaseSchemaProperties {
  '@context': 'https://schema.org';
  name: string;
  description: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
  author?: Organization | Person;
  publisher?: Organization;
}

// Schemas especÃ­ficos con sus propiedades Ãºnicas
interface ArticleSchema extends BaseSchemaProperties {
  '@type': 'Article';
  headline: string;
  image?: ImageObject | ImageObject[];
  articleBody?: string;
  wordCount?: number;
}

interface WebPageSchema extends BaseSchemaProperties {
  '@type': 'WebPage';
  image?: ImageObject;
  breadcrumb?: any;
}

interface HowToSchema extends BaseSchemaProperties {
  '@type': 'HowTo';
  image?: ImageObject | ImageObject[];
  step?: any[];
  totalTime?: string;
}

interface FAQPageSchema extends BaseSchemaProperties {
  '@type': 'FAQPage';
  mainEntity?: any[];
}

interface ItemListSchema extends BaseSchemaProperties {
  '@type': 'ItemList';
  itemListElement?: any[];
  numberOfItems?: number;
}

interface ReviewSchema extends BaseSchemaProperties {
  '@type': 'Review';
  reviewRating?: any;
  author?: Person;
  itemReviewed?: any;
}

// About Page Schema
interface AboutPageSchema {
  '@context': 'https://schema.org';
  '@type': 'AboutPage';
  mainEntity: any;
}

// Union type para todos los schemas posibles
type Schema = ArticleSchema | WebPageSchema | HowToSchema | FAQPageSchema | ItemListSchema | ReviewSchema | AboutPageSchema;

// Tipos para los datos de entrada
interface PageData {
  title: string;
  slug: { current: string };
  seoDescription?: string;
  seoImage?: any;
  publishedAt?: string;
  _updatedAt?: string;
  isPillar?: boolean;
  parentPillar?: { _ref?: string; _id?: string };
  richSnippets?: any;
  schemaType?: 'Article' | 'WebPage' | 'HowTo' | 'FAQPage' | 'ItemList' | 'Review';
  author?: 'mario-dalo' | 'curator-team' | 'none' | string;
  articleBody?: string;
  wordCount?: number;
  steps?: any[];
  totalTime?: string;
  faqItems?: any[];
  listItems?: any[];
  reviewRating?: any;
  itemReviewed?: any;
}

// ========================================
// HELPER: Generar autor segÃºn configuraciÃ³n
// ========================================
function getAuthorSchema(authorType?: string): Person | Organization {
  switch (authorType) {
    case 'mario-dalo':
      return {
        '@type': 'Person',
        '@id': 'https://intercoper.com/author/mario-dalo#person',
        name: 'Mario Dalo',
        url: 'https://intercoper.com/author/mario-dalo',
        jobTitle: 'Founder of Intercoper',
        sameAs: [
          'https://www.linkedin.com/in/mariodalo/',
          'https://mariodalo.com',
          'https://featured.com/p/mario-dalo-8288',
          'https://intercoper.com/author/mario-dalo',
          'https://www.reddit.com/user/Mario_Dalo/'
        ]
      };
    case 'curator-team':
      return {
        '@type': 'Organization',
        name: 'Intercoper Curator Team',
        url: 'https://intercoper.com/team'
      };
    case 'none':
    default:
      return {
        '@type': 'Organization',
        name: 'LasVegasTour',
        url: 'https://lasvegastour.com'
      };
  }
}

// ========================================
// HELPER: Publisher con parentOrganization
// ========================================
function getPublisherSchema(): Organization {
  return {
    '@type': 'Organization',
    name: 'LasVegasTour',
    logo: {
      '@type': 'ImageObject',
      url: 'https://lasvegastour.com/logo.png'
    },
    url: 'https://lasvegastour.com',
    parentOrganization: {
      '@type': 'Organization',
      name: 'Intercoper',
      url: 'https://intercoper.com'
    }
  };
}

export function generatePageSchema(pageData: PageData, baseUrl = 'https://lasvegastour.com'): Schema {
  // SPECIAL CASE: About Us Page
  if (pageData.slug.current === 'about-us') {
    return {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      mainEntity: {
        '@type': 'Organization',
        name: 'LasVegasTour',
        alternateName: 'lasvegastour.com',
        url: 'https://lasvegastour.com',
        logo: 'https://lasvegastour.com/logo.png',
        foundingDate: '2006',
        description: 'Expert curators of the best Las Vegas tours, shows, and day trips. Independent affiliate partner of Viator.',

        founder: {
          '@type': 'Person',
          '@id': 'https://intercoper.com/author/mario-dalo#person',
          name: 'Mario Dalo',
          url: 'https://intercoper.com/author/mario-dalo',
          jobTitle: 'Founder of Intercoper',
          nationality: 'Argentine',
          knowsAbout: [
            'Travel Content Curation',
            'Digital Travel Guides',
            'Tour Affiliate Publishing',
            'Travel Planning'
          ],
          sameAs: [
            'https://www.linkedin.com/in/mariodalo/',
            'https://mariodalo.com',
            'https://featured.com/p/mario-dalo-8288',
            'https://intercoper.com/author/mario-dalo',
            'https://www.reddit.com/user/Mario_Dalo/'
          ]
        },

        parentOrganization: {
          '@type': 'Organization',
          '@id': 'https://intercoper.com/#organization',
          name: 'Intercoper',
          url: 'https://intercoper.com',
          foundingDate: '2006',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Larrea 1280',
            addressLocality: 'Buenos Aires',
            addressRegion: 'CABA',
            postalCode: 'C1117',
            addressCountry: 'AR'
          }
        },

        areaServed: {
          '@type': 'Place',
          name: 'Las Vegas, Nevada'
        },

        knowsAbout: [
          'Las Vegas Tours',
          'Grand Canyon Tours',
          'Hoover Dam Tours',
          'Las Vegas Shows',
          'Helicopter Tours',
          'Day Trips from Las Vegas',
          'Travel Planning'
        ],

        sameAs: [
          'https://instagram.com/LasVegasTour'
        ],

        contactPoint: {
          '@type': 'ContactPoint',
          email: 'hello@lasvegastour.com',
          contactType: 'Customer Service',
          availableLanguage: ['English', 'Spanish']
        }
      }
    } as AboutPageSchema;
  }

  // Generar URL desde slug
  const pageUrl = `${baseUrl}/${pageData.slug.current}`;

  // Usar seoDescription como description
  const description = pageData.seoDescription || pageData.title;

  // DETECTAR SCHEMA TYPE DESDE RICH SNIPPETS (prioridad) O SCHEMA TYPE MANUAL
  //
  // Las pages del RESEARCH PROGRAM (pilares y supportings) declaran Article, no WebPage. Son analisis
  // editoriales con autor, fecha y metodologia declarada: como WebPage se pierde elegibilidad de
  // varias presentaciones y se le quita senal de autoria justo al contenido que se apoya en su metodo.
  // El default sigue siendo WebPage para el cluster y las institucionales, y richSnippets.schemaType
  // conserva la prioridad, asi que esto no pisa nada configurado a mano.
  const esResearch = pageData.isPillar === true || Boolean(pageData.parentPillar?._ref);
  const schemaType = pageData.richSnippets?.schemaType || pageData.schemaType
    || (esResearch ? 'Article' : 'WebPage');

  // Propiedades base comunes CON AUTOR DINÃMICO
  const baseProperties: BaseSchemaProperties = {
    '@context': 'https://schema.org',
    name: pageData.title,
    description: description,
    url: pageUrl,
    datePublished: pageData.publishedAt,
    // dateModified importa sobre todo en el research: sus cifras son una medicion fechada, asi que
    // cuando se reviso es parte del dato. El campo ya estaba en la interfaz de salida y nunca se
    // emitia. Cae a datePublished mientras Sanity no registre una modificacion.
    dateModified: pageData._updatedAt || pageData.publishedAt,
    author: getAuthorSchema(pageData.author),
    publisher: getPublisherSchema()
  };

  // Crear imagen si existe
  const imageObject: ImageObject | undefined = pageData.seoImage ? {
    '@type': 'ImageObject',
    url: pageData.seoImage.asset?.url || pageData.seoImage.url || '',
    ...(pageData.seoImage.width && { width: pageData.seoImage.width }),
    ...(pageData.seoImage.height && { height: pageData.seoImage.height })
  } : undefined;

  // GENERAR SCHEMA ESPECÃFICO CON DATOS DE RICH SNIPPETS
  switch (schemaType) {
    case 'Article':
      return {
        ...baseProperties,
        '@type': 'Article',
        headline: pageData.title,
        ...(imageObject && { image: imageObject }),
        ...(pageData.richSnippets?.wordCount && { wordCount: pageData.richSnippets.wordCount }),
        ...(pageData.richSnippets?.readingTime && {
          timeRequired: `PT${pageData.richSnippets.readingTime}M`
        }),
        ...(pageData.richSnippets?.about && {
          about: {
            '@type': pageData.richSnippets.about.type,
            name: pageData.richSnippets.about.name
          }
        })
      } as ArticleSchema;

    case 'HowTo':
      return {
        ...baseProperties,
        '@type': 'HowTo',
        ...(imageObject && { image: imageObject }),
        ...(pageData.richSnippets?.timeRequired && {
          totalTime: pageData.richSnippets.timeRequired
        }),
        ...(pageData.richSnippets?.difficulty && {
          difficulty: pageData.richSnippets.difficulty
        }),
        ...(pageData.richSnippets?.estimatedCost && {
          estimatedCost: {
            '@type': 'MonetaryAmount',
            currency: pageData.richSnippets.estimatedCost.currency,
            value: pageData.richSnippets.estimatedCost.minValue
          }
        }),
        ...(pageData.richSnippets?.steps && {
          step: pageData.richSnippets.steps.map((step: any, index: number) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.name,
            text: step.text,
            ...(step.url && { url: step.url })
          }))
        })
      } as HowToSchema;

    case 'FAQPage':
      return {
        ...baseProperties,
        '@type': 'FAQPage',
        ...(pageData.richSnippets?.faqItems && {
          mainEntity: pageData.richSnippets.faqItems.map((faq: any) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer
            }
          }))
        })
      } as FAQPageSchema;

    case 'ItemList':
      return {
        ...baseProperties,
        '@type': 'ItemList',
        ...(pageData.richSnippets?.itemList && {
          itemListElement: pageData.richSnippets.itemList.map((item: any, index: number) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            ...(item.description && { description: item.description }),
            ...(item.url && { url: item.url })
          })),
          numberOfItems: pageData.richSnippets.itemList.length
        })
      } as ItemListSchema;

    case 'Review':
      return {
        ...baseProperties,
        '@type': 'Review',
        author: getAuthorSchema(pageData.author),
        ...(pageData.reviewRating && { reviewRating: pageData.reviewRating }),
        ...(pageData.itemReviewed && { itemReviewed: pageData.itemReviewed })
      } as ReviewSchema;

    default: // 'WebPage'
      return {
        ...baseProperties,
        '@type': 'WebPage',
        ...(imageObject && { image: imageObject }),
        ...(pageData.richSnippets?.about && {
          about: {
            '@type': pageData.richSnippets.about.type,
            name: pageData.richSnippets.about.name
          }
        })
      } as WebPageSchema;
  }
}

// Helper function para generar breadcrumb schema
export function generateBreadcrumbSchema(breadcrumbs: Array<{name: string, url: string}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  };
}

// Helper function para FAQ schema
export function generateFAQSchema(faqs: Array<{question: string, answer: string}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

// ============================================================
// RESEARCH PROGRAM SCHEMA â€” NUEVO
// ============================================================


interface RelatedArticleRef {
  _id: string;
  title: string;
  slug: { current: string };
}

interface ResearchPageData extends PageData {
  isPillar?: boolean;
  parentPillar?: { _ref?: string; _id?: string };
  _updatedAt?: string;
}

/**
 * Detecta si un articulo pertenece al programa Research.
 * Regla: tiene isPillar=true O tiene parentPillar (es supporting de algun pillar).
 */
export function isResearchArticle(pageData: ResearchPageData): boolean {
  return pageData.isPillar === true || Boolean(pageData.parentPillar?._ref);
}

/** Construye el @id canonico de un articulo Research a partir del slug. */
function articleIdFromSlug(slug: string): string {
  return `${SITE_URL}/${slug}#article`;
}

/**
 * Schema enriquecido para un articulo del programa Research. Portado de colosseumroman-blog
 * el 23 sep 2026: lasvegastour tenia el encabezado de esta seccion y la interfaz, y nada mas,
 * asi que sus 45 articulos salian como WebPage sueltos, sin isBasedOn al corpus y sin reviewedBy.
 *
 * - Pilar:    Article + isBasedOn Dataset + isPartOf CollectionPage + hasPart [soportes] + about + citation
 * - Soporte:  Article + isBasedOn Dataset + isPartOf [CollectionPage, Pilar] + mentions [hermanos] + about + citation
 */
export function generateResearchSchema(
  pageData: ResearchPageData,
  relatedArticles: RelatedArticleRef[] = [],
  baseUrl: string = SITE_URL
) {
  const slug = pageData.slug.current;
  const pageUrl = `${baseUrl}/${slug}`;
  const articleId = articleIdFromSlug(slug);
  const description = pageData.seoDescription || pageData.title;

  const imageObject: ImageObject | undefined = pageData.seoImage
    ? {
        '@type': 'ImageObject',
        url: pageData.seoImage.asset?.url || pageData.seoImage.url || '',
        ...(pageData.seoImage.width && { width: pageData.seoImage.width }),
        ...(pageData.seoImage.height && { height: pageData.seoImage.height }),
      }
    : undefined;

  const isPillar = pageData.isPillar === true;

  const isPartOf: any[] = [
    { '@type': 'CollectionPage', '@id': RESEARCH_COLLECTION_ID },
  ];
  if (!isPillar && pageData.parentPillar?._ref) {
    const pillarRef = relatedArticles.find((a) => a._id === pageData.parentPillar?._ref);
    if (pillarRef) {
      isPartOf.push({
        '@type': 'Article',
        '@id': articleIdFromSlug(pillarRef.slug.current),
        url: `${baseUrl}/${pillarRef.slug.current}`,
        name: pillarRef.title,
      });
    }
  }

  const hasPart =
    isPillar && relatedArticles.length > 0
      ? relatedArticles.map((sup) => ({
          '@type': 'Article',
          '@id': articleIdFromSlug(sup.slug.current),
          url: `${baseUrl}/${sup.slug.current}`,
          name: sup.title,
        }))
      : undefined;

  const mentions =
    !isPillar && relatedArticles.length > 1
      ? relatedArticles
          .filter((a) => a._id !== pageData.parentPillar?._ref)
          .map((sib) => ({
            '@type': 'Article',
            '@id': articleIdFromSlug(sib.slug.current),
            url: `${baseUrl}/${sib.slug.current}`,
            name: sib.title,
          }))
      : undefined;

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': articleId,
    headline: pageData.title,
    name: pageData.title,
    description: description,
    url: pageUrl,
    inLanguage: 'en',
    isAccessibleForFree: true,
    datePublished: pageData.publishedAt,
    ...(pageData._updatedAt && { dateModified: pageData._updatedAt }),
    author: getAuthorSchema(pageData.author),
    reviewedBy: getAuthorSchema('mario-dalo'),
    publisher: getPublisherSchema(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    ...(imageObject && { image: imageObject }),

    isBasedOn: { '@id': RESEARCH_DATASET_ID },
    isPartOf: isPartOf.length === 1 ? isPartOf[0] : isPartOf,
    ...(hasPart && hasPart.length > 0 && { hasPart }),
    ...(mentions && mentions.length > 0 && { mentions }),

    about: {
      '@type': 'City',
      '@id': LAS_VEGAS_ENTITY_ID,
      name: 'Las Vegas',
      sameAs: 'https://en.wikipedia.org/wiki/Las_Vegas',
    },

    // Cifra del corpus VIGENTE. Esto viaja al JSON-LD de TODOS los articulos del research, asi que
    // cuando el corpus crece hay que tocarlo aca Y en app/las-vegas-research/page.tsx: si no, el
    // articulo declara un numero en su nota de metodo y otro distinto en su schema, que es la
    // contradiccion que un revisor busca primero. El 23 sep 2026 la pagina declaraba 27.066 items
    // y 11 fichas cuando el corpus ya tenia 40.112 y 33; las dos cosas se corrigieron juntas.
    citation:
      'Based on the Las Vegas Shows and Tours Research Corpus 2026, version 2 (40,112 items aggregated from 5 independent sources, covering pre-purchase deliberation and post-visit reviews; 17,594 carry a star rating across 33 listings). See https://lasvegastour.com/las-vegas-research for the full dataset documentation and version history.',

    ...(pageData.richSnippets?.wordCount && { wordCount: pageData.richSnippets.wordCount }),
    ...(pageData.richSnippets?.readingTime && {
      timeRequired: `PT${pageData.richSnippets.readingTime}M`,
    }),
  };

  return schema;
}
