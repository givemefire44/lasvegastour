import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import StaticPageClient from './StaticPageClient'

import { isHubSlug, getHubBySlug, getAllHubs, getAllHubSlugs, buildHubGroqFilter } from '@/lib/tourHubs';
import HubPage from '@/app/components/HubPage';
import hubContentRaw from '@/data/hub-content.json';
import Footer from '@/app/components/Footer';

const hubContent = hubContentRaw as Record<string, any>;

// Interface expandida para páginas estáticas
interface SanityPage {
  title: string;
  slug: {
    current: string;
  };
  content: any;
  pageType?: string; // ← NUEVO: 'simple' | 'hero'
  isPillar?: boolean;
  parentPillar?: { _ref: string; _id?: string };
  
  // Hero fields
  heroImage?: {
    asset: { url: string };
    alt?: string;
    heading?: string;
  };
  heroContent?: {
    heroTitle?: string;
    heroSubtitle?: string;
    excerpt?: string;
    customText?: string; // ← NUEVO CAMPO
  };
  highlights?: Array<{
    title: string;
    description?: string;
    icon?: string;
  }>;
  pageSettings?: {
    showRecommendedTours?: boolean;
    backgroundColor?: string;
    ctaText?: string;    // ← NUEVO CAMPO
    ctaUrl?: string;     // ← NUEVO CAMPO
  };
  
  // SEO fields
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  seoImage?: {
    asset: { url: string };
    alt?: string;
  };
  publishedAt?: string;
  _updatedAt?: string;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
  };

  // Rich Snippets
  richSnippets?: {
    schemaType?: 'Article' | 'HowTo' | 'ItemList' | 'Review' | 'FAQPage' | 'WebPage';
    readingTime?: number;
    wordCount?: number;
    difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
    estimatedCost?: {
      currency: string;
      minValue?: number;
      maxValue?: number;
    };
    timeRequired?: string;
    about?: {
      name: string;
      type: 'TouristAttraction' | 'Monument' | 'Museum' | 'City' | 'Place';
    };
    steps?: Array<{
      name: string;
      text: string;
      url?: string;
    }>;
    faqItems?: Array<{
      question: string;
      answer: string;
    }>;
    itemList?: Array<{
      name: string;
      description?: string;
      url?: string;
    }>;
    rating?: {
      ratingValue: number;
      bestRating: number;
      worstRating: number;
    };
  };
}

// ✅ QUERY CORREGIDA - CON TODOS LOS TIPOS DE CONTENIDO E IMÁGENES
async function getPage(slug: string): Promise<SanityPage | null> {
  const query = `
    *[_type == "page" && slug.current == $slug][0] {
      title,
      slug,
      author,
      isPillar,
      parentPillar,
      
      // 🆕 CONTENIDO EXPANDIDO CON TODAS LAS IMÁGENES
      content[]{
        ...,
        // Imagen simple
        _type == "image" => {
          _type,
          asset->{
            _id,
            url
          },
          alt,
          caption
        },
        // Galería de imágenes
        _type == "imageGallery" => {
          _type,
          title,
          layout,
          images[]{
            asset->{
              _id,
              url
            },
            alt,
            caption
          }
        },
        // Imagen con texto
        _type == "imageWithText" => {
          _type,
          layout,
          image{
            asset->{
              _id,
              url
            },
            alt
          },
          text
        },
        // CTA Box
        _type == "ctaBox" => {
          _type,
          title,
          description,
          buttonText,
          buttonUrl,
          style
        },
        // Tabla simple
        _type == "simpleTable" => {
          _type,
          title,
          rows[]{
            cells[]
          }
        },
        // Tour Comparison Table
        _type == "tourComparisonTable" => {
          _type,
          title,
          tours[]{
            category,
            customName,
            tourRef->{
              title,
              slug,
              tourInfo{
                price,
                currency,
                duration
              },
              getYourGuideData{
                rating,
                reviewCount
              }
            }
          }
        },
// Quick Answer Inline
        _type == "quickAnswer" => {
          _type,
          question,
          answer
        },

                // Quick Answer Box
        _type == "quickAnswerBox" => {
          _type,
          title,
          answer,
          style
        },

        // Bloques de texto con links
        _type == "block" => {
          ...,
          markDefs[]{
            ...,
            _type == "link" => {
              _type,
              href,
              blank
            }
          }
        }
      },
      
      pageType,
      
      // Hero fields (pueden no existir en páginas viejas)
      heroImage{
        asset->{
          _id,
          url
        },
        alt,
        heading
      },
      heroContent{
        heroTitle,
        heroSubtitle,
        excerpt,
        customText
      },
      highlights[]{
        title,
        description,
        icon
      },
      pageSettings{
        showRecommendedTours,
        backgroundColor,
        ctaText,
        ctaUrl
      },
      
      // Sidebar Widget
      sidebarWidget{
        showWidget,
        ctaTitle,
        ctaDescription,
        ctaButtonText,
        ctaButtonUrl,
        widgetImage{
          asset->{
            _id,
            url
          },
          alt
        },
        quickLinks[]{
          title,
          url,
          icon
        }
      },
      
      // SEO fields
      seoTitle,
      seoDescription,
      seoKeywords,
      seoImage{
        asset->{
          _id,
          url
        },
        alt
      },
      publishedAt,
      _updatedAt,
      
      // LEGACY compatibility
      seo {
        metaTitle,
        metaDescription
      },

      // 🆕 RICH SNIPPETS
      richSnippets{
        schemaType,
        readingTime,
        wordCount,
        difficulty,
        estimatedCost{
          currency,
          minValue,
          maxValue
        },
        timeRequired,
        about{
          name,
          type
        },
        steps[]{
          name,
          text,
          url
        },
        faqItems[]{
          question,
          answer
        },
        itemList[]{
          name,
          description,
          url
        },
        rating{
          ratingValue,
          bestRating,
          worstRating
        }
      }
    }
  `
  // ✅ CONFIGURACIÓN DE CACHE EXPLÍCITA
  return await client.fetch(query, { slug }, {
    next: { revalidate: 3600 } // Cache por 1 hora
  })
}

