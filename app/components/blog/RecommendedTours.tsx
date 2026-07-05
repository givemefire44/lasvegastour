'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useMemo } from 'react';
import { urlFor } from '@/sanity/lib/image';
import { proTips } from '@/app/utils/proTips';
import TourFinderBanner from '@/app/components/TourFinderBanner';
import { rankTours } from '@/lib/rankTours';

interface RecommendedToursProps {
  tours: Array<{
    _id: string;
    title: string;
    slug: { current: string };
    mainImage?: {
      asset: { url: string };
      alt?: string;
    };
    heroGallery?: Array<{
      asset: { url: string };
      alt?: string;
    }>;
    body: any;
  }>;
  initialCount?: number; // Cantidad inicial a mostrar
  loadMoreCount?: number; // Cantidad a cargar en cada "Load More"
}

// Función para extraer texto plano del body de Sanity
function extractDescription(body: any): string {
  if (!body || !Array.isArray(body)) return '';

  for (const block of body) {
    if (block._type === 'block' && block.children) {
      const text = block.children
        .filter((child: any) => child._type === 'span')
        .map((child: any) => child.text)
        .join('');

      if (text.trim()) {
        return text.length > 150 ? text.substring(0, 150) + '...' : text;
      }
    }
  }
  return 'Discover this Las Vegas tour...';
}

// Función para obtener la mejor imagen disponible
function getBestImage(tour: RecommendedToursProps['tours'][0]) {
  // PRIMERO: Buscar en heroGallery
  if (tour.heroGallery?.[0]?.asset?.url) {
    return tour.heroGallery[0];
  }
  // SEGUNDO: Fallback a mainImage
  if (tour.mainImage?.asset?.url) {
    return tour.mainImage;
  }
  return null;
}

