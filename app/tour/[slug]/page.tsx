import { client } from '@/sanity/lib/client';
import { urlFor } from '@/sanity/lib/image';
import { Metadata } from 'next';
import TourPageClient from './TourPageClient';
import { permanentRedirect } from 'next/navigation';
import { findHubForTour } from '@/lib/tourHubs';
import { orderTourBody } from '@/lib/orderTourBody';

// ========================================
// CONFIGURACIÓN
// ========================================
const SITE_URL = 'https://lasvegastour.com';
const SITE_NAME = 'LasVegasTour';

const cacheConfig = {
  next: { revalidate: 3600 }
};

// ========================================
// GENERAR METADATA DINÁMICO - Next.js 15
// ========================================
export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}): Promise<Metadata> {
  const { slug } = await params;
  
  const post = await client.fetch(`
    *[_type == "post" && slug.current == $slug][0]{
      title,
      slug,
      seoTitle,
      seoDescription,
      seoKeywords,
      seoImage{
        asset->{ url },
        alt
      },
      tourInfo{
        duration,
        price,
        currency,
        location,
        platform
      },
      publishedAt
    }
  `, { slug }, cacheConfig);

  if (!post) {
    return {
      title: 'Tour not found',
      description: 'This tour doesn\'t exist.'
    };
  }

  const canonical = `${SITE_URL}/tour/${post.slug.current}`;
  const socialImage = post.seoImage
    ? urlFor(post.seoImage).width(1200).height(630).url()
    : `${SITE_URL}/images/default-social.jpg`;

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || `Discover ${post.title} - Complete tour with expert guide`;

  return {
    title,
    description,
    keywords: post.seoKeywords || [],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: canonical,
      title,
      description,
      siteName: SITE_NAME,
      images: [{ url: socialImage, width: 1200, height: 630, alt: post.seoImage?.alt || title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
    alternates: {
      canonical,
      languages: { 'en': canonical },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    }
  };
}

// ========================================
// HELPER: Limpiar undefined del schema
// ========================================
const cleanSchema = (obj: any): any => {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const cleaned = obj.map(cleanSchema).filter(item => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanSchema(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return obj;
};

// ========================================
// HELPER: Convertir duración a ISO 8601
// ========================================
function formatDurationISO(duration: string): string | null {
  if (!duration) return null;

  const normalized = duration.toLowerCase().trim();

  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*hour/i);
  if (rangeMatch) {
    const minHours = parseFloat(rangeMatch[1]);
    return hoursToISO(minHours);
  }

  const hoursMinMatch = normalized.match(/(\d+(?:\.\d+)?)\s*hours?\s*(?:and\s*)?(\d+)\s*min/i);
  if (hoursMinMatch) {
    const hours = parseInt(hoursMinMatch[1]);
    const mins = parseInt(hoursMinMatch[2]);
    return `PT${hours}H${mins}M`;
  }

  const hoursMatch = normalized.match(/(\d+(?:\.\d+)?)\s*hours?/i);
  if (hoursMatch) {
    const hours = parseFloat(hoursMatch[1]);
    return hoursToISO(hours);
  }

  const minsMatch = normalized.match(/(\d+)\s*min/i);
  if (minsMatch) {
    const totalMins = parseInt(minsMatch[1]);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0 && mins > 0) return `PT${hours}H${mins}M`;
    if (hours > 0) return `PT${hours}H`;
    return `PT${mins}M`;
  }

  return null;
}

function hoursToISO(hours: number): string {
  const wholeHours = Math.floor(hours);
  const mins = Math.round((hours - wholeHours) * 60);

  if (wholeHours > 0 && mins > 0) return `PT${wholeHours}H${mins}M`;
  if (wholeHours > 0) return `PT${wholeHours}H`;
  if (mins > 0) return `PT${mins}M`;
  return 'PT1H';
}

// ========================================
// HELPER: Extraer Quick Answer del body → FAQPage schema
// ========================================
function extractQuickAnswerFAQ(body: any[]): any | null {
  if (!body || !Array.isArray(body)) return null;

  for (const block of body) {
    if (block._type !== 'block' || block.style !== 'h3') continue;

    const text = (block.children || [])
      .map((child: any) => child.text || '')
      .join('');

    if (!text.includes('Quick Answer')) continue;

    const content = text
      .replace(/🎯\s*/g, '')
      .replace(/Quick Answer:\s*/i, '')
      .replace(/\*\*/g, '');

    const match = content.match(/^(Is [^?]+\?)\s*(Yes|No)\s*[—–-]?\s*(.*)$/i);

    if (match) {
      const question = match[1].trim();
      const answer = match[2].trim();
      const description = match[3].trim();

      return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': question,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': `${answer} — ${description}`
            }
          }
        ]
      };
    }
  }

  return null;
}