// QUERY: TOURS POR HUB (para hub pages)
async function getToursByHub(hub: any) {
  const { filter, params } = buildHubGroqFilter(hub);
  const query = `*[_type == "post" && !(_id in path("drafts.**")) && ${filter}] | order(editorialRating desc) {
    _id,
    title,
    slug,
    seoDescription,
   "heroGallery": heroGallery[0..0] { asset-> { url }, alt },
    seoImage { asset-> { url }, alt },
    tourInfo { duration, price, currency },
    tourFeatures { skipTheLine, smallGroupAvailable, freeCancellation },
    getYourGuideData { rating, reviewCount, provider },
    editorialRating,
    editorialReview,
    bookingUrl
  }`;
  return await client.fetch(query, params, { next: { revalidate: 3600 } });
}

// ✅ FUNCIÓN CORREGIDA - CON CONFIGURACIÓN DE CACHE EXPLÍCITA
async function getRecommendedTours() {
  const query = `
    *[_type == "post" && discontinued != true] | order(_createdAt desc)[0...60]{
      _id,
      title,
      slug,
      mainImage{
        asset->{
          url
        },
        alt
      },
     "heroGallery": heroGallery[0..0] {
        asset->{ url },
        alt
      },
      "body": body[0...1]
    }
  `
  // ✅ CONFIGURACIÓN DE CACHE EXPLÍCITA
  return await client.fetch(query, {}, {
    next: { revalidate: 1800 } // Cache por 30 minutos
  })
}

// 🆕 Traer artículos relacionados según pillar/supporting
 async function getRelatedArticles(currentSlug: string, isPillar: boolean, parentPillarRef?: string) {
    if (isPillar) {
      const query = `*[
        _type == "page"
        && parentPillar._ref == *[_type == "page" && slug.current == $currentSlug][0]._id
        && slug.current != $currentSlug
      ] | order(title asc) {
        _id,
        title,
        slug,
        heroImage{ asset->{ _id, url }, alt }
      }`;
      return await client.fetch(query, { currentSlug }, { next: { revalidate: 3600 } });
    } else if (parentPillarRef) {
      const query = `{
        "pillar": *[_type == "page" && _id == $parentRef][0]{
          _id, title, slug,
          heroImage{ asset->{ _id, url }, alt }
        },
        "siblings": *[
          _type == "page"
          && parentPillar._ref == $parentRef
          && slug.current != $currentSlug
        ] | order(title asc) {
          _id, title, slug,
          heroImage{ asset->{ _id, url }, alt }
        }
      }`;
      const data = await client.fetch(query, { parentRef: parentPillarRef, currentSlug }, { next: { revalidate: 3600 } });
      return [
        ...(data.pillar ? [data.pillar] : []),
        ...data.siblings,
      ];
    }
    return [];
  }

// ✅ GENERATEMETADATA con params async - Next.js 15
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params

