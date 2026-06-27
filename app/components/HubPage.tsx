'use client';

import Link from 'next/link';
import Image from 'next/image';
import { urlFor } from '@/sanity/lib/image';
import Container from '@/app/components/Container';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import Footer from '@/app/components/Footer';
import RecommendedTours from '@/app/components/blog/RecommendedTours';
import hubRelatedArticles from '@/data/hubRelatedArticles.json';


interface TourHub {
  slug: string;
  title: string;
  shortTitle: string;
  destination: string;
  matchKeywords: string[];
  matchFeatures: Record<string, boolean>;
  icon: string;
  type: string;
}

interface Tour {
  _id: string;
  title: string;
  slug: { current: string };
  seoDescription?: string;
  heroGallery?: any[];
  seoImage?: any;
  tourInfo?: { duration?: string; price?: number; currency?: string };
  tourFeatures?: { skipTheLine?: boolean; smallGroupAvailable?: boolean; freeCancellation?: boolean };
  getYourGuideData?: { rating?: number; reviewCount?: number; provider?: string };
  editorialRating?: number;
  editorialReview?: string;
  bookingUrl?: string;
}

interface HubContent {
  quickAnswer: {
    hook: string;
    range: string;
    bestPick: { name: string; rating: number; price: number; duration: string; highlight: string };
    verdict: string;
  };
  methodology: string;
  intro: { whyItMatters: string; whatOptions: string; sweetSpot: string; howToChoose: string };
  pricingTiers: { range: string; label: string }[];
  decisionBox: { title: string; bullets: string[] };
  internalLinks: { text: string; slug: string }[];
  seoTitle: string;
  seoDescription: string;
  faqs: { question: string; answer: string }[];
}

interface HubPageProps {
  hub: TourHub;
  tours: Tour[];
  content: HubContent | null;
  allHubs: TourHub[];
  recommendedTours?: any[];
}

function getBestImage(tour: Tour) {
  if (tour.heroGallery?.[0]?.asset?.url) return tour.heroGallery[0];
  if (tour.seoImage?.asset?.url) return tour.seoImage;
  return null;
}

