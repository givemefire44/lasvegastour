// app/utils/schemaGenerator.ts
import researchDatasets from '@/data/research-datasets.json';

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
  // Soporte cuyo pilar publica Dataset con CSV: se basa en el del pilar (por URL, ver abajo).
  let pillarDatasetUrl: string | null = null;
  if (!isPillar && pageData.parentPillar?._ref) {
    const pillarRef = relatedArticles.find((a) => a._id === pageData.parentPillar?._ref);
    if (pillarRef) {
      isPartOf.push({
        '@type': 'Article',
        '@id': articleIdFromSlug(pillarRef.slug.current),
        url: `${baseUrl}/${pillarRef.slug.current}`,
        name: pillarRef.title,
      });
      // noHeredan: soportes colgados del pilar que no salen de su recorte (ej. bodas bajo Fremont)
      const metaPilar = pillarDataset(pillarRef.slug.current);
      if (metaPilar && !metaPilar.noHeredan?.includes(slug)) pillarDatasetUrl = `${baseUrl}/${pillarRef.slug.current}#dataset`;
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

    // Un pilar con CSV propio se basa en SU dataset (que se basa en el corpus); un soporte, en el
    // de su pilar si lo tiene; el resto, directo en el corpus. Lo que apunta a OTRA pagina va como
    // {"@id"} sin @type, nunca como nodo tipado Dataset: Google evalua todo nodo Dataset como un dataset propio y
    // lo marca invalido por no tener description (Search Console, colosseumroman, 6 nov 2026).
    isBasedOn: pillarDataset(slug) || (!isPillar && classifiedDataset(slug))
      ? [{ '@id': `${pageUrl}#dataset` }, { '@id': RESEARCH_DATASET_ID }]
      : pillarDatasetUrl
        ? [{ '@id': pillarDatasetUrl }, { '@id': RESEARCH_DATASET_ID }]
        : { '@id': RESEARCH_DATASET_ID },
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

// ============================================================
// DATASET PROPIO DE CADA PILAR — para Google Dataset Search
// ============================================================
// Google no sigue un isBasedOn {"@id"} hacia otra pagina: para que el pilar cuente como dataset
// tiene que declarar el suyo, con un archivo descargable. Los metadatos y el CSV los genera
// colosseumroman-blog/tour-importer/exportar-dataset-csv.mjs --sitio=lasvegas --pilares
// --salida=<este repo> (data/research-datasets.json y public/data/<slug>.csv). El corpus de Las
// Vegas esta partido en verticales y sus temas son genericos, asi que cada pilar se recorta por su
// vertical o, si es de un lugar, por texto. Solo cuenta la muestra representativa.

interface PillarDatasetMeta {
  tema: string;
  tags: string[];
  verticales?: string[];
  textoDescripcion?: string;
  noHeredan?: string[];
  csv: string;
  itemsUnicos: number;
  temporalCoverage: string;
}

function pillarDataset(slug: string): PillarDatasetMeta | undefined {
  return (researchDatasets.pilares as Record<string, PillarDatasetMeta>)[slug];
}

export function generatePillarDatasetSchema(pageData: ResearchPageData, baseUrl: string = SITE_URL) {
  if (pageData.isPillar !== true) return null;
  const slug = pageData.slug.current;
  const meta = pillarDataset(slug);
  if (!meta) return null;
  const pageUrl = `${baseUrl}/${slug}`;
  const recorte = meta.verticales
    ? `corpus items from the ${meta.verticales.join(', ')} ${meta.verticales.length > 1 ? 'verticals' : 'vertical'}${meta.tags.length < 10 ? ` tagged ${meta.tags.join(' or ')}` : ''}`
    : `${meta.textoDescripcion || 'corpus items'}`;
  // Pilar que ademas clasifico resenas a mano: segundo archivo del MISMO Dataset (una pagina, un Dataset)
  const clas = classifiedDataset(slug);
  const descClas = clas
    ? ` A second file holds the hand classification behind the analysis: ${clas.base} ${clas.baseDescripcion}, one row per finding with the number of reviews, the star split and the first and last year.`
    : '';
  const archivoAgregados = {
    '@type': 'DataDownload',
    name: `${meta.tema}: aggregates by vertical, topic and source (CSV)`,
    encodingFormat: 'text/csv',
    contentUrl: `${SITE_URL}${meta.csv}`,
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${pageUrl}#dataset`,
    name: `${meta.tema}: Corpus Aggregates by Topic and Source`,
    description: `Aggregated counts behind the analysis "${pageData.title}", built from ${meta.itemsUnicos.toLocaleString('en-US')} ${recorte}. Each row gives, for one vertical, one topic and one source, the number of items that carry the topic and how many were classified negative, neutral, positive or mixed, plus the earliest and latest publication date. The corpus draws on Reddit, TripAdvisor, YouTube, Google Maps and Quora; a source with no items in this cut has no rows. Only the representative sample is counted: the TripAdvisor pass restricted to 1-3 star reviews is excluded, as the corpus documentation requires. An item can carry several topics, so rows do not add up to unique items. Contains derived counts only: no review text, no usernames and no star-rating averages. Derived from the Las Vegas Shows and Tours Research Corpus.${descClas}`,
    url: pageUrl,
    creator: { '@type': 'Organization', '@id': INTERCOPER_ID, name: 'Intercoper', url: 'https://intercoper.com' },
    publisher: { '@type': 'Organization', name: 'LasVegasTour', url: SITE_URL },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    inLanguage: 'en',
    ...(pageData.publishedAt && { datePublished: pageData.publishedAt.slice(0, 10) }),
    dateModified: clas ? (researchDatasets as any).generadoClasificaciones || researchDatasets.generado : researchDatasets.generado,
    keywords: ['Las Vegas', meta.tema, 'visitor reviews', 'tourism research', ...(meta.verticales || [])],
    spatialCoverage: { '@type': 'Place', name: 'Las Vegas, Nevada, USA' },
    temporalCoverage: meta.temporalCoverage,
    // Referencia {"@id"} sin @type al Dataset central: un nodo tipado Dataset lo evaluaria Google como dataset incompleto.
    isBasedOn: { '@id': RESEARCH_DATASET_ID },
    measurementTechnique:
      'Items from five public sources, each tagged by topic and vertical and classified by sentiment in an automated enrichment pass; counts aggregated per vertical, topic tag and source over the representative sample only.',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'vertical', description: 'Product vertical of the item (all = every vertical, for a pillar cut by place)' },
      { '@type': 'PropertyValue', name: 'topic_tag', description: 'Topic of the item' },
      { '@type': 'PropertyValue', name: 'source', description: 'Source platform' },
      { '@type': 'PropertyValue', name: 'items', description: 'Items carrying the topic in that vertical and source' },
      { '@type': 'PropertyValue', name: 'sentiment_negative', description: 'Items classified negative' },
      { '@type': 'PropertyValue', name: 'sentiment_neutral', description: 'Items classified neutral' },
      { '@type': 'PropertyValue', name: 'sentiment_positive', description: 'Items classified positive' },
      { '@type': 'PropertyValue', name: 'sentiment_mixed', description: 'Items classified mixed' },
      { '@type': 'PropertyValue', name: 'first_published', description: 'Earliest publication date' },
      { '@type': 'PropertyValue', name: 'last_published', description: 'Latest publication date' },
    ],
    distribution: clas
      ? [
          archivoAgregados,
          {
            '@type': 'DataDownload',
            name: `${clas.tema} (CSV)`,
            encodingFormat: 'text/csv',
            contentUrl: `${SITE_URL}${clas.csv}`,
          },
        ]
      : archivoAgregados,
  };
}

