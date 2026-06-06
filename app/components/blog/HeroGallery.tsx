'use client';

import Image from 'next/image';
import { urlFor } from '@/sanity/lib/image';
import { useState, useCallback, useMemo, useEffect } from 'react';

interface HeroGalleryProps {
  post: {
    heroGallery?: Array<{
      asset: { url: string; _type: string };
      alt?: string;
    }>;
    title?: string;
  };
}

export default function HeroGallery({ post }: HeroGalleryProps) {
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const heroImages = useMemo(() => {
    return post.heroGallery?.slice(0, 15).map((img, index) => {
      if (!img.asset?.url) return null;
      try {
        return {
          mainSrc: urlFor(img).width(800).height(600).format('webp').quality(90).fit('crop').url(),
          thumbSrc: urlFor(img).width(120).height(90).format('webp').quality(75).fit('crop').url(),
          placeholder: urlFor(img).width(20).height(15).blur(10).quality(20).format('webp').url(),
          alt: img.alt || `${post.title || 'Tour'} image ${index + 1}`
        };
      } catch { return null; }
    }).filter(Boolean) || [];
  }, [post.heroGallery, post.title]);

  const handleImageError = useCallback((index: number) => {
    setImageLoadErrors(prev => new Set([...prev, index]));
  }, []);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const goNext = useCallback(() => setLightboxIndex(i => (i + 1) % heroImages.length), [heroImages.length]);
  const goPrev = useCallback(() => setLightboxIndex(i => (i - 1 + heroImages.length) % heroImages.length), [heroImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, goNext, goPrev, closeLightbox]);

  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  if (heroImages.length === 0) {
    return <div className="hero-gallery-placeholder"><p>Images loading...</p></div>;
  }

  const mainImage = heroImages[0];
  const gridImages = heroImages.slice(1, 5);
  const totalImages = heroImages.length;

  return (
    <>
      <div className="hero-gallery">
        {/* Main image */}
        <div className="hero-main-wrap">
          <div className="hero-main-image" onClick={() => openLightbox(0)}>
            {!imageLoadErrors.has(0) && (
              <Image
                src={mainImage!.mainSrc}
                alt={mainImage!.alt}
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 100vw, 60vw"
                priority
                placeholder="blur"
                blurDataURL={mainImage!.placeholder}
                onError={() => handleImageError(0)}
              />
            )}
          </div>
          <button className="main-gallery-btn" onClick={() => openLightbox(0)} aria-label="See all photos">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span>{totalImages} photos</span>
          </button>
        </div>

        {/* Grid */}
        {gridImages.length > 0 && (
          <div className="hero-grid">
            {gridImages.map((image, index) => {
              const actualIndex = index + 1;
              return (
                <div key={actualIndex} className="hero-grid-item" onClick={() => openLightbox(actualIndex)}>
                  {!imageLoadErrors.has(actualIndex) && (
                    <Image
                      src={image!.mainSrc}
                      alt={image!.alt}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 50vw, 20vw"
                      loading="lazy"
                      placeholder="blur"
                      blurDataURL={image!.placeholder}
                      onError={() => handleImageError(actualIndex)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div className="lightbox-backdrop" onClick={closeLightbox}>
          <div className="lightbox-container" onClick={e => e.stopPropagation()}>
            <div className="lightbox-topbar">
              <button className="lightbox-close" onClick={closeLightbox}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <span>Exit</span>
              </button>
              <span className="lightbox-counter">{lightboxIndex + 1} / {totalImages}</span>
            </div>
            <div className="lightbox-image-wrap">
              <Image
                key={lightboxIndex}
                src={heroImages[lightboxIndex]!.mainSrc}
                alt={heroImages[lightboxIndex]!.alt}
                fill
                style={{ objectFit: 'contain' }}
                sizes="100vw"
                priority
                placeholder="blur"
                blurDataURL={heroImages[lightboxIndex]!.placeholder}
              />
            </div>
            <button className="lightbox-arrow lightbox-arrow-prev" onClick={goPrev}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <button className="lightbox-arrow lightbox-arrow-next" onClick={goNext}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
            <div className="lightbox-thumbs">
              {heroImages.map((img, i) => (
                <div key={i} className={`lightbox-thumb ${i === lightboxIndex ? 'active' : ''}`} onClick={() => setLightboxIndex(i)}>
                  <Image src={img!.thumbSrc} alt={img!.alt} fill style={{ objectFit: 'cover' }} sizes="100px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .hero-gallery {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 6px;
          height: 420px;
          margin-bottom: 40px;
          border-radius: 14px;
          overflow: hidden;
          cursor: pointer;
        }
        .hero-main-wrap {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .hero-main-image {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          transition: filter 0.2s ease;
        }
        .hero-main-image:hover { filter: brightness(0.92); }
        .main-gallery-btn {
          position: absolute;
          bottom: 20px;
          right: 14px;
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 6px;
         background: rgba(233, 30, 99, 0.85);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 20px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(6px);
          transition: all 0.2s ease;
          z-index: 10;
        }
        .main-gallery-btn:hover { background: rgba(0,0,0,0.65); }
        .hero-grid {
          display: grid;
          grid-template-rows: repeat(2, 1fr);
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          height: 100%;
        }
        .hero-grid-item {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          transition: filter 0.2s ease;
        }
        .hero-grid-item:hover { filter: brightness(0.88); }
        .hero-gallery-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 420px;
          background: #f5f5f5;
          border-radius: 14px;
          margin-bottom: 40px;
          color: #999;
        }
        .lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.96);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lightbox-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .lightbox-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          z-index: 10;
          flex-shrink: 0;
        }
        .lightbox-counter { color: rgba(255,255,255,0.85); font-size: 15px; font-weight: 500; }
        .lightbox-close {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 30px;
          background: rgba(255,255,255,0.15);
          border: 1.5px solid rgba(255,255,255,0.25);
          color: white;
          cursor: pointer;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .lightbox-close:hover { background: rgba(255,255,255,0.25); transform: scale(1.04); }
        .lightbox-image-wrap { position: relative; flex: 1; min-height: 0; }
        .lightbox-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(255,255,255,0.12);
          border: 1.5px solid rgba(255,255,255,0.22);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: all 0.2s ease;
        }
        .lightbox-arrow:hover { background: rgba(255,255,255,0.24); transform: translateY(-50%) scale(1.08); }
        .lightbox-arrow-prev { left: 16px; }
        .lightbox-arrow-next { right: 16px; }
        .lightbox-thumbs {
          display: flex;
          gap: 6px;
          padding: 14px 20px;
          overflow-x: auto;
          flex-shrink: 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.3) transparent;
        }
        .lightbox-thumbs::-webkit-scrollbar { height: 4px; }
        .lightbox-thumbs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 2px; }
        .lightbox-thumb {
          position: relative;
          width: 80px;
          height: 56px;
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
          cursor: pointer;
          border: 2px solid transparent;
          opacity: 0.6;
          transition: all 0.2s ease;
        }
        .lightbox-thumb:hover { opacity: 0.85; }
        .lightbox-thumb.active { border-color: white; opacity: 1; }
        @media (max-width: 768px) {
          .hero-gallery { grid-template-columns: 1fr; height: 280px; }
          .hero-grid { display: none; }
          .lightbox-arrow { width: 42px; height: 42px; }
          .lightbox-arrow-prev { left: 8px; }
          .lightbox-arrow-next { right: 8px; }
          .lightbox-thumb { width: 60px; height: 42px; }
        }
      `}</style>
    </>
  );
}