// ========================================
// COMPONENTE PRINCIPAL - Next.js 15
// ========================================
export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = await client.fetch(`
    *[_type == "post" && slug.current == $slug][0]{
      title,
      slug,
      "categorySlug": category->slug.current,
      discontinued,
      redirectTo,
      seoTitle,
      quickAnswerQuestion,
      seoDescription,
      seoKeywords,
      seoImage{
        asset->{ url },
        alt
      },
      mainImage{
        asset->{ url },
        alt
      },
      heroGallery[]{
        asset->{ url },
        alt
      },
      body,
      publishedAt,
      author->{ name },
      tourInfo{
        duration,
        price,
        currency,
        location,
        platform
      },
      tourFeatures{
        freeCancellation,
        skipTheLine,
        wheelchairAccessible,
        hostGuide,
        audioGuide,
        smallGroupAvailable
      },
      getYourGuideTourId,
      getYourGuideUrl,
      bookingUrl,
      getYourGuideData{
        rating,
        reviewCount,
        provider,
        lastUpdated
      },
  editorialRating,
      editorialReview,
      editorialDate,
      faqs[]{
        question,
        answer
      },
      aiCitable{
        phrase,
        pattern,
        generatedAt
      }
    }
  `, { slug }, cacheConfig);

  if (post?.discontinued) {
    const hub = findHubForTour(post);
    permanentRedirect(post.redirectTo || (hub ? `/${hub.slug}` : '/tours/colosseum'));
  }
  

  const categorySlug = post?.categorySlug || null;

  // Orden canonico garantizado en cada carga (server). El dato puede estar como sea.
  if (post?.body) post.body = orderTourBody(post.body, categorySlug);

  const relatedPosts = await client.fetch(`
    *[_type == "post" && slug.current != $slug && discontinued != true && category->slug.current == $categorySlug] | order(getYourGuideData.reviewCount desc)[0...20]{
      _id,
      title,
      slug,
      seoDescription,
      seoImage{ asset->{ url }, alt },
      mainImage{ asset->{ url }, alt },
      "heroGallery": heroGallery[0..0]{ asset->{ url }, alt },
      "mainImageUrl": mainImage.asset->url,
      "heroImageUrl": heroGallery[0].asset->url,
      "body": body[0...1],
      tourInfo{
        duration,
        price,
        currency
      },
      tourFeatures{
        freeCancellation,
        skipTheLine,
        wheelchairAccessible,
        smallGroupAvailable
      },
      getYourGuideData{
        rating,
        reviewCount
      }
    }
  `, { slug, categorySlug }, cacheConfig);

  const recommendedPosts = await client.fetch(`
    *[_type == "post" && slug.current != $slug && discontinued != true]{
       _id,
       title,
       slug,
       "categorySlug": category->slug.current,
       mainImage{
         asset->{ url },
         alt
       },
       "heroGallery": heroGallery[0..0]{
         asset->{ url },
         alt
       },
       "body": body[0...1],
       getYourGuideData{
         rating,
         reviewCount
       }
     }
   `, { slug }, cacheConfig);

  // ========================================
  // ✅ STRUCTURED DATA - PRODUCT UNIFICADO
  // ========================================
  const productSchema = post.tourInfo ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}/tour/${post.slug.current}#product`,
    "name": post.seoTitle || post.title,
    "description": post.seoDescription || `Discover ${post.title} with expert guides`,
    "url": `${SITE_URL}/tour/${post.slug.current}`,

    ...(post.aiCitable?.phrase && {
      "disambiguatingDescription": post.aiCitable.phrase
    }),

    "image": post.heroGallery?.[0]?.asset?.url
    
      || post.mainImage?.asset?.url 
      || `${SITE_URL}/images/default-tour.jpg`,

    ...(post.tourInfo.price && post.tourInfo.currency && {
      "offers": {
        "@type": "Offer",
        "availability": "https://schema.org/InStock",
        "price": Number(post.tourInfo.price),
        "priceCurrency": post.tourInfo.currency,
        "validFrom": new Date().toISOString().split('T')[0],
        "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        "url": `${SITE_URL}/tour/${post.slug.current}`
      }
    }),

    "brand": {
      "@type": "Organization",
      "name": SITE_NAME
    },

    "provider": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    },

    ...(post.tourInfo.location && {
      "touristDestination": {
        "@type": "Place",
        "name": post.tourInfo.location,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": post.tourInfo.location
        }
      }
    }),

    ...(post.tourInfo.duration && formatDurationISO(post.tourInfo.duration) && {
      "duration": formatDurationISO(post.tourInfo.duration)
    }),

    ...(post.tourFeatures && {
      "amenityFeature": [
        ...(post.tourFeatures.freeCancellation ? [{
          "@type": "LocationFeatureSpecification",
          "name": "Free Cancellation",
          "value": true
        }] : []),
        ...(post.tourFeatures.skipTheLine ? [{
          "@type": "LocationFeatureSpecification",
          "name": "Skip the Line Access",
          "value": true
        }] : []),
        ...(post.tourFeatures.wheelchairAccessible ? [{
          "@type": "LocationFeatureSpecification",
          "name": "Wheelchair Accessible",
          "value": true
        }] : []),
        ...(post.tourFeatures.smallGroupAvailable ? [{
          "@type": "LocationFeatureSpecification",
          "name": "Small Group Available",
          "value": true
        }] : []),
        ...(post.tourFeatures.hostGuide ? [{
          "@type": "LocationFeatureSpecification",
          "name": "Guide Languages",
          "value": post.tourFeatures.hostGuide
        }] : []),
        ...(post.tourFeatures.audioGuide ? [{
          "@type": "LocationFeatureSpecification",
          "name": "Audio Guide Languages",
          "value": post.tourFeatures.audioGuide
        }] : [])
      ].filter(Boolean)
    })
  } : null;

  const finalProductSchema = productSchema ? cleanSchema(productSchema) : null;

  // ========================================
  // ✅ STRUCTURED DATA - FAQ (Quick Answer)
  // ========================================
  const faqSchema = extractQuickAnswerFAQ(post.body);


  

