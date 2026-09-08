'use client';

import React from 'react';
import { PortableText } from '@portabletext/react'
import Image from 'next/image'
import { urlFor } from '@/sanity/lib/image'
import RecommendedTours from '@/app/components/blog/RecommendedTours'
import Footer from '@/app/components/Footer'
import Container from '@/app/components/Container'

import Breadcrumbs from '@/app/components/Breadcrumbs'
import SchemaOrgHead from '@/app/components/SchemaOrgHead'
import TourFinderButton from '@/app/components/TourFinderButton';
import TableOfContents from '@/app/components/TableOfContents';
import AuthorBox from '@/app/components/AuthorBox';
import HubChips from '@/app/components/HubChips';

// Interface actualizada con richSnippets y sidebarWidget
interface SanityPage {
  title: string;
  slug: {
    current: string;
  };
  isPillar?: boolean;
  parentPillar?: { _ref?: string; _id?: string };
  
  author?: 'mario-dalo' | 'curator-team' | 'none';

  category?: {
    title: string;
    slug: { current: string };
    description: string;
    color: string;
  };
  content: any;
  pageType?: string;
  
  heroImage?: {
    asset: { url: string };
    alt?: string;
    heading?: string;
  };
  heroContent?: {
    heroTitle?: string;
    heroSubtitle?: string;
    excerpt?: string;
    customText?: string;
  };
  highlights?: Array<{
    title: string;
    description?: string;
    icon?: string;
  }>;
  pageSettings?: {
    showRecommendedTours?: boolean;
    backgroundColor?: string;
    ctaText?: string;
    ctaUrl?: string;
  };
  
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