// ============================================================
// DATASET DE LAS CLASIFICACIONES A MANO — soportes con evidencia propia
// ============================================================
// Articulos cuyas cifras salen de resenas leidas y clasificadas a mano, por id, en su script de
// evidencia (articles/<carpeta>/evidencia-*.mjs del repo colosseumroman-blog). El CSV tiene un
// hallazgo por fila con las resenas que lo sostienen y su reparto por estrellas. Lo genera
// exportar-dataset-csv.mjs --hallazgos (data/research-datasets.json, clave "clasificaciones").
// Un pilar con clasificacion la suma como segundo archivo de su Dataset (arriba); un soporte la
// declara como Dataset propio (abajo).

interface ClassifiedDatasetMeta {
  tema: string;
  esPilar: boolean;
  csv: string;
  hallazgos: number;
  base?: number;
  shows?: string[];
  baseDescripcion: string;
  lugar?: string;
  keywords?: string[];
  temporalCoverage: string;
}

function classifiedDataset(slug: string): ClassifiedDatasetMeta | undefined {
  const c = (researchDatasets as { clasificaciones?: Record<string, ClassifiedDatasetMeta> }).clasificaciones;
  return c?.[slug];
}

export function generateClassifiedDatasetSchema(pageData: ResearchPageData, baseUrl: string = SITE_URL) {
  if (pageData.isPillar === true || !pageData.parentPillar?._ref) return null;
  const slug = pageData.slug.current;
  const meta = classifiedDataset(slug);
  if (!meta || meta.esPilar) return null;
  const pageUrl = `${baseUrl}/${slug}`;
  const porShow = !!meta.shows?.length;
  const base = porShow
    ? `The base is ${meta.baseDescripcion}.`
    : `The base is ${meta.base} ${meta.baseDescripcion}.`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${pageUrl}#dataset`,
    name: `${meta.tema}: Hand-Classified Findings`,
    description: `The counts behind the analysis "${pageData.title}". ${base} Each of the ${meta.hallazgos} rows is one finding${porShow ? ' for one show' : ''}, with how many reviews support it, ${porShow ? "how many rated reviews that show has in the representative sample, " : ''}how those reviews split by star rating and the first and last year. Only the representative sample is counted: reviews from the TripAdvisor pass restricted to 1-3 stars are quoted in the article but never counted. One review can support several findings, so rows do not add up. Contains counts only: no review text, no usernames and no review ids. Derived from the Las Vegas Shows and Tours Research Corpus.`,
    url: pageUrl,
    creator: { '@type': 'Organization', '@id': INTERCOPER_ID, name: 'Intercoper', url: 'https://intercoper.com' },
    publisher: { '@type': 'Organization', name: 'LasVegasTour', url: SITE_URL },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    inLanguage: 'en',
    ...(pageData.publishedAt && { datePublished: pageData.publishedAt.slice(0, 10) }),
    ...((researchDatasets as any).generadoClasificaciones && { dateModified: (researchDatasets as any).generadoClasificaciones }),
    keywords: meta.keywords || ['Las Vegas', 'visitor reviews', 'tourism research'],
    spatialCoverage: { '@type': 'Place', name: meta.lugar || 'Las Vegas, Nevada, USA' },
    ...(meta.temporalCoverage && { temporalCoverage: meta.temporalCoverage }),
    // Referencia {"@id"} sin @type al Dataset central: un nodo tipado Dataset lo evaluaria Google como dataset incompleto.
    isBasedOn: { '@id': RESEARCH_DATASET_ID },
    measurementTechnique:
      'Reviews on the topic were pulled from the Las Vegas Shows and Tours Research Corpus and every one was read and classified by hand, by review id, into findings; only the representative sample is counted, and a duplicate review under another id is set aside.',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'finding', description: 'What the reviewers say or did' },
      ...(porShow ? [{ '@type': 'PropertyValue', name: 'show', description: 'Show the reviews are about' }] : []),
      { '@type': 'PropertyValue', name: 'reviews', description: 'Reviews that support the finding' },
      porShow
        ? { '@type': 'PropertyValue', name: 'show_reviews_in_sample', description: 'Rated reviews of that show in the representative sample' }
        : { '@type': 'PropertyValue', name: 'base_reviews', description: `Reviews read and classified for this analysis (${meta.base})` },
      { '@type': 'PropertyValue', name: 'stars_1 / stars_2 / stars_3 / stars_4 / stars_5', description: 'Supporting reviews by star rating' },
      { '@type': 'PropertyValue', name: 'first_year / last_year', description: 'Earliest and latest year among the supporting reviews' },
    ],
    distribution: {
      '@type': 'DataDownload',
      name: `${meta.tema} (CSV)`,
      encodingFormat: 'text/csv',
      contentUrl: `${SITE_URL}${meta.csv}`,
    },
  };
}