// ========================================
  // ✅ STRUCTURED DATA - EDITORIAL REVIEW
  // ========================================
  const reviewSchema = (post.editorialRating && post.editorialReview) ? cleanSchema({
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@id": `${SITE_URL}/tour/${post.slug.current}#product`
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": post.editorialRating,
      "bestRating": 5,
      "worstRating": 1
    },
    "author": {
      "@type": "Organization",
      "name": "LasVegasTour Editorial Team",
      "url": "https://lasvegastour.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    },
    "datePublished": post.editorialDate || post.publishedAt,
    "reviewBody": post.editorialReview
  }) : null;



  return (
    <>
      {/* Schema Product Unificado */}
      {finalProductSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(finalProductSchema)
          }}
        />
      )}

      {/* Schema FAQ - Quick Answer */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema)
          }}
        />
      )}

      

      {/* Schema Editorial Review */}
      {reviewSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(reviewSchema)
          }}
        />
      )}
      
{/* Schema FAQPage - Structured FAQs */}
{post.faqs && post.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: post.faqs.map((faq: any) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer
                }
              }))
            })
          }}
        />
      )}
{/* Schema ItemList - Compare Similar Tours */}
{relatedPosts && relatedPosts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(cleanSchema({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              'name': 'Compare Similar Tours',
              'description': 'Compare top-rated Las Vegas tours',
              'numberOfItems': relatedPosts.filter((t: any, i: number, arr: any[]) => t.tourInfo?.price && t.getYourGuideData?.rating && t.slug?.current !== post.slug?.current && t.title !== post.title && arr.findIndex((x: any) => x.title === t.title) === i).slice(0, 3).length,
              'itemListElement': relatedPosts.filter((t: any, i: number, arr: any[]) => t.tourInfo?.price && t.getYourGuideData?.rating && t.slug?.current !== post.slug?.current && t.title !== post.title && arr.findIndex((x: any) => x.title === t.title) === i).sort((a: any, b: any) => (a.tourInfo?.price || 999) - (b.tourInfo?.price || 999)).slice(0, 3).map((tour: any, i: number) => ({
                '@type': 'ListItem',
                'position': i + 1,
                'item': {
                  '@type': 'Product',
                  'name': tour.title,
                  'url': `https://lasvegastour.com/tour/${tour.slug?.current}`,
                  'description': tour.seoDescription || `${tour.title} - Expert-guided tour in Las Vegas`,
                  'image': tour.seoImage?.asset?.url || tour.heroGallery?.[0]?.asset?.url || tour.mainImage?.asset?.url,
                  ...(tour.tourInfo?.price ? {
                    'offers': {
                      '@type': 'Offer',
                      'price': Number(tour.tourInfo.price),
                      'priceCurrency': tour.tourInfo?.currency || 'USD',
                  'availability': 'https://schema.org/InStock',
                  'priceValidUntil': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    }
                  } : {}),
                  ...(tour.tourInfo?.duration ? {
                    'duration': formatDurationISO(tour.tourInfo.duration)
                  } : {})
                }
              }))
            }))
          }}
        />
      )}

      <TourPageClient
        post={post}
        relatedPosts={relatedPosts}
        recommendedPosts={recommendedPosts}
      />
    </>
  );
}