export default function HubPage({ hub, tours, content, allHubs, recommendedTours }: HubPageProps) {
  const sortedTours = [...tours].sort((a, b) => {
    const ratingA = a.editorialRating || a.getYourGuideData?.rating || 0;
    const ratingB = b.editorialRating || b.getYourGuideData?.rating || 0;
    return ratingB - ratingA;
  });

  const topTours = sortedTours.slice(0, 3);
  const prices = tours.filter(t => t.tourInfo?.price).map(t => t.tourInfo!.price!).sort((a, b) => a - b);
  const minPrice = prices.length ? Math.floor(prices[0]) : null;
  // Descartar dislates (bodas en heli, charters VIP): un precio > 8× la mediana del hub no define el techo.
  const _median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
  const _sane = prices.filter(p => p <= _median * 8);
  const maxPrice = _sane.length ? Math.round(_sane[_sane.length - 1]) : (prices.length ? Math.round(prices[prices.length - 1]) : null);
  const qa = content?.quickAnswer;
  const intro = content?.intro;
  const faqs = content?.faqs || [];
  const relatedGuides = (hubRelatedArticles as Record<string, { slug: string; text: string }[]>)[hub.slug] || [];

  return (
    <>
      <Container>
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: '#1a1a1a',
          lineHeight: '1.1'
        }}>
          {hub.icon} {hub.title}
        </h1>

        <Breadcrumbs noSchema={true} items={[
          { label: 'Home', href: '/' },
          { label: hub.shortTitle, isActive: true }
        ]} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>🎫</span>
          <span style={{
            fontSize: '1.1rem',
            color: '#666',
            lineHeight: '1.6'
          }}>
            {tours.length} tours available{minPrice && maxPrice ? ` · From $${minPrice} to $${maxPrice}` : ''}
          </span>
        </div>
      </Container>

      {/* Quick Answer */}
      {qa && (
        <Container>
          <div style={{
            background: '#1e3a5f',
            border: '1px solid #16304f',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '2rem'
          }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '12px', color: '#f4c95d' }}>
              💡 Quick Answer
            </h2>
            <p style={{ fontSize: '1.05rem', color: '#ffffff', lineHeight: '1.7', marginBottom: '12px' }}>
              <strong>{qa.hook}</strong> {qa.range}
            </p>
            {qa.bestPick && (
              <div style={{
                background: '#fff',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '14px 18px',
                marginBottom: '12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '1.2rem' }}>🏆</span>
                <div>
                  <strong style={{ color: '#333' }}>{qa.bestPick.name}</strong>
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                    ⭐ {qa.bestPick.rating}/5 · 💰 ${qa.bestPick.price} · 🕒 {qa.bestPick.duration} · {qa.bestPick.highlight}
                  </div>
                </div>
              </div>
            )}
            <p style={{ fontSize: '0.95rem', color: '#e8eef5', fontStyle: 'italic' }}>{qa.verdict}</p>
          </div>
        </Container>
      )}

      {/* Methodology */}
      {content?.methodology && (
        <Container>
          <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '1.5rem', fontStyle: 'italic' }}>
            📋 {content.methodology}
          </p>
        </Container>
      )}

      {/* Top Picks */}
      {topTours.length > 0 && (
        <Container>
          <div style={{ padding: '40px 0' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '40px', color: '#333' }}>
              🏆 Top {hub.shortTitle}
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
              gap: '20px'
            }}>
              {topTours.map((tour, i) => {
                const image = getBestImage(tour);
                return (
                  <div key={tour._id} style={{
                    background: '#fff', borderRadius: '12px', overflow: 'hidden',
                    boxShadow: '0 2px 15px rgba(0,0,0,0.08)', cursor: 'pointer',
                    minWidth: '260px', maxWidth: '300px', justifySelf: 'center',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute', top: '10px', left: '10px', zIndex: 2,
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '14px', color: '#fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {i + 1}
                    </div>
                    <a href={`/tour/${tour.slug.current}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ position: 'relative', height: '160px' }}>
                        {image ? (
                          <Image
                            src={urlFor(image).width(350).height(160).format('webp').quality(80).fit('crop').url()}
                            alt={image.alt || tour.title} fill style={{ objectFit: 'cover' }}
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            loading="lazy"
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem' }}>🏜️</div>
                        )}
                      </div>
                      <div style={{ padding: '16px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px', color: '#333', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.6rem' }}>{tour.title}</h3>
                        {tour.getYourGuideData?.rating && (
                          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {[...Array(5)].map((_, i) => (
                                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < Math.floor(tour.getYourGuideData!.rating!) ? '#FBBF24' : '#E5E7EB'}><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                              ))}
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#333' }}>{tour.getYourGuideData.rating.toFixed(1)}</span>
                            {tour.getYourGuideData.reviewCount ? <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({tour.getYourGuideData.reviewCount})</span> : null}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {tour.tourFeatures?.skipTheLine && <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', background: '#dcfce7', color: '#f4c95d', fontWeight: '600', whiteSpace: 'nowrap' }}>⚡ Skip the line</span>}
                          {tour.tourFeatures?.smallGroupAvailable && <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', background: '#dbeafe', color: '#2563eb', fontWeight: '600', whiteSpace: 'nowrap' }}>👥 Small group</span>}
                          {tour.tourFeatures?.freeCancellation && <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', fontWeight: '600', whiteSpace: 'nowrap' }}>🔄 Free cancel</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {tour.tourInfo?.duration && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '0.8rem' }}><span>🕒</span><span>{tour.tourInfo.duration}</span></div>}
                          {tour.tourInfo?.price && <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#e91e63' }}>{tour.tourInfo.currency === 'EUR' ? '€' : '$'}{tour.tourInfo.price}</div>}
                        </div>
                      </div>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      )}

      {/* Intro - 4 micro blocks with autolinks */}
      {intro && (
        <Container>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
            gap: '16px',
            marginBottom: '2.5rem'
          }}>
            <div style={{ padding: '18px', background: '#1e3a5f', borderRadius: '12px', border: '1px solid #16304f' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: '#f4c95d' }}>🎯 Why it matters</h3>
              <p style={{ fontSize: '0.9rem', color: '#ffffff', lineHeight: '1.65', fontWeight: '500' }}>{intro.whyItMatters}</p>
            </div>
            <div style={{ padding: '18px', background: '#E8EDF3', borderRadius: '12px', border: '1px solid #d4dde8' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: '#1e3a5f' }}>📊 Your options</h3>
              <p style={{ fontSize: '0.9rem', color: '#1a2b3c', lineHeight: '1.65', fontWeight: '500' }}>{intro.whatOptions}</p>
            </div>
            <div style={{ padding: '18px', background: '#1e3a5f', borderRadius: '12px', border: '1px solid #16304f' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: '#f4c95d' }}>💎 Sweet spot</h3>
              <p style={{ fontSize: '0.9rem', color: '#ffffff', lineHeight: '1.65', fontWeight: '500' }}>{intro.sweetSpot}</p>
            </div>
            <div style={{ padding: '18px', background: '#E8EDF3', borderRadius: '12px', border: '1px solid #d4dde8' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '8px', color: '#1e3a5f' }}>🧭 How to choose</h3>
              <p style={{ fontSize: '0.9rem', color: '#1a2b3c', lineHeight: '1.65', fontWeight: '500' }}>{intro.howToChoose}</p>
            </div>
          </div>
        </Container>
      )}

      {/* Pricing Tiers + Decision Box side by side */}
      {(content?.pricingTiers || content?.decisionBox) && (
        <Container>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: '20px',
            marginBottom: '2.5rem'
          }}>
            {content?.pricingTiers && content.pricingTiers.length > 0 && (
              <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '14px', color: '#333' }}>💰 Pricing Guide</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {content.pricingTiers.map((tier, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
                      <span style={{ fontWeight: '700', color: '#e91e63', minWidth: '90px', fontSize: '0.9rem' }}>{tier.range}</span>
                      <span style={{ fontSize: '0.85rem', color: '#555' }}>{tier.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {content?.decisionBox && (
              <div style={{ padding: '20px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '14px', color: '#92400e' }}>🎯 {content.decisionBox.title}</h3>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {content.decisionBox.bullets.map((bullet, i) => (
                    <li key={i} style={{ fontSize: '0.95rem', color: '#555', lineHeight: '1.8' }}>{bullet}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Container>
      )}

      {/* All Tours */}
      {sortedTours.length > 3 && (
        <Container>
          <div style={{ padding: '40px 0' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '40px', color: '#333' }}>
              All {hub.shortTitle}
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
              gap: '20px'
            }}>
              {sortedTours.map((tour) => {
                const image = getBestImage(tour);
                return (
                  <div key={tour._id} style={{
                    background: '#fff', borderRadius: '12px', overflow: 'hidden',
                    boxShadow: '0 2px 15px rgba(0,0,0,0.08)', cursor: 'pointer',
                    minWidth: '260px', maxWidth: '300px', justifySelf: 'center'
                  }}>
                    <a href={`/tour/${tour.slug.current}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ position: 'relative', height: '160px' }}>
                        {image ? (
                          <Image
                            src={urlFor(image).width(350).height(160).format('webp').quality(80).fit('crop').url()}
                            alt={image.alt || tour.title} fill style={{ objectFit: 'cover' }}
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            loading="lazy"
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem' }}>🏛️</div>
                        )}
                      </div>
                      <div style={{ padding: '16px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px', color: '#333', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.6rem' }}>{tour.title}</h3>
                        {tour.getYourGuideData?.rating && (
                          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {[...Array(5)].map((_, i) => (
                                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < Math.floor(tour.getYourGuideData!.rating!) ? '#FBBF24' : '#E5E7EB'}><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                              ))}
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#333' }}>{tour.getYourGuideData.rating.toFixed(1)}</span>
                            {tour.getYourGuideData.reviewCount ? <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>({tour.getYourGuideData.reviewCount})</span> : null}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {tour.tourFeatures?.skipTheLine && <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', background: '#dcfce7', color: '#f4c95d', fontWeight: '600', whiteSpace: 'nowrap' }}>⚡ Skip the line</span>}
                          {tour.tourFeatures?.smallGroupAvailable && <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', background: '#dbeafe', color: '#2563eb', fontWeight: '600', whiteSpace: 'nowrap' }}>👥 Small group</span>}
                          {tour.tourFeatures?.freeCancellation && <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '12px', background: '#fef3c7', color: '#d97706', fontWeight: '600', whiteSpace: 'nowrap' }}>🔄 Free cancel</span>}
                        </div>
                        {tour.seoDescription && (
                          <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.4', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.4rem' }}>{tour.seoDescription.substring(0, 80)}...</p>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {tour.tourInfo?.duration && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#666', fontSize: '0.8rem' }}><span>🕒</span><span>{tour.tourInfo.duration}</span></div>}
                          {tour.tourInfo?.price && <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#e91e63' }}>{tour.tourInfo.currency === 'EUR' ? '€' : '$'}{tour.tourInfo.price}</div>}
                        </div>
                      </div>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      )}

      {/* Related guides (articles) */}
      {relatedGuides.length > 0 && (
        <Container>
          <div style={{ margin: '2.5rem 0', padding: '24px 28px', background: 'linear-gradient(135deg, #fff5f8 0%, #fbfbfb 100%)', borderRadius: '16px', border: '1px solid #f3d4de' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span aria-hidden="true">📚</span> Related guides
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
              {relatedGuides.map((a, i) => (
                <Link key={i} href={`/${a.slug}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #efe2e8', color: '#c2185b', fontSize: '0.92rem', fontWeight: 500, textDecoration: 'none', lineHeight: 1.35 }}>
                  <span style={{ color: '#e91e63', fontWeight: 700 }} aria-hidden="true">→</span>
                  <span>{a.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </Container>
      )}

      {/* FAQs with autolinks */}
      {faqs.length > 0 && (
        <Container>
          <div style={{ padding: '40px 0' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '30px', color: '#333' }}>
              ❓ Frequently Asked Questions
            </h2>
            {faqs.map((faq, i) => (
              <details key={i} style={{ borderBottom: '1px solid #eee', padding: '18px 0' }}>
                <summary style={{ fontWeight: '600', fontSize: '1.05rem', cursor: 'pointer', color: '#333' }}>{faq.question}</summary>
                <p style={{ marginTop: '12px', fontSize: '0.95rem', color: '#555', lineHeight: '1.7' }}>{faq.answer}</p>
              </details>
            ))}
          </div>
        </Container>
      )}

      {/* Cross-links */}
      <Container>
        <div style={{ padding: '30px 0' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '20px', color: '#333' }}>
          🗺️ Browse Las Vegas Tours
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {allHubs.map(h => (
              <Link key={h.slug} href={`/${h.slug}`} style={{
                padding: '8px 16px',
                backgroundColor: h.slug === hub.slug ? '#e91e63' : '#f5f5f5',
                color: h.slug === hub.slug ? '#fff' : '#333',
                borderRadius: '20px', fontSize: '0.9rem', fontWeight: '500',
                textDecoration: 'none', border: '1px solid #e9ecef'
              }}>{h.icon} {h.shortTitle}</Link>
            ))}
          </div>
        </div>
      </Container>

      {/* Recommended Tours */}
      {recommendedTours && recommendedTours.length > 0 && (
        <Container>
          <section id="recommended" style={{ marginTop: '40px', marginBottom: '40px' }}>
            <RecommendedTours tours={recommendedTours} />
          </section>
        </Container>
      )}

      <Footer />
    </>
  );
}
