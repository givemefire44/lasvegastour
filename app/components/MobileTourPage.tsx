'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { urlFor } from '@/sanity/lib/image';
import SanityContent from './blog/SanityContent';
import TourComparisonTable from './blog/TourComparisonTable';
import RecommendedTours from './blog/RecommendedTours';
import Breadcrumbs from './Breadcrumbs';
import RatingDisplay from './RatingDisplay';
import HubChips from './HubChips';

interface MobileTourPageProps {
  post: {
    title: string;
    slug: { current: string };
    category?: {
      title?: string;
      slug?: { current: string };
    };
    heroGallery?: Array<{
      asset: { 
        url?: string;
        _ref?: string;
      };
      alt?: string;
    }>;
    body: any;
    getYourGuideTourId?: string;
    bookingUrl?: string;
    getYourGuideUrl?: string;
    getYourGuideData?: {
      rating: number;
      reviewCount: number;
      lastUpdated?: string;
    };
    tourInfo?: {
      duration?: string;
      location?: string;
      price?: number;       
      currency?: string;
    };
    tourFeatures?: {
      freeCancellation?: boolean;
      skipTheLine?: boolean;
      wheelchairAccessible?: boolean;
      hostGuide?: boolean;
      audioGuide?: boolean;
      smallGroupAvailable?: boolean;
    };
    editorialRating?: number;    // ← acá, después del }; de tourFeatures
    editorialReview?: string;
    editorialDate?: string;
    faqs?: Array<{
      question: string;
      answer: string;
    }>;

  };
  recommendedTours?: Array<{
    _id: string;
    title: string;
    slug: { current: string };
    mainImage?: {
      asset: { 
        url?: string;
        _ref?: string;
      };
      alt?: string;
    };
    heroGallery?: Array<{
      asset: { 
        url?: string;
        _ref?: string;
      };
      alt?: string;
    }>;
    body: any;
  }>;
  relatedTours?: any[];  // 👈 CAMBIO 1: Agregado
}

function getBestImage(tour: MobileTourPageProps['recommendedTours'][0]) {
  if (!tour) return null;
  
  if (tour.heroGallery?.[0]) {
    const heroImage = tour.heroGallery[0];
    if (heroImage.asset?._ref || heroImage.asset?.url) {
      return heroImage;
    }
  }
  
  if (tour.mainImage) {
    if (tour.mainImage.asset?._ref || tour.mainImage.asset?.url) {
      return tour.mainImage;
    }
  }
  
  return null;
}