export default function RecommendedTours({ 
  tours, 
  initialCount = 12,     // 🎯 Mostrar 6 inicialmente
  loadMoreCount = 12     // 🚀 Cargar 4 más cada vez
}: RecommendedToursProps) {
  
  // 📊 ESTADO PARA LOAD MORE
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  // 🚀 FUNCIÓN LOAD MORE CON SMOOTH UX - ✅ CORREGIDA
  const handleLoadMore = useCallback(async () => {
    setIsLoading(true);
    
    // 🎭 Simular loading para UX (opcional - puedes quitar si no querés delay)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // ✅ LÍNEA CORREGIDA - Sin Math.min para permitir load more infinito
    setVisibleCount(prev => prev + loadMoreCount);
    setIsLoading(false);
  }, [loadMoreCount]);

 // 🏆 RANKING: helis arriba, después Grand Canyon, después el resto (por calidad)
 const rankedTours = useMemo(() => rankTours(tours), [tours]);

 // 📊 CALCULAR ESTADO
 const visibleTours = rankedTours.slice(0, visibleCount);
 const hasMoreTours = visibleCount < rankedTours.length;
 const remainingCount = rankedTours.length - visibleCount;

  if (!tours || tours.length === 0) {
    return null;
  }

  return (
    <>
      <section className="recommended-tours-section">
        <div className="recommended-tours-container">
        <TourFinderBanner />
          <h2 className="recommended-tours-title">
            Our most recommended Las Vegas Tours
          </h2>

          {/* 🎯 TOURS GRID */}
          <div className="recommended-tours-grid">
            {visibleTours.map((tour, index) => {
              const image = getBestImage(tour);
              const description = extractDescription(tour.body);
              
              // 🎭 ANIMACIÓN STAGGER PARA NUEVOS ITEMS
              const isNewlyLoaded = index >= visibleCount - loadMoreCount;

              return (
                <div 
                  key={tour._id} 
                  className={`recommended-tour-item ${isNewlyLoaded ? 'newly-loaded' : ''}`}
                  style={{
                    // 🎨 STAGGER ANIMATION DELAY
                    animationDelay: isNewlyLoaded ? `${(index - (visibleCount - loadMoreCount)) * 100}ms` : '0ms'
                  }}
                >
                  <Link href={`/tour/${tour.slug.current}`} className="recommended-tour-link">

                    {/* IMAGEN IZQUIERDA - 🚀 OPTIMIZADA */}
                    <div className="recommended-tour-image">
                      {image ? (
                        <Image
                          src={urlFor(image)
                            .width(480)
                            .height(440)
                            .format('webp')
                            .quality(80)
                            .fit('crop')
                            .url()}
                          alt={image.alt || tour.title}
                          fill
                          sizes="(max-width: 768px) 170px, 240px"
                          loading={index < initialCount ? "eager" : "lazy"} // 🚀 Eager para iniciales
                          placeholder="blur"
                          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                        />
                      ) : (
                        <div className="recommended-tour-placeholder">
                          📍
                        </div>
                      )}
                    </div>

                    {/* CONTENIDO DERECHA */}
                    <div className="recommended-tour-content">
                      {/* TÍTULO */}
                      <h3 className="recommended-tour-title">{tour.title}</h3>

                      {/* DESCRIPCIÓN */}
                      <p className="recommended-tour-description">
                        {description}
                      </p>

                      {/* BOTÓN SEE MORE */}
                      <div className="recommended-tour-action">
                        <span className="see-more-link">See more</span>
                      </div>
                    </div>

                  </Link>
                </div>
              );
            })}
          </div>

          {/* 🚀 LOAD MORE BUTTON */}
          {hasMoreTours && (
            <div className="load-more-container">
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className={`load-more-button ${isLoading ? 'loading' : ''}`}
              >
                {isLoading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Loading...
                  </>
                ) : (
                  'Show More Tours'
                )}
              </button>
            </div>
          )}

          {/* 🎉 REMOVED: ALL LOADED MESSAGE - QUEDA MÁS LIMPIO */}
          {/* Cuando no hay más tours, simplemente no se muestra nada */}

        </div>
      </section>

      {/* 🔧 PRO TIPS SECTION - CLICKS ARREGLADOS */}
      <section className="pro-tips-section">
        <div className="pro-tips-container">
          <div className="pro-tips-grid">
            {proTips.map((tip, index) => (
              tip.slug ? (
                <Link 
                  key={index} 
                  href={`/${tip.slug}`} 
                  className="pro-tip-chip pro-tip-link"
                >
                  <span className="pro-tip-icon">{tip.icon}</span>
                  <span className="pro-tip-text">{tip.text}</span>
                </Link>
              ) : (
                <div key={index} className="pro-tip-chip">
                  <span className="pro-tip-icon">{tip.icon}</span>
                  <span className="pro-tip-text">{tip.text}</span>
                </div>
              )
            ))}
          </div>
        </div>
      </section>

      {/* 🎨 ESTILOS PARA LOAD MORE Y PRO TIPS */}
      <style jsx>{`
        /* 🚀 LOAD MORE STYLES - EXACTO COMO "SEE MORE" */
        .load-more-container {
          display: flex !important; /* 🔧 FORZAR DISPLAY */
          justify-content: center;
          margin: 2rem 0 2rem 0; /* 🎯 ARMONIZAR ESPACIADO - IGUAL ARRIBA Y ABAJO */
          position: relative; /* 🎯 ASEGURAR POSICIONAMIENTO */
          z-index: 10; /* 🛡️ EVITAR OVERLAPS */
        }

        /* 🎨 LÍNEA DECORATIVA SÚPER PROFESIONAL */
        .load-more-container::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(to right, 
            transparent 0%, 
            rgba(233, 30, 99, 0.2) 20%, 
            rgba(233, 30, 99, 0.3) 50%, 
            rgba(233, 30, 99, 0.2) 80%, 
            transparent 100%
          );
          z-index: -1;
        }

        .load-more-button {
          background: white;
          color: #e91e63;
          border: 2px solid #e91e63;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          position: relative; /* 🎯 PARA QUE ESTÉ SOBRE LA LÍNEA */
          z-index: 1;
        }

        .load-more-button:hover:not(:disabled) {
          background: #e91e63;
          color: white;
        }

        .load-more-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* 🎭 LOADING SPINNER - COLOR ROSA */
        .loading-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(233, 30, 99, 0.2);
          border-top: 2px solid #e91e63;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* 🎨 NEWLY LOADED ANIMATION */
        .newly-loaded {
          animation: slideInUp 0.6s ease-out forwards;
          opacity: 0;
          transform: translateY(20px);
        }

        @keyframes slideInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 🔧 FIX PARA PRO TIPS CLICKS */
        .pro-tip-link {
          display: flex !important;
          align-items: center !important;
          text-decoration: none !important;
          color: inherit !important;
          gap: 12px !important;
        }

        .pro-tip-link:hover .pro-tip-text {
          color: #e11d48 !important;
        }

        /* 📱 RESPONSIVE */
        @media (max-width: 768px) {
          .load-more-button {
            padding: 0.45rem 0.875rem;
            font-size: 0.8rem;
          }
          
          .load-more-container {
            margin: 1.5rem 0 1rem 0;
          }
        }
        `}</style>
    </>
  );
}