// HUB PAGE METADATA
if (isHubSlug(slug)) {
  const hub = getHubBySlug(slug);
  if (hub) {
    const content = hubContent[hub.slug];
    const title = content?.seoTitle || hub.title + ' | LasVegasTour';
    const description = content?.seoDescription || `Compare the best ${hub.shortTitle.toLowerCase()} with ratings, prices and expert reviews.`;
    return {
      title,
      description,
      openGraph: { type: 'website', url: `https://lasvegastour.com/${hub.slug}`, title, description, siteName: 'LasVegasTour' },
      alternates: { canonical: `https://lasvegastour.com/${hub.slug}` },
      robots: { index: true, follow: true },
    };
  }
}


  
  const page = await getPage(slug)
  if (!page) {
    return {
      title: 'Page Not Found | LasVegasTour',
      description: 'This page doesn\'t exist.'
    }
  }

  const baseUrl = 'https://lasvegastour.com'
  const canonical = `${baseUrl}/${slug}`
  
  // SEO data con fallbacks
  const title = page.seoTitle || page.seo?.metaTitle || `${page.title} | LasVegasTour`
  const description = page.seoDescription || page.seo?.metaDescription || 
    page.heroContent?.excerpt || `Learn more about ${page.title} at LasVegasTour`
  const keywords = page.seoKeywords || [page.title.toLowerCase(), 'LasVegasTour', 'rome tours']

  // 🚀 IMAGEN SOCIAL OPTIMIZADA
  const socialImage = page.seoImage 
    ? urlFor(page.seoImage).width(1200).height(630).format('webp').quality(85).url()
    : page.heroImage 
    ? urlFor(page.heroImage).width(1200).height(630).format('webp').quality(85).url()
    : `${baseUrl}/images/default-page.jpg`

  return {
    title,
    description,
    keywords,
    authors: [{ name: 'LasVegasTour' }],
    creator: 'LasVegasTour',
    publisher: 'LasVegasTour',
    
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: canonical,
      title,
      description,
      siteName: 'LasVegasTour',
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: page.seoImage?.alt || page.heroImage?.alt || title,
        },
      ],
    },
    
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
    
    alternates: {
      canonical,
      languages: {
        'en': canonical,
      },
    },
    
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    }
  }
}

// ✅ Componente principal Server Component
export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  
  // HUB PAGE RENDER
  if (isHubSlug(slug)) {
    const hub = getHubBySlug(slug);
    if (hub) {
      const tours = await getToursByHub(hub);
      const content = hubContent[hub.slug] || null;
      const allHubs = getAllHubs();
      const recommendedTours = await getRecommendedTours();

      const SITE_URL = 'https://lasvegastour.com';
      const canonicalUrl = `${SITE_URL}/${hub.slug}`;

      // Items con datos completos para schema
      const itemListElements = tours
        .filter((tour: any) => tour.getYourGuideData?.rating && tour.tourInfo?.price)
        .map((tour: any, index: number) => {
          const tourUrl = `${SITE_URL}/tour/${tour.slug.current}`;
          const tourImage = tour.heroGallery?.[0]?.asset?.url || tour.seoImage?.asset?.url;
          return {
            '@type': 'ListItem',
            position: index + 1,
            url: tourUrl,
            item: {
              '@type': 'Product',
              name: tour.title,
              ...(tourUrl ? { '@id': `${tourUrl}#product` } : {}),
              ...(tourImage ? { image: tourImage } : {}),
              ...(tour.seoDescription ? { description: tour.seoDescription } : {}),
              ...(tour.tourInfo?.price > 0 ? {
                offers: {
                  '@type': 'Offer',
                  url: tourUrl,
                  priceCurrency: tour.tourInfo.currency || 'USD',
                  price: tour.tourInfo.price.toFixed(2),
                  availability: 'https://schema.org/InStock',
                }
              } : {}),
            
            }
          };
        });

        const breadcrumbSchema = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          '@id': `${canonicalUrl}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Colosseum Tours', item: `${SITE_URL}/tours/colosseum` },
            { '@type': 'ListItem', position: 3, name: hub.shortTitle, item: canonicalUrl }
          ]
        };



      const collectionSchema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#collection`,
        name: content?.seoTitle || hub.title,
        description: content?.seoDescription || `Compare the best ${hub.shortTitle.toLowerCase()}`,
        url: canonicalUrl,
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${SITE_URL}#website`,
          name: 'LasVegasTour',
          url: SITE_URL
        },
        about: {
          '@type': 'TouristDestination',
          name: 'Colosseum',
          description: `${hub.shortTitle} at the Roman Colosseum`,
        },
        breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
        ...(itemListElements.length > 0 ? { mainEntity: { '@id': `${canonicalUrl}#itemlist` } } : {}),
      };

      const itemListSchema = itemListElements.length > 0 ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#itemlist`,
        name: hub.title,
        description: `Top-rated ${hub.shortTitle.toLowerCase()} sorted by expert rating`,
        numberOfItems: itemListElements.length,
        itemListElement: itemListElements,
      } : null;



      const faqSchema = content?.faqs?.length ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: content.faqs.filter((faq: any) => faq.question && faq.answer).map((faq: any) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      } : null;

      return (
        <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
        
          {faqSchema && (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
          )}
          {itemListSchema && (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
          )}
         <HubPage hub={hub} tours={tours} content={content} allHubs={allHubs} recommendedTours={recommendedTours} />
        </>
      );
    }
  }

  const page = await getPage(slug)
  if (!page) {
    notFound()
  }

  // Obtener tours recomendados si están habilitados
  const recommendedTours = page.pageSettings?.showRecommendedTours 
    ? await getRecommendedTours() 
    : []

  // 🆕 Obtener artículos relacionados (pillar/supporting system)
  const relatedArticles = await getRelatedArticles(
    slug,
    page.isPillar === true,
    page.parentPillar?._ref
  )

  // Pasar datos al Client Component
  return (
    <StaticPageClient 
      page={page} 
      slug={slug} 
      recommendedTours={recommendedTours}
      relatedArticles={relatedArticles}
    />
  )
}