export default function MobileTourPage({ 
  post, 
  recommendedTours,
  relatedTours = []  // 👈 CAMBIO 2: Agregado
}: MobileTourPageProps) {
  const [currentImage, setCurrentImage] = useState(0);
  
  const images = post.heroGallery || [];
  
  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
  };
  
  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Recommended tours data:', recommendedTours?.slice(0, 2));
    }
  }, [recommendedTours]);

  return (
    <div className="mobile-tour-page">
      
      {/* TÍTULO ARRIBA DEL CAROUSEL */}
      <div className="mobile-tour-header">
        <h1 className="mobile-tour-title">
          {post.title}
        </h1>

        {/* RATING MOBILE - JUSTO DESPUÉS DEL TÍTULO */}
        {post.getYourGuideData?.rating && (
          <div style={{ marginTop: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
            <RatingDisplay
              rating={post.getYourGuideData.rating}
              reviewCount={post.getYourGuideData.reviewCount}
              size="small"
              sourceUrl={post.bookingUrl || post.getYourGuideUrl}
            />
          </div>
        )}
        
        {/* BREADCRUMBS MOBILE MINIMALISTAS */}
        <div className="mobile-breadcrumbs">
          <Breadcrumbs items={[
            { label: 'Home', href: '/' },
            { label: 'Tours', href: '/tours/colosseum' },
            { label: 'Current', isActive: true }
          ]} 
          noSchema={true}
          />
        </div>
      </div>

      {/* HERO CAROUSEL */}
      <div className="mobile-hero-carousel">
        {images.length > 0 && (
          <>
            <div className="carousel-container">
              <Image
                src={urlFor(images[currentImage])
                  .width(400)
                  .height(300)
                  .format('webp')
                  .quality(90)
                  .fit('crop')
                  .url()}
                alt={images[currentImage].alt || post.title}
                fill
                style={{ objectFit: 'cover' }}
                priority={true}
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
              
              {images.length > 1 && (
                <>
                  <button 
                    className="carousel-btn carousel-prev"
                    onClick={prevImage}
                    aria-label="Imagen anterior"
                  >
                    ‹
                  </button>
                  <button 
                    className="carousel-btn carousel-next"
                    onClick={nextImage}
                    aria-label="Siguiente imagen"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            
            {images.length > 1 && (
              <div className="carousel-dots">
                {images.map((_, index) => (
                  <button
                    key={index}
                    className={`carousel-dot ${index === currentImage ? 'active' : ''}`}
                    onClick={() => setCurrentImage(index)}
                    aria-label={`Ver imagen ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="mobile-tour-content">
        
        {/* CONTENIDO SANITY - CON RELATEDTOURS */}
        <div className="mobile-tour-body">
        <SanityContent post={post} relatedTours={relatedTours} />
        </div>

        {/* PANEL TOUR DETAILS AUTOMÁTICO */}
        <div className="tour-details-panel">
          
{/* LasVegasTour EDITORIAL REVIEW */}
{post.editorialRating && post.editorialReview && (
            <div style={{
              padding: '20px',
              borderTop: '1px solid #f1f3f4',
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                background: '#f0f7ff',
                borderRadius: '12px',
                border: '1px solid #d0e3ff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px', fontWeight: 700, color: '#1a73e8' }}>
                    {post.editorialRating}
                  </span>
                  <div>
                    <span style={{ fontSize: '14px', letterSpacing: '2px' }}>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const fill = Math.min(1, Math.max(0, post.editorialRating! - (star - 1)));
                        return (
                          <span key={star} style={{
                            position: 'relative',
                            display: 'inline-block',
                            color: '#e0e0e0'
                          }}>
                            ★
                            <span style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              overflow: 'hidden',
                              width: `${fill * 100}%`,
                              color: '#f5a623'
                            }}>★</span>
                          </span>
                        );
                      })}
                    </span>
                    <span style={{ fontSize: '11px', color: '#5f6368', display: 'block', marginTop: '2px' }}>
                      LasVegasTour Rating
                    </span>
                  </div>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: '#3c4043',
                  lineHeight: '1.6',
                  margin: 0,
                  fontStyle: 'italic'
                }}>
                  &ldquo;{post.editorialReview}&rdquo;
                </p>
                <div style={{
                  fontSize: '11px',
                  color: '#80868b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>By LasVegasTour Editorial Team</span>
                  {post.editorialDate && (
                    <span>{new Date(post.editorialDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* RATING AL FINAL DE TOUR DETAILS */}
          {post.getYourGuideData?.rating && (
            <div style={{ 
              padding: '20px',
              borderTop: '1px solid #f1f3f4',
              background: '#f8f9fa',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <RatingDisplay
                rating={post.getYourGuideData.rating}
                reviewCount={post.getYourGuideData.reviewCount}
                size="medium"
                sourceUrl={post.bookingUrl || post.getYourGuideUrl}
              />
              <p style={{ 
                fontSize: '12px', 
                color: '#6b7280',
                margin: 0,
                textAlign: 'center'
              }}>
                Verified reviews from GetYourGuide
              </p>
            </div>
          )}
        </div>

        
{/* FAQs Section */}
{post.faqs && post.faqs.length > 0 && (
          <div style={{ padding: '0 20px', marginBottom: '25px' }}>
            <h2 style={{
              fontSize: '1.3rem',
              fontWeight: '700',
              marginBottom: '16px',
              color: '#202124'
            }}>
              ❓ Frequently Asked Questions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {post.faqs.map((faq: any, index: number) => (
                <details
                  key={index}
                  style={{ borderBottom: '1px solid #e0e0e0' }}
                  {...(index === 0 ? { open: true } : {})}
                >
                  <summary style={{
                    padding: '14px 0',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    color: '#202124',
                    listStyle: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    {faq.question}
                    <span style={{ fontSize: '16px', color: '#999', marginLeft: '10px' }}>▾</span>
                  </summary>
                  <p style={{
                    padding: '0 0 14px 0',
                    margin: 0,
                    fontSize: '0.9rem',
                    color: '#555',
                    lineHeight: '1.6'
                  }}>
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}

        {relatedTours && relatedTours.length > 0 && (
          <div style={{ padding: '0 20px', marginBottom: '25px' }}>
            <TourComparisonTable currentTour={post} relatedTours={relatedTours} />
          </div>
        )}

        <HubChips tourTitle={post.title} tourFeatures={post.tourFeatures} />

        {/* RECOMMENDED TOURS */}
        {recommendedTours && recommendedTours.length > 0 && (
          <RecommendedTours 
            tours={recommendedTours
              .filter(tour => {
                const hasImage = getBestImage(tour);
                return hasImage && (hasImage.asset?.url || hasImage.asset?._ref);
              })
              .map(tour => ({
                ...tour,
                mainImage: tour.mainImage?.asset?.url ? {
                  ...tour.mainImage,
                  asset: { url: tour.mainImage.asset.url }
                } : undefined,
                heroGallery: tour.heroGallery?.filter(img => img.asset?.url).map(img => ({
                  ...img,
                  asset: { url: img.asset.url! }
                }))
              }))
            }
            initialCount={4}    
            loadMoreCount={3}   
          />
        )}
      </div>

      {/* CTA FLOTANTE */}
      <div className="mobile-floating-cta">
        <a 
          href={post.bookingUrl || post.getYourGuideUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-button"
        >
          <span className="cta-text">Check Availability</span>
          <span className="cta-arrow">→</span>
        </a>
      </div>

      {/* CSS */}
      <style jsx>{`
        .mobile-tour-page {
          width: 100%;
          min-height: 100vh;
          background: #fff;
          padding-bottom: 20px;
        }

        .mobile-tour-header {
          padding: 20px 20px 15px 20px;
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
        }

        .mobile-tour-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #e91e63;
          margin: 0 0 12px 0;
          line-height: 1.3;
          text-align: center;
        }

        .mobile-breadcrumbs {
          margin-top: 8px;
        }

        .mobile-breadcrumbs :global(.breadcrumb-link),
        .mobile-breadcrumbs :global(span) {
          font-size: 12px !important;
          opacity: 0.7 !important;
        }

        .mobile-breadcrumbs :global(span[style*="font-size: 1rem"]) {
          font-size: 14px !important;
        }

        .mobile-breadcrumbs :global(div[style*="display: flex"]) {
          gap: 3px !important;
        }

        .mobile-hero-carousel {
          position: relative;
          width: 100%;
          margin-bottom: 25px;
        }

        .carousel-container {
          position: relative;
          width: 100%;
          height: 280px;
          overflow: hidden;
        }

        .carousel-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.5);
          color: white;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .carousel-btn:active {
          transform: translateY(-50%) scale(0.95);
        }

        .carousel-prev {
          left: 15px;
        }

        .carousel-next {
          right: 15px;
        }

        .carousel-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          padding: 0 20px;
        }

        .carousel-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          background: #ccc;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .carousel-dot.active {
          background: #e91e63;
          transform: scale(1.2);
        }

        .mobile-tour-content {
          padding: 0 20px;
        }

        .mobile-tour-body {
          margin-bottom: 25px;
        }

        .tour-details-panel {
          background: #fff;
          border: 1px solid #e8eaed;
          border-radius: 16px;
          margin-bottom: 25px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .details-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 20px;
          background: #f8f9fa;
          color: #5f6368;
          border-bottom: 1px solid #e8eaed;
        }

        .details-icon {
          font-size: 18px;
        }

        .details-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0;
        }

        .details-grid {
          padding: 0;
        }

        .detail-item {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          padding: 16px 20px;
          border-bottom: 1px solid #f1f3f4;
          transition: background-color 0.2s ease;
        }

        .detail-item:last-child {
          border-bottom: none;
        }

        .detail-item:hover {
          background-color: #f8f9fa;
        }

        .detail-icon {
          font-size: 24px;
          width: 24px;
          text-align: center;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .detail-content {
          flex: 1;
        }

        .detail-label {
          font-size: 15px;
          color: #5f6368;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .detail-value {
          font-size: 17px;
          color: #202124;
          font-weight: 600;
          line-height: 1.3;
        }

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

        @media (max-width: 480px) {
          .mobile-tour-header {
            padding: 15px 15px 10px 15px;
          }
          
          .mobile-tour-title {
            font-size: 1.2rem;
          }
          
          .mobile-tour-content {
            padding: 0 15px;
          }
          
          .carousel-container {
            height: 250px;
          }
        }
      `}</style>
    </div>
  );
}

// Update 2025-01-17