  // Sidebar Widget
  sidebarWidget?: {
    showWidget?: boolean;
    ctaTitle?: string;
    ctaDescription?: string;
    ctaButtonText?: string;
    ctaButtonUrl?: string;
    widgetImage?: {
      asset: { url: string };
      alt?: string;
    };
    quickLinks?: Array<{
      title: string;
      url: string;
      icon?: string;
    }>;
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

// CLIENT COMPONENT CON STYLED-JSX
export default function StaticPageClient({ 
  page, 
  slug, 
  recommendedTours,
  relatedArticles = []
}: { 
  page: SanityPage; 
  slug: string;
  recommendedTours: any[];
  relatedArticles?: Array<{ _id: string; title: string; slug: { current: string } }>;
}) {
  
  // 🎯 PÁGINAS DONDE NO USAR AUTOLINKER
  const excludedSlugs = ['about-us', 'contact-us', 'privacy-policy'];
  const isExcludedPage = excludedSlugs.includes(page.slug.current);
  
  // Determinar si es página hero
  const isHeroPage = page.pageType === 'hero'

  // 🆕 EXTRAER QUICK ANSWER BOX DEL CONTENIDO
  const quickAnswerBlock = page.content?.find((block: any) => block._type === 'quickAnswerBox');
  const contentWithoutQuickAnswer = page.content?.filter((block: any) => block._type !== 'quickAnswerBox') || [];

  // 🆕 SCRIPT PARA SMART GUIDE LINK
  React.useEffect(() => {
    // Función de scroll suave personalizada
    const smoothScrollTo = (element: HTMLElement) => {
      const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - 20;
      const startPosition = window.pageYOffset;
      const distance = targetPosition - startPosition;
      const duration = 800; // ms
      let start: number | null = null;

      const easeInOutCubic = (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };

      const animation = (currentTime: number) => {
        if (start === null) start = currentTime;
        const timeElapsed = currentTime - start;
        const progress = Math.min(timeElapsed / duration, 1);
        const easeProgress = easeInOutCubic(progress);
        
        window.scrollTo(0, startPosition + distance * easeProgress);
        
        if (timeElapsed < duration) {
          requestAnimationFrame(animation);
        }
      };

      requestAnimationFrame(animation);
    };

    const handleSmartLink = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('.smart-guide-link') as HTMLAnchorElement;
      
      if (link) {
        const linkUrl = new URL(link.href);
        const currentUrl = new URL(window.location.href);
        
        // Si ya estamos en la misma página, hacer scroll en vez de navegar
        if (linkUrl.pathname === currentUrl.pathname) {
          e.preventDefault();
          const tocSection = document.getElementById('table-of-contents');
          if (tocSection) {
            smoothScrollTo(tocSection);
          }
        }
        // Si viene de afuera (Google), deja que navegue normalmente
      }
    };

    document.addEventListener('click', handleSmartLink);
    return () => document.removeEventListener('click', handleSmartLink);
  }, []);

  // PREPARAR DATOS PARA SCHEMA.ORG (formato compatible con el generador)
  const pageDataForSchema = {
    title: page.title,
    slug: page.slug,
    seoDescription: page.seoDescription,
    seoImage: page.seoImage,
    publishedAt: page.publishedAt,
    _updatedAt: page._updatedAt,
    richSnippets: page.richSnippets,
    author: page.author,
    isPillar: page.isPillar,
    parentPillar: page.parentPillar
  };

  // PORTABLE TEXT COMPONENTS COMPLETOS CON GALERÍAS
  const portableTextComponents = {
    types: {
      // IMAGEN SIMPLE (mejorada)
      image: ({ value }: any) => (
        <div style={{ 
          margin: '2rem 0',
          position: 'relative',
          width: '100%',
          height: 'clamp(200px, 30vw, 400px)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {value.asset?.url ? (
            <Image
              src={urlFor(value)
                .width(800)
                .height(400)
                .format('webp')
                .quality(85)
                .fit('crop')
                .url()}
              alt={value.alt || ''}
              fill
              style={{ objectFit: 'cover' }}
              sizes="(max-width: 768px) 100vw, 800px"
              loading="lazy"
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '2rem'
            }}>
              📷
            </div>
          )}
          {value.caption && (
            <p style={{
              marginTop: '0.5rem',
              fontSize: '0.9rem',
              color: '#666',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              {value.caption}
            </p>
          )}
        </div>
      ),

      // GALERÍA DE IMÁGENES - SMART LAYOUT SIN ESPACIOS EXTRA
      imageGallery: ({ value }: any) => {
        if (!value?.images || value.images.length === 0) {
          return null;
        }

        const layout = value.layout || 'grid-2';
        const imageCount = value.images.length;
        
        // LÓGICA INTELIGENTE PARA COLUMNAS
        const getGridColumns = () => {
          switch (layout) {
            case 'grid-2':
              if (imageCount === 1) return '1fr';
              return 'repeat(2, 1fr)';
            case 'grid-3':
              if (imageCount === 1) return '1fr';
              if (imageCount === 2) return 'repeat(2, 1fr)';
              if (imageCount === 3) return 'repeat(3, 1fr)';
              if (imageCount === 4) return 'repeat(2, 1fr)';
              if (imageCount >= 5) return 'repeat(3, 1fr)';
              return 'repeat(3, 1fr)';
            case 'carousel':
              return 'repeat(auto-fit, minmax(300px, 1fr))';
            default:
              return 'repeat(auto-fit, minmax(250px, 1fr))';
          }
        };

        // ALTURA DINÁMICA SEGÚN CANTIDAD
        const getImageHeight = () => {
          if (imageCount === 1) return '400px';
          if (imageCount === 2) return '300px';
          if (imageCount === 3) return '280px';
          return '250px';
        };

        // VERIFICAR SI HAY CAPTIONS
        const hasAnyCaptions = value.images.some((image: any) => image.caption);
        
        return (
          <div style={{ margin: '2rem 0' }}>
            {value.title && (
              <h3 style={{ 
                marginBottom: '1rem',
                color: '#2c3e50',
                fontWeight: '600',
                fontSize: '1.5rem'
              }}>
                {value.title}
              </h3>
            )}
            <div style={{
              display: 'grid',
              gap: hasAnyCaptions ? '1rem' : '1.5rem',
              gridTemplateColumns: getGridColumns()
            }}>
              {value.images.map((image: any, index: number) => (
                <div key={index} style={{ 
                  position: 'relative',
                  marginBottom: image.caption ? '0.5rem' : '0'
                }}>
                  <div style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: getImageHeight(), 
                    borderRadius: '8px', 
                    overflow: 'hidden'
                  }}>
                    <Image
                      src={urlFor(image)
                        .width(400)
                        .height(300)
                        .format('webp')
                        .quality(80)
                        .fit('crop')
                        .url()}
                      alt={image.alt || image.caption || `Gallery image ${index + 1}`}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 400px"
                      loading="lazy"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                    />
                  </div>
                  {image.caption && (
                    <p style={{
                      marginTop: '0.5rem',
                      marginBottom: '0',
                      fontSize: '0.9rem',
                      color: '#666',
                      textAlign: 'center',
                      fontStyle: 'italic',
                      lineHeight: '1.3'
                    }}>
                      {image.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      },

      // IMAGEN CON TEXTO
      imageWithText: ({ value }: any) => {
        if (!value?.image) return null;

        const layout = value.layout || 'image-left';

        return (
          <div style={{
            display: 'grid',
            gap: '2rem',
            margin: '2rem 0',
            alignItems: 'center',
            gridTemplateColumns: '1fr'
          }}>
            <div style={{ 
              order: layout === 'text-left' ? 2 : 1,
              position: 'relative', 
              width: '100%', 
              height: '300px', 
              borderRadius: '8px', 
              overflow: 'hidden'
            }}>
              <Image
                src={urlFor(value.image)
                  .width(500)
                  .height(300)
                  .format('webp')
                  .quality(85)
                  .fit('crop')
                  .url()}
                alt={value.image.alt || 'Imagen con texto'}
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 100vw, 500px"
                loading="lazy"
              />
            </div>
            <div style={{ order: layout === 'text-left' ? 1 : 2 }}>
              <PortableText value={value.text} components={portableTextComponents} />
            </div>
          </div>
        );
      },

      // CTA BOX
      ctaBox: ({ value }: any) => {
        if (!value?.title || !value?.buttonText || !value?.buttonUrl) return null;

        const style = value.style || 'primary';

        return (
          <div style={{
            margin: '2rem 0',
            padding: '2rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            background: style === 'primary' 
              ? 'linear-gradient(135deg, #e91e63 0%, #8e24aa 100%)'
              : style === 'secondary'
              ? 'linear-gradient(135deg, #673ab7 0%, #3f51b5 100%)'
              : 'white',
            color: style === 'outline' ? '#2c3e50' : 'white',
            border: style === 'outline' ? '2px solid #e91e63' : 'none'
          }}>
            <h3 style={{
              margin: '0 0 1rem 0',
              fontSize: '1.5rem',
              fontWeight: '600'
            }}>
              {value.title}
            </h3>
            {value.description && (
              <p style={{
                margin: '0 0 1.5rem 0',
                opacity: 0.9
              }}>
                {value.description}
              </p>
            )}
            <a 
              href={value.buttonUrl} 
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                borderRadius: '25px',
                textDecoration: 'none',
                fontWeight: '600',
                color: style === 'outline' ? 'white' : 'inherit',
                background: style === 'outline' 
                  ? '#e91e63' 
                  : 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              {value.buttonText}
            </a>
          </div>
        );
      },

      // TABLA SIMPLE
      simpleTable: ({ value }: any) => {
        if (!value?.rows || value.rows.length === 0) return null;

        return (
          <div style={{ margin: '2rem 0', overflowX: 'auto' }}>
            {value.title && (
              <h3 style={{
                marginBottom: '1rem',
                color: '#2c3e50',
                fontWeight: '600'
              }}>
                {value.title}
              </h3>
            )}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <tbody>
                {value.rows.map((row: any, rowIndex: number) => (
                  <tr key={rowIndex}>
                    {row.cells && row.cells.map((cell: string, cellIndex: number) => {
                      const isHeaderRow = rowIndex === 0;
                      const Tag = isHeaderRow ? 'th' : 'td';
                      
                      return (
                        <Tag 
                          key={cellIndex}
                          {...(isHeaderRow && { scope: 'col' })}
                          style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid #e9ecef',
                            verticalAlign: 'top',
                            background: isHeaderRow ? '#f8f9fa' : 'white',
                            fontWeight: isHeaderRow ? '600' : 'normal',
                            color: isHeaderRow ? '#2c3e50' : 'inherit',
                            textAlign: isHeaderRow ? 'left' : 'inherit'
                          }}
                        >
                          {cell}
                        </Tag>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      },

      // RAW HTML
      rawHtml: ({ value }: any) => {
        if (!value?.code) return null;
        return (
          <div 
            className="raw-html-block"
            style={{ margin: '2rem 0', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{ __html: value.code }} 
          />
        );
      },

      // TOUR COMPARISON TABLE
      tourComparisonTable: ({ value }: any) => {
        if (!value?.tours || value.tours.length === 0) return null;

        return (
          <div style={{ margin: '2rem 0', overflowX: 'auto' }}>
            {value.title && (
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a'
              }}>
                {value.title}
              </h3>
            )}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#1a1a1a', borderBottom: '2px solid #e9ecef' }}>Best For</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#1a1a1a', borderBottom: '2px solid #e9ecef' }}>Tour</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#1a1a1a', borderBottom: '2px solid #e9ecef' }}>Price</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#1a1a1a', borderBottom: '2px solid #e9ecef' }}>Duration</th>
                  <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#1a1a1a', borderBottom: '2px solid #e9ecef' }}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {value.tours.map((item: any, index: number) => {
                  const tour = item.tourRef;
                  if (!tour) return null;
                  
                  const price = tour.tourInfo?.price;
                  const currency = tour.tourInfo?.currency || 'USD';
                  const duration = tour.tourInfo?.duration;
                  const rating = tour.getYourGuideData?.rating;
                  const reviewCount = tour.getYourGuideData?.reviewCount;
                  const tourUrl = `/tour/${tour.slug?.current}`;
                  const displayName = item.customName || tour.title;

                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #e9ecef' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500' }}>{item.category}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <a 
                          href={tourUrl}
                          style={{ 
                            color: '#8816c0', 
                            textDecoration: 'none',
                            fontWeight: '500'
                          }}
                        >
                          {displayName}
                        </a>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#e91e63' }}>
                        {price ? `${currency === 'USD' ? '$' : '€'}${price}` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#666' }}>
                        {duration || '-'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {rating ? (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <span style={{ color: '#FBBF24' }}>⭐</span>
                            <span style={{ fontWeight: '600' }}>{rating.toFixed(1)}</span>
                            {reviewCount && <span style={{ fontSize: '0.8rem', color: '#999' }}>({reviewCount.toLocaleString('en-US')})</span>}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      },

      // QUICK ANSWER BOX
      quickAnswerBox: ({ value }: any) => {
        if (!value?.answer) return null;

        const styles: Record<string, { bg: string; border: string; icon: string }> = {
          info: { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ️' },
          tip: { bg: '#f0fdf4', border: '#22c55e', icon: '💡' },
          warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️' },
          important: { bg: '#faf5ff', border: '#a855f7', icon: '✨' }
        };

        const style = styles[value.style] || styles.tip;

        return (
          <div style={{
            margin: '1.5rem 0',
            padding: '1.25rem 1.5rem',
            background: style.bg,
            borderLeft: `4px solid ${style.border}`,
            borderRadius: '0 8px 8px 0'
          }}>
            <div style={{
              fontWeight: '600',
              fontSize: '1.1rem',
              marginBottom: '0.5rem',
              color: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{style.icon}</span>
              <span>{value.title || 'Quick Answer'}</span>
            </div>
            <p style={{
              margin: 0,
              color: '#374151',
              lineHeight: '1.7',
              fontSize: '1rem'
            }}>
              {(() => {
                const firstDot = value.answer.indexOf('.');
                if (firstDot === -1) return value.answer;
                const firstSentence = value.answer.substring(0, firstDot + 1);
                const rest = value.answer.substring(firstDot + 1);
                return (
                  <>
                    <strong>{firstSentence}</strong>{rest}
                  </>
                );
              })()}
            </p>
          </div>
        );
      },

      // 🆕 QUICK ANSWER INLINE
      quickAnswer: ({ value }: any) => {
        if (!value?.question || !value?.answer) return null;

        return (
          <div style={{
            background: '#f3f4f6',
            borderLeft: '4px solid #e11d6b',
            borderRadius: '0 8px 8px 0',
            padding: '20px 24px',
            margin: '24px 0'
          }}>
            <h3 style={{
              color: '#e11d6b',
              fontSize: '1.1rem',
              fontWeight: '600',
              margin: '0 0 12px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>❓</span> {value.question}
            </h3>
            <p style={{
              color: '#4b5563',
              lineHeight: '1.7',
              margin: 0,
              fontSize: '1rem'
            }}>
              {(() => {
                const firstDot = value.answer.indexOf('.');
                if (firstDot === -1) return value.answer;
                const firstSentence = value.answer.substring(0, firstDot + 1);
                const rest = value.answer.substring(firstDot + 1);
                return (
                  <>
                    <strong>{firstSentence}</strong>{rest}
                  </>
                );
              })()}
            </p>
          </div>
        );
      },
    },
    marks: {
      link: ({ children, value }: any) => (
        <a
          href={value.href}
          style={{
            color: '#2563eb',
            textDecoration: 'underline',
            fontWeight: '500'
          }}
          // internos (links persistidos de link-articles) en la misma pestaña y SIN noreferrer
          target={value?.href?.startsWith('/') ? '_self' : '_blank'}
          rel={value?.href?.startsWith('/') ? undefined : 'noopener noreferrer'}
        >
          {children}
        </a>
      ),
      strong: ({ children }: any) => (
        <strong style={{ fontWeight: '700' }}>{children}</strong>
      ),
      em: ({ children }: any) => (
        <em style={{ fontStyle: 'italic' }}>{children}</em>
      )
    },
    block: {
      h2: ({ children, value }: any) => {
        const text = value?.children?.map((c: any) => c.text).join('') || '';
        const id = text
          .replace(/[^\w\s-]/g, '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        return (
          <h2 
            id={id}
            style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              marginTop: '2.5rem', 
              marginBottom: '1rem',
              color: '#1a1a1a',
              lineHeight: '1.2'
            }}
          >
            {children}
          </h2>
        );
      },
      h3: ({ children, value }: any) => {
        const text = value?.children?.map((c: any) => c.text).join('') || '';
        const id = text
          .replace(/[^\w\s-]/g, '')
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        return (
          <h3 
            id={id}
            style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginTop: '2rem', 
              marginBottom: '0.8rem',
              color: '#2a2a2a'
            }}
          >
            {children}
          </h3>
        );
      },
      h4: ({ children }: any) => (
        <h4 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          marginTop: '1.5rem', 
          marginBottom: '0.5rem',
          color: '#3a3a3a'
        }}>
          {children}
        </h4>
      ),
      // PÁRRAFOS CON AUTO-LINKS
      normal: ({ children }: any) => (
        <p className="content-paragraph">
        {children}
      </p>
      ),
      blockquote: ({ children }: any) => (
        <blockquote style={{
          borderLeft: '4px solid #8b5cf6',
          paddingLeft: '1.5rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem',
          margin: '1.5rem 0',
          fontStyle: 'italic',
          color: '#666',
          backgroundColor: '#f9f9f9',
          borderRadius: '0 8px 8px 0'
        }}>
          <p className="content-paragraph">
            {children}
          </p>
        </blockquote>
      )
    }
  }

  // 🆕 FUNCIÓN PARA RENDERIZAR QUICK ANSWER EXTRAÍDO
  const renderQuickAnswer = (block: any) => {
    if (!block?.answer) return null;

    const styles: Record<string, { bg: string; border: string; icon: string }> = {
      info: { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ️' },
      tip: { bg: '#f0fdf4', border: '#22c55e', icon: '💡' },
      warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️' },
      important: { bg: '#faf5ff', border: '#a855f7', icon: '✨' }
    };

    const style = styles[block.style] || styles.tip;

    return (
      <div style={{
        margin: '1.5rem 0',
        padding: '1.25rem 1.5rem',
        background: style.bg,
        borderLeft: `4px solid ${style.border}`,
        borderRadius: '0 8px 8px 0'
      }}>
        <div style={{
          fontWeight: '600',
          fontSize: '1.1rem',
          marginBottom: '0.5rem',
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{style.icon}</span>
          <span>{block.title || 'Quick Answer'}</span>
        </div>
        <p style={{
          margin: 0,
          color: '#374151',
          lineHeight: '1.7',
          fontSize: '1rem'
        }}>
          {(() => {
            const firstDot = block.answer.indexOf('.');
            if (firstDot === -1) return block.answer;
            const firstSentence = block.answer.substring(0, firstDot + 1);
            const rest = block.answer.substring(firstDot + 1);
            return (
              <>
                <strong>{firstSentence}</strong>{rest}
              </>
            );
          })()}
        </p>
        <a 
          href={`https://lasvegastour.com/${slug}`}
          className="smart-guide-link"
          style={{
            display: 'inline-block',
            marginTop: '10px',
            fontSize: '0.9rem',
            color: '#2e7d32',
            fontWeight: 700,
            textDecoration: 'none'
          }}
        >
          Explore the full guide &amp; expert tips ➜
        </a>
      </div>
    );
  };

  return (
    <div>
      {/* SOLO SchemaOrgHead - Sistema unificado */}
      <SchemaOrgHead pageData={pageDataForSchema} relatedArticles={relatedArticles} />

      {/* TÍTULO ARRIBA - EXACTO COMO TOUR PAGE */}
      <Container>        <h1 style={{ 
          fontSize: 'clamp(2rem, 5vw, 3rem)', 
          fontWeight: 'bold', 
          marginBottom: '1rem',
          color: '#1a1a1a',
          lineHeight: '1.1'
        }}>
          {page.title}
        </h1>
        
        {/* BREADCRUMBS - SOLO PARA PÁGINAS HERO (SEO) */}
        {isHeroPage && (
          <Breadcrumbs items={[
            { label: 'Home', href: '/' },
            { label: page.title, href: `/${page.slug.current}`, isActive: true }
          ]} />
        )}

        {/* AUTHOR BYLINE - E-E-A-T */}
        <AuthorBox author={page.author} variant="byline" publishedAt={page.publishedAt} />
        
        {/* SUBTÍTULO/DESCRIPCIÓN */}
        {(page.seoDescription || page.seo?.metaDescription) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>📄</span>
            <span style={{
              fontSize: '1.1rem',
              color: '#666',
              lineHeight: '1.6'
            }}>
              {page.seoDescription || page.seo?.metaDescription}
            </span>
          </div>
        )}
      </Container>

      {/* HERO SECTION - IMAGEN LIMPIA SIN OVERLAY */}
      {isHeroPage && page.heroImage && (
        <Container>
          <section style={{
            position: 'relative',
            height: '50vh',
            minHeight: '300px',
            overflow: 'hidden',
            marginBottom: '3rem',
            borderRadius: '12px'
          }}>
            <Image
              src={urlFor(page.heroImage)
                .width(1200)
                .height(600)
                .format('webp')
                .quality(85)
                .fit('crop')
                .url()}
              alt={page.heroImage.alt || page.title}
              fill
              style={{ objectFit: 'cover' }}
              priority
              sizes="100vw"
            />
            
            {/* TEXTO EN CAJA BLANCA CON BLUR - SOLO SI HAY CONTENIDO */}
            {(page.heroContent?.heroTitle || page.heroContent?.customText || page.heroContent?.excerpt) && (
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '20px',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{
                  color: '#1a1a1a',
                  maxWidth: '800px'
                }}>
                  {page.heroContent?.heroTitle && (
                    <h2 style={{
                      fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                      fontWeight: 'bold',
                      margin: '0 0 1rem 0',
                      color: '#1a1a1a'
                    }}>
                      {page.heroContent.heroTitle}
                    </h2>
                  )}
                  
                  {page.heroContent?.customText ? (
                    <p style={{
                      fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                      opacity: 0.8,
                      margin: '0',
                      lineHeight: '1.5'
                    }}>
                      {page.heroContent.customText}
                    </p>
                  ) : page.heroContent?.excerpt && (
                    <p style={{
                      fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                      opacity: 0.8,
                      margin: '0',
                      lineHeight: '1.5'
                    }}>
                      {page.heroContent.excerpt}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </Container>
      )}

      {/* LAYOUT DOS COLUMNAS - CON CLASES PARA RESPONSIVE */}
      <Container>
        <div className="main-grid" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 300px',
          gap: '40px',
          alignItems: 'start',
          marginBottom: '60px',
          maxWidth: '1150px',
          margin: '0 auto'
        }}>
          
          {/* COLUMNA IZQUIERDA - CONTENIDO SIN CONTENEDORES */}
          <div style={{
            minWidth: 0,
            maxWidth: '100%',
            paddingRight: '20px'
          }}>

            {/* HIGHLIGHTS/TIPS - Solo para páginas Hero */}
            {isHeroPage && page.highlights && page.highlights.length > 0 && (
              <section style={{ marginBottom: '0.50rem' }}>
                <h2 style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  marginBottom: '2rem',
                  color: '#1a1a1a'
                }}>
                  Essential Tips & Highlights
                </h2>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {page.highlights.map((highlight, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      background: 'white',
                      padding: '1.5rem',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      border: '1px solid #e8eaed'
                    }}>
                      <span style={{
                        fontSize: '2rem',
                        flexShrink: 0,
                        width: '40px',
                        textAlign: 'center'
                      }}>
                        {highlight.icon || '💡'}
                      </span>
                      <div>
                        <h3 style={{
                          fontSize: '1.1rem',
                          fontWeight: '600',
                          marginBottom: '0.5rem',
                          color: '#1a1a1a'
                        }}>
                          {highlight.title}
                        </h3>
                        {highlight.description && (
                          <p style={{
                            fontSize: '0.95rem',
                            color: '#666',
                            lineHeight: '1.5',
                            margin: 0
                          }}>
                            {highlight.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 🆕 QUICK ANSWER - ANTES DE LA TABLA DE CONTENIDOS */}
            {quickAnswerBlock && renderQuickAnswer(quickAnswerBlock)}

            {/* TABLA DE CONTENIDOS */}
            {page.content && (
              <div id="table-of-contents">
                <TableOfContents content={contentWithoutQuickAnswer} />
              </div>
            )}

            {/* CONTENIDO PRINCIPAL CON AUTO-LINKS Y GALERÍAS (SIN QUICK ANSWER) */}
            <section id="description" className="sanity-content" style={{ marginBottom: '3rem' }}>
              <PortableText 
                value={contentWithoutQuickAnswer} 
                components={portableTextComponents}
              />
            </section>

            {/* AUTHOR BOX FULL - E-E-A-T */}
            <AuthorBox author={page.author} variant="full" />

               {/* RELATED ARTICLES */}
               {relatedArticles && relatedArticles.length > 0 && (
              <section style={{ margin: '3rem 0' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', color: '#1f2937' }}>
                  📚 Related Articles
                </h2>
                <div className="related-articles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {relatedArticles.map((article: any) => (
                    <a
                      key={article._id}
                      href={`/${article.slug.current}`}
                      style={{ display: 'block', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', textDecoration: 'none', color: '#1f2937', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                    >
                      <div style={{ position: 'relative', width: '100%', height: '160px', background: '#f3f4f6' }}>
                        {article.heroImage?.asset?.url ? (
                          <Image
                            src={urlFor(article.heroImage).width(400).height(240).format('webp').quality(80).fit('crop').url()}
                            alt={article.heroImage.alt || article.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="(max-width: 768px) 100vw, 400px"
                            loading="lazy"
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', fontSize: '2.5rem', color: '#9ca3af' }}>
                            📄
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '0.875rem 1rem', fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.4 }}>
                        {article.title}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            
            {/* FAQs */}
            {page.richSnippets?.faqItems && page.richSnippets.faqItems.length > 0 && (
              <section style={{ marginTop: '3rem', marginBottom: '2rem' }}>
                <h2 style={{
                  fontSize: '1.8rem',
                  fontWeight: 'bold',
                  marginBottom: '1.5rem',
                  color: '#1a1a1a'
                }}>
                  ❓ Frequently Asked Questions
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {page.richSnippets.faqItems.map((faq: any, index: number) => (
                    <details 
                      key={index}
                      style={{
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      <summary style={{
                        padding: '1rem 1.25rem',
                        cursor: 'pointer',
                        fontWeight: '600',
                        color: '#1f2937',
                        fontSize: '1.05rem',
                        listStyle: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        {faq.question}
                        <span style={{ fontSize: '1.2rem', color: '#9ca3af' }}>+</span>
                      </summary>
                      <div style={{
                        padding: '0 1.25rem 1rem 1.25rem',
                        color: '#4b5563',
                        lineHeight: '1.7'
                      }}>
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <section id="hub-tours" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
              <HubChips />
            </section>

            {/* RECOMMENDED TOURS - Si están habilitados */}
            {page.pageSettings?.showRecommendedTours && recommendedTours.length > 0 && (
              <section id="recommended" style={{ marginTop: '40px', marginBottom: '40px' }}>
                <RecommendedTours tours={recommendedTours} />
              </section>
            )}

          </div>
          
          {/* SIDEBAR STICKY - CON CLASE PARA OCULTAR EN MOBILE */}
          <div className="sidebar-desktop" style={{
            position: 'sticky',
            top: '20px',
            width: '300px',
            height: 'fit-content',
            alignSelf: 'start'
          }}>
            {/* WIDGET CTA - AHORA EDITABLE */}
            <div style={{
              width: '100%',
              maxWidth: '300px',
              background: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              
              {/* CTA PRINCIPAL - AHORA EDITABLE */}
              <div style={{ padding: '30px 20px 25px 20px' }}>
                <h3 style={{
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  marginBottom: '10px',
                  color: '#1a1a1a',
                  textAlign: 'center'
                }}>
                  {page.pageSettings?.ctaText ||
                   (slug.includes('contact') ? 'Ready to Explore Las Vegas?' :
                    slug.includes('about') ? 'Start Your Las Vegas Trip' :
                    'Discover More')}
                </h3>
                
                <p style={{
                  color: '#666',
                  marginBottom: '20px',
                  lineHeight: '1.6',
                  textAlign: 'center',
                  fontSize: '0.9rem'
                }}>
                  {slug.includes('contact') ? 'Contact us for personalized tour recommendations.' :
                   slug.includes('about') ? 'Discover the best tours and experiences in Las Vegas.' :
                   'Explore our amazing tours and experiences in Las Vegas.'}
                </p>
                
                <a 
                  href={page.pageSettings?.ctaUrl || '/tours'}
                  target={page.pageSettings?.ctaUrl?.startsWith('http') ? '_blank' : '_self'}
                  rel={page.pageSettings?.ctaUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  style={{
                    display: 'block',
                    background: '#e91e63',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '25px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  {page.pageSettings?.ctaText || 'View Tours'}
                </a>
              </div>

              {/* IMAGEN */}
              {page.heroImage && (
                <div style={{ padding: '0 20px 25px 20px' }}>
                  <div style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: '200px', 
                    borderRadius: '8px', 
                    overflow: 'hidden'
                  }}>
                    <Image
                      src={urlFor(page.heroImage)
                        .width(300)
                        .height(200)
                        .format('webp')
                        .quality(85)
                        .fit('crop')
                        .url()}
                      alt={page.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="300px"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              {/* ICONOS/FEATURES */}
              <div style={{ 
                padding: '10px 20px 20px 20px',
                fontSize: '12px',
                color: '#666',
                textAlign: 'center'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '5px' 
                }}>
                  <span style={{ marginRight: '8px' }}>✅</span>
                  <span>Instant Information</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: '5px' 
                }}>
                  <span style={{ marginRight: '8px' }}>📧</span>
                  <span>Expert Guidance Available</span>
                </div>
              </div>

            </div>

            {/* ENLACES RÁPIDOS - EDITABLES MANUALMENTE */}
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h4 style={{
                fontSize: '1rem',
                fontWeight: '600',
                marginBottom: '15px',
                color: '#1a1a1a'
              }}>
                Quick Links
              </h4>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {/* LINKS DINÁMICOS DESDE SANITY */}
                {page.sidebarWidget?.quickLinks && page.sidebarWidget.quickLinks.length > 0 ? (
                  page.sidebarWidget.quickLinks.map((link, index) => (
                    <a 
                      key={index}
                      href={link.url} 
                      style={{
                        color: '#8b5cf6',
                        textDecoration: 'none',
                        fontWeight: '500',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>{link.icon || '🔗'}</span> {link.title}
                    </a>
                  ))
                ) : (
                  // FALLBACK LINKS si no hay configurados en Sanity
                  <>
                    <a href="/" style={{
                      color: '#8b5cf6',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>🏛️</span> Homepage
                    </a>
                    
                    <a href="/tours" style={{
                      color: '#8b5cf6',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>🏟️</span> Browse Tours
                    </a>
                    
                    <a href="/about-us" style={{
                      color: '#8b5cf6',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>ℹ️</span> About Us
                    </a>
                    
                    <a href="/contact-us" style={{
                      color: '#8b5cf6',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>📧</span> Contact
                    </a>

                    <a href="/tours" style={{
                      color: '#8b5cf6',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>🎫</span> Book Tours
                    </a>
                  </>
                )}
              </div>
           
            </div>
            <TourFinderButton />
          </div>
          
        </div>
      </Container>

      {/* FOOTER FUERA DEL GRID - FULL WIDTH */}
      <Footer />

      {/* BOTÓN FLOTANTE - SOLO EN MOBILE (estilo tour page) */}
      <div className="mobile-floating-cta">
        <a 
          href={page.pageSettings?.ctaUrl || '/tours'}
          target={page.pageSettings?.ctaUrl?.startsWith('http') ? '_blank' : '_self'}
          rel={page.pageSettings?.ctaUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="cta-button"
        >
          <span className="cta-text">
            {page.pageSettings?.ctaText || 'View Tours'}
          </span>
          <span className="cta-arrow">→</span>
        </a>
      </div>

      {/* ESTILOS PARA LISTAS + RESPONSIVE + BACKGROUNDS + GALERÍAS */}
      <style jsx>{`
        /* BACKGROUND GENERAL */
        :global(body) {
          background: #fafafa !important;
        }
        
        :global(.sanity-content ul),
        :global(.sanity-content ol) {
          margin-left: 1.5rem;
          margin-bottom: 1.5rem;
          padding-left: 1rem;
          list-style-position: outside;
        }
        
        :global(.sanity-content ul) {
          list-style-type: disc;
        }
        
        :global(.sanity-content ol) {
          list-style-type: decimal;
        }
        
        :global(.sanity-content li) {
          margin-bottom: 0.8rem;
          line-height: 1.7;
          padding-left: 0.5rem;
        }
        
        :global(.sanity-content li p) {
          margin-bottom: 0.5rem;
        }

        /* RESPONSIVE - OCULTAR SIDEBAR EN MOBILE */
        @media (max-width: 768px) {
          .sidebar-desktop {
            display: none !important;
          }
          
          .main-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          
          .related-articles-grid {
            grid-template-columns: 1fr !important;
          }
        }

        /* BOTÓN FLOTANTE - ESTILO TOUR PAGE */
        .mobile-floating-cta {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          padding: 15px 20px;
          border-top: 1px solid #e0e0e0;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
          z-index: 1000;
          display: none; /* Oculto por defecto */
        }

        .cta-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #e91e63;
          color: white;
          text-decoration: none;
          padding: 16px 20px;
          border-radius: 30px;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(233, 30, 99, 0.3);
        }

        .cta-button:hover {
          background: #c2185b;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(233, 30, 99, 0.4);
        }

        .cta-button:active {
          transform: translateY(0);
        }

        .cta-text {
          flex: 1;
          text-align: center;
        }

        .cta-arrow {
          font-size: 18px;
          font-weight: bold;
        }

        /* MOSTRAR BOTÓN FLOTANTE SOLO EN MOBILE */
        @media (max-width: 768px) {
          .mobile-floating-cta {
            display: block !important;
          }
        }
      `}</style>
    </div>
  )
}
