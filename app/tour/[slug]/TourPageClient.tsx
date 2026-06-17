'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { urlFor } from '@/sanity/lib/image';
import Container from '../../components/Container';
import Footer from '../../components/Footer';
import SanityContent from '../../components/blog/SanityContent';
import HeroGallery from '../../components/blog/HeroGallery';
import RelatedTours from '../../components/blog/RelatedTours';
import TourComparisonTable from '@/app/components/blog/TourComparisonTable';
import TourNavigation from '../../components/blog/TourNavigation';
import RecommendedTours from '../../components/blog/RecommendedTours';
import MobileTourPage from '../../components/MobileTourPage';
import Breadcrumbs from '../../components/Breadcrumbs';
import RatingDisplay from '../../components/RatingDisplay';
import HubChips from '@/app/components/HubChips';



interface TourPageClientProps {
  post: any;
  relatedPosts: any[];
  recommendedPosts: any[];
}

// ========================================
// MAIN COMPONENT
// ========================================
export default function TourPageClient({ 
  post, 
  relatedPosts, 
  recommendedPosts 
}: TourPageClientProps) {
  // FIX: Default to 'desktop' so SSR renders full content for bots/crawlers
  // Before: useState(null) → skeleton with "Loading..." → bots see nothing
  // After: useState('desktop') → full content in SSR → bots see everything
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('desktop');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Detectar viewport
    const checkViewport = () => {
      setViewport(window.innerWidth <= 768 ? 'mobile' : 'desktop');
    };
    
    // Ejecutar inmediatamente
    checkViewport();
    
    // Escuchar cambios (rotación de dispositivo, resize)
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Scroll to top cuando cambia el post (navegación interna)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [post?.slug?.current]);

  // ========================================
  // MOBILE VERSION (only after client-side detection)
  // ========================================
  if (isClient && viewport === 'mobile') {
    return (
      <>
        <MobileTourPage 
          post={post} 
          recommendedTours={recommendedPosts}
          relatedTours={relatedPosts}
        />
        <Footer />
      </>
    );
  }

  // ========================================
  // DESKTOP VERSION (default for SSR + desktop clients)
  // This is what bots and crawlers will see - FULL CONTENT
  // ========================================
  return (
    <>
      <Container>
        <h1 className="tour-title">
          {post.title}
        </h1>
        
        {/* Rating + Provider en header */}
        <div style={{ margin: '12px 0 16px 0', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {post.getYourGuideData?.rating && (
            <RatingDisplay
              rating={post.getYourGuideData.rating}
              reviewCount={post.getYourGuideData.reviewCount}
              size="medium"
              sourceUrl={post.bookingUrl || post.getYourGuideUrl}
            />
          )}
          {post.getYourGuideData?.provider && (
            <span style={{ 
              fontSize: '14px', 
              color: '#5f6368',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ color: '#999' }}>•</span>
              <span>Provided by:</span>
              <span style={{ fontWeight: '600', color: '#e91e63' }}>{post.getYourGuideData.provider}</span>
            </span>
          )}
        </div>
        
        <Breadcrumbs items={[
  { label: 'Home', href: '/' },
  { 
    label: 'Colosseum Tours', 
    href: '/tours/colosseum' 
  },
  { label: post.title, isActive: true }
]} />
      </Container>

      <Container>
        <HeroGallery post={post} />
      </Container>

      <TourNavigation tourTitle={post.title} />

      <Container>
        <div className="tour-layout" style={{
          display: 'grid',
          gridTemplateColumns: '2fr 300px',
          gap: '40px',
          alignItems: 'start',
          marginBottom: '60px',
          maxWidth: '1150px',
          margin: '0 auto'
        }}>
          
          <div className="tour-content" style={{
            minWidth: 0,
            maxWidth: '100%',
            paddingRight: '20px'
          }}>
            
            <section id="description">
            <SanityContent post={post} relatedTours={relatedPosts} />
            </section>
            

            {/* Editorial Review */}
            {post.editorialRating && post.editorialReview && (
              <section style={{ marginTop: '40px', marginBottom: '40px' }}>
                <div className="desktop-tour-details-panel">
                  <div className="desktop-details-header">
                    <span className="desktop-details-icon">📝</span>
                    <h3 className="desktop-details-title">LasVegasTour Editorial Review</h3>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    padding: '20px',
                    background: '#f0f7ff',
                    borderRadius: '12px',
                    border: '1px solid #d0e3ff'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '32px', fontWeight: 700, color: '#1a73e8' }}>
                        {post.editorialRating}
                      </span>
                      <div>
                        <span style={{ fontSize: '16px', letterSpacing: '2px' }}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const fill = Math.min(1, Math.max(0, post.editorialRating - (star - 1)));
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
                        <span style={{ fontSize: '12px', color: '#5f6368', display: 'block', marginTop: '2px' }}>
                          LasVegasTour Rating
                        </span>
                      </div>
                    </div>

                    <p style={{
                      fontSize: '15px',
                      color: '#3c4043',
                      lineHeight: '1.6',
                      margin: 0,
                      fontStyle: 'italic'
                    }}>
                      &ldquo;{post.editorialReview}&rdquo;
                    </p>

                    <div style={{
                      fontSize: '12px',
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
              </section>
            )}


            {/* Guest Reviews */}
            {post.getYourGuideData?.rating && (
              <section style={{ marginTop: '40px', marginBottom: '40px' }}>
                <div style={{
                  paddingTop: '30px',
                  borderTop: '2px solid #f1f3f4',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <h4 style={{
                    fontSize: '1.3rem',
                    fontWeight: '600',
                    color: '#202124',
                    marginBottom: '12px',
                    textAlign: 'center'
                  }}>
                    ⭐ Guest Reviews
                  </h4>
                  <RatingDisplay
                    rating={post.getYourGuideData.rating}
                    reviewCount={post.getYourGuideData.reviewCount}
                    size="large"
                    sourceUrl={post.bookingUrl || post.getYourGuideUrl}
                  />
                  <p style={{
                    fontSize: '14px',
                    color: '#5f6368',
                    textAlign: 'center',
                    maxWidth: '500px',
                    lineHeight: '1.6',
                    marginTop: '8px'
                  }}>
                    Verified reviews from travelers who booked this tour through Viator
                  </p>
                </div>
              </section>
            )}

            {/* FAQs */}
            {post.faqs && post.faqs.length > 0 && (
              <section id="faqs" style={{ marginTop: '40px', marginBottom: '40px' }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  marginBottom: '20px',
                  color: '#202124'
                }}>
                  ❓ Frequently Asked Questions
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {post.faqs.map((faq: any, index: number) => (
                    <details
                      key={index}
                      style={{
                        borderBottom: '1px solid #e0e0e0',
                        padding: '0'
                      }}
                      {...(index === 0 ? { open: true } : {})}
                    >
                      <summary style={{
                        padding: '18px 0',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '1.05rem',
                        color: '#202124',
                        listStyle: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        {faq.question}
                        <span style={{ fontSize: '18px', color: '#999', marginLeft: '10px' }}>▾</span>
                      </summary>
                      <p style={{
                        padding: '0 0 18px 0',
                        margin: 0,
                        fontSize: '0.95rem',
                        color: '#555',
                        lineHeight: '1.7'
                      }}>
                        {faq.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Compare Similar Tours */}
            {relatedPosts && relatedPosts.length > 0 && (
              <section style={{ marginTop: '40px', marginBottom: '40px' }}>
                <TourComparisonTable currentTour={post} relatedTours={relatedPosts} />
              </section>
            )}
            <section id="related" style={{ marginTop: '60px', marginBottom: '40px' }}>
              <RelatedTours tours={relatedPosts} />
            </section>

            <section id="hub-tours" style={{ marginTop: '40px', marginBottom: '40px' }}>
              <HubChips tourTitle={post.title} tourFeatures={post.tourFeatures} />
            </section>

            <section id="recommended" style={{ marginTop: '40px', marginBottom: '40px' }}>
              <RecommendedTours tours={recommendedPosts} />
            </section>

            <div id="cancellations" style={{ height: '1px', marginTop: '-120px', paddingTop: '120px' }}></div>
          </div>
          
          <div className="tour-widget" style={{
            position: 'sticky',
            top: '20px',
            width: '300px',
            height: 'fit-content',
            alignSelf: 'start'
          }}>
            <div id="book-now">
              <div style={{
                width: '100%',
                maxWidth: '300px',
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
              }}>
                
                <div style={{ padding: '60px 20px 25px 20px' }}>
                  <a 
                    href={post.bookingUrl || post.getYourGuideUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    Check Availability
                  </a>
                </div>

                <div style={{ padding: '0 20px 25px 20px' }}>
                  <div style={{ 
                    position: 'relative', 
                    width: '100%', 
                    height: '300px', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }} onClick={() => window.open(post.bookingUrl || post.getYourGuideUrl || '#', '_blank')}>
                    <Image
                      src={urlFor(post.heroGallery?.[0] || post.mainImage)
                        .width(300)
                        .height(300)
                        .format('webp')
                        .quality(85)
                        .fit('crop')
                        .url()}
                      alt={post.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="300px"
                      loading="lazy"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                    />
                  </div>
                </div>

                <div style={{ padding: '0px 20px 10px 20px' }}>
                  <a 
                    href={post.bookingUrl || post.getYourGuideUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    Tour Details
                  </a>
                </div>

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
                    <span style={{ marginRight: '8px' }}>⚡</span>
                    <span>Instant Confirmation</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginBottom: '5px' 
                  }}>
                    <span style={{ marginRight: '8px' }}>❌</span>
                    <span>Free Cancelation Option</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ 
              marginTop: '20px',
              padding: '0'
            }}>
              <a 
                href="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 20px',
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: '#333',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  marginBottom: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>🏠</span>
                <span>Back to Home</span>
              </a>
              <a 
                href="/tours"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 20px',
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: '#333',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>🎫</span>
                <span>All Las Vegas Tours</span>
              </a>
            </div>
          </div>
        </div>
      </Container>

      <Footer />

      <style jsx>{`
        .desktop-tour-details-panel {
          margin: 40px 0;
          max-width: 100%;
        }

        .desktop-details-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 2px solid #f1f3f4;
        }

        .desktop-details-icon {
          font-size: 28px;
        }

        .desktop-details-title {
          font-size: 1.4rem;
          font-weight: 600;
          margin: 0;
          color: #202124;
        }

        .desktop-details-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .desktop-detail-item {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          padding: 0;
          margin: 0;
        }

        .desktop-detail-icon {
          font-size: 32px;
          width: 40px;
          text-align: left;
          margin-top: 3px;
          flex-shrink: 0;
        }

        .desktop-detail-content {
          flex: 1;
          padding-top: 2px;
        }

        .desktop-detail-label {
          font-size: 15px;
          color: #5f6368;
          font-weight: 500;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .desktop-detail-value {
          font-size: 17px;
          color: #202124;
          font-weight: 700;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}
