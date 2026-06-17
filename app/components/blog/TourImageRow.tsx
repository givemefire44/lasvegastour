'use client';
import { useState, useEffect } from 'react';
import { urlFor } from '@/sanity/lib/image';

interface TourImageRowProps {
  images: any[];
  title: string;
}

export default function TourImageRow({ images, title }: TourImageRowProps) {
  const imgs = (images || []).filter(Boolean).slice(0, 3);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // ESC para cerrar, flechas para navegar; bloquear scroll del body con el lightbox abierto.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null);
      if (e.key === 'ArrowRight') setOpenIndex(i => (i === null ? null : (i + 1) % imgs.length));
      if (e.key === 'ArrowLeft') setOpenIndex(i => (i === null ? null : (i - 1 + imgs.length) % imgs.length));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIndex, imgs.length]);

  if (imgs.length < 2) return null;

  return (
    <div className="tour-image-row-wrap">
      <div className="tour-image-row">
        {imgs.map((img, i) => (
          <button
            key={i}
            className="tour-image-row-item"
            onClick={() => setOpenIndex(i)}
            aria-label={`View photo ${i + 1} of ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFor(img).width(520).height(400).format('webp').quality(80).fit('crop').url()}
              alt={`${title} — photo ${i + 1}`}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div className="tour-lightbox" onClick={() => setOpenIndex(null)} role="dialog" aria-modal="true">
          <button className="tour-lightbox-close" onClick={() => setOpenIndex(null)} aria-label="Close">×</button>
          <button
            className="tour-lightbox-nav prev"
            onClick={(e) => { e.stopPropagation(); setOpenIndex((openIndex - 1 + imgs.length) % imgs.length); }}
            aria-label="Previous"
          >‹</button>
          <div className="tour-lightbox-img" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFor(imgs[openIndex]).width(1400).format('webp').quality(88).url()}
              alt={`${title} — photo ${openIndex + 1}`}
            />
          </div>
          <button
            className="tour-lightbox-nav next"
            onClick={(e) => { e.stopPropagation(); setOpenIndex((openIndex + 1) % imgs.length); }}
            aria-label="Next"
          >›</button>
        </div>
      )}

      <style jsx>{`
        .tour-image-row-wrap { margin: 28px 0; }
        .tour-image-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .tour-image-row-item {
          position: relative;
          display: block;
          width: 100%;
          height: 290px;
          border: none;
          padding: 0;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          background: #eef0f3;
        }
        .tour-image-row .tour-image-row-item img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          display: block !important;
          max-width: none !important;
          margin: 0 !important;
          transition: transform 0.35s ease;
        }
        .tour-image-row-item:hover img { transform: scale(1.06) !important; }
        .tour-lightbox {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.92);
          display: flex; align-items: center; justify-content: center;
        }
        .tour-lightbox-img { display: flex; }
        .tour-lightbox-img img {
          max-width: 90vw; max-height: 85vh;
          width: auto; height: auto;
          object-fit: contain;
          border-radius: 4px;
        }
        .tour-lightbox-close {
          position: absolute; top: 16px; right: 24px;
          background: none; border: none; color: #fff; font-size: 40px;
          cursor: pointer; line-height: 1; z-index: 2;
        }
        .tour-lightbox-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(255,255,255,0.12); border: none; color: #fff;
          font-size: 42px; width: 56px; height: 56px; border-radius: 50%;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .tour-lightbox-nav.prev { left: 20px; }
        .tour-lightbox-nav.next { right: 20px; }
        .tour-lightbox-nav:hover { background: rgba(255,255,255,0.25); }
        @media (max-width: 768px) {
          .tour-image-row { grid-template-columns: repeat(2, 1fr); }
          .tour-image-row-item { height: 190px; }
          .tour-lightbox-nav { width: 44px; height: 44px; font-size: 32px; }
          .tour-lightbox-nav.prev { left: 8px; }
          .tour-lightbox-nav.next { right: 8px; }
        }
      `}</style>
    </div>
  );
}