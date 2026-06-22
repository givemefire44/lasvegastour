'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { client } from '@/sanity/lib/client';

interface FooterPage {
  title: string;
  slug: string; // ← SIMPLIFICADO
  footerOrder?: number;
}

export default function Footer() {
  const [footerPages, setFooterPages] = useState<FooterPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ QUERY MEJORADA - Con mejor estructura
  const footerQuery = useMemo(() => `
    *[_type == "page" && defined(showInFooter) && showInFooter == true] | order(coalesce(footerOrder, 999) asc, title asc) {
      title,
      "slug": slug.current,
      footerOrder
    }
  `, []);

  // ✅ FETCH CON MEJOR ERROR HANDLING
  const fetchFooterPages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Verificar que el cliente esté configurado
      if (!client) {
        throw new Error('Sanity client not configured');
      }

      const pages = await client.fetch(footerQuery);
      setFooterPages(Array.isArray(pages) ? pages : []);
    } catch (error) {
      console.error('Error fetching footer pages:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      
      // ✅ FALLBACK CORREGIDO - Estructura simplificada
      setFooterPages([
        { title: 'About Us', slug: 'about-us' },
        { title: 'Privacy Policy', slug: 'privacy-policy' },
        { title: 'Terms of Service', slug: 'terms' },
        { title: 'Contact', slug: 'contact' }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [footerQuery]);

  useEffect(() => {
    // ✅ DELAY PARA EVITAR BLOQUEO EN HYDRATION
    const timer = setTimeout(() => {
      fetchFooterPages();
    }, 100);

    return () => clearTimeout(timer);
  }, [fetchFooterPages]);

  // ✅ RETRY FUNCTION
  const retryFetch = useCallback(() => {
    fetchFooterPages();
  }, [fetchFooterPages]);

  // ✅ LINKS CORREGIDOS
  const footerLinks = useMemo(() => {
    if (isLoading) {
      return Array.from({ length: 4 }, (_, i) => (
        <li key={`skeleton-${i}`} className="skeleton-link">
          <div className="skeleton-text"></div>
        </li>
      ));
    }

    if (error) {
      return (
        <li className="error-state">
          <span style={{ color: '#ff6b6b', fontSize: '12px' }}>
            Unable to load links
          </span>
          <button 
            onClick={retryFetch}
            style={{
              background: 'none',
              border: '1px solid #e91e63',
              color: '#e91e63',
              padding: '4px 8px',
              fontSize: '11px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Retry
          </button>
        </li>
      );
    }

    return footerPages.map((page) => (
      <li key={page.slug || page.title}>
        <a 
          href={`/${page.slug || '#'}`}
          style={{
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {page.title}
        </a>
      </li>
    ));
  }, [footerPages, isLoading, error, retryFetch]);

  return (
    <footer className="footer">
      <div className="footer-container">
        
        {/* SECCIÓN PRINCIPAL */}
        <div className="footer-main">
          
          {/* LOGO Y DESCRIPCIÓN */}
          <div className="footer-brand">
            <div className="footer-logo">
              <h3>lasvegastour.com</h3>
            </div>
            <p className="footer-description">
  LasVegasTour.com is an independent editorial site. We do not sell tickets or tours — 
  all bookings are processed directly by the tour operator (Viator/GetYourGuide) at their listed prices 
  with no added markup. 
</p>
            <div className="footer-contact">
              <p>📧 info@lasvegastour.com</p>
             
            </div>
          </div>

          {/* NAVEGACIÓN DE PÁGINAS */}
          <div className="footer-nav">
            <h4>Company</h4>
            <ul>
              {footerLinks}
            </ul>
          </div>

          {/* PAYMENT METHODS */}
          <div className="footer-payments-main">
            <h4>Secure Payment Methods</h4>
            <div className="payment-methods-image">
              <Image 
                src="https://cdn.sanity.io/images/ptigxfcf/production/b18a7a5042241b293d41d2c03b09596114f040e8-249x145.png"
                alt="Accepted payment methods: Visa, Mastercard, PayPal, American Express, Apple Pay, Google Pay, Klarna"
                width={249}
                height={145}
                style={{
                  maxWidth: '100%',
                  height: 'auto'
                }}
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
            </div>
          </div>

        </div>

        {/* FOOTER BOTTOM */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">

            {/* SELLO CURATOR TEAM */}
            <div className="footer-seal">
              <span className="footer-seal-line1">
                <span className="footer-seal-dot" aria-hidden="true"></span>
                By <strong>Intercoper Curator Team</strong>
              </span>
              <span className="footer-seal-line2">Reviewed. Compared. Selected.</span>
            </div>

            {/* POWERED BY INTERCOPER */}
            <div className="footer-powered">
              <span>Powered by </span>
              <Link href="https://www.intercoper.com" target="_blank" rel="noopener noreferrer">
                <span style={{ color: '#e91e63', fontWeight: 600 }}>Intercoper<span style={{ fontSize: '0.85em' }}> ↗</span></span>
              </Link>
            </div>

            {/* COPYRIGHT */}
            <p className="footer-copyright">&copy; 2024 lasvegastour.com. All rights reserved.</p>

          </div>
        </div>

      </div>

      <style jsx>{`
        .footer {
          background: #1a1a1a;
          color: #e5e5e5;
          margin-top: 60px;
          width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
          contain: layout style paint;
        }

        .footer-container {
          max-width: 1150px;
          margin: 0 auto;
          padding: 40px 24px 20px;
          box-sizing: border-box;
          width: 100%;
          overflow-x: hidden;
        }

        .footer-main {
          display: grid;
          grid-template-columns: 2fr 1fr 2fr;
          gap: 40px;
          margin-bottom: 40px;
          width: 100%;
          box-sizing: border-box;
          contain: layout;
        }

        .footer-brand {
          padding-right: 20px;
          min-width: 0;
          text-rendering: optimizeSpeed;
        }

        .footer-logo h3 {
          color: #e91e63;
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 16px;
          word-wrap: break-word;
          will-change: transform;
        }

        .footer-description {
          color: #b3b3b3;
          line-height: 1.6;
          margin-bottom: 20px;
          word-wrap: break-word;
        }

        .footer-contact p {
          color: #b3b3b3;
          font-size: 14px;
          margin-bottom: 8px;
          word-wrap: break-word;
        }

        .footer-nav {
          min-width: 0;
        }

        .footer-nav h4,
        .footer-payments-main h4 {
          color: white;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .footer-nav ul {
          list-style: none;
          padding: 0;
        }

        .footer-nav li {
          margin-bottom: 12px;
        }

        /* ✅ ESPECIFICIDAD MÁXIMA PARA FORZAR COLORES */
        .footer .footer-nav ul li a,
        .footer .footer-nav ul li a:link,
        .footer .footer-nav ul li a:visited,
        .footer .footer-nav ul li a:active {
          color: #ffffff !important;
          text-decoration: none !important;
          font-size: 14px !important;
          transition: color 0.2s ease !important;
          word-wrap: break-word !important;
          opacity: 0.9 !important;
        }

        .footer .footer-nav ul li a:hover,
        .footer .footer-nav ul li a:focus {
          color: #00ff00 !important; /* ← VERDE NEÓN PARA TEST */
          text-decoration: underline !important;
          opacity: 1 !important;
        }

        /* ✅ ERROR STATE */
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        /* ✅ SKELETON LOADING */
        .skeleton-link {
          margin-bottom: 12px;
        }

        .skeleton-text {
          height: 14px;
          background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 4px;
          width: 80%;
        }

        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .footer-payments-main {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 0;
        }

        .footer-payments-main h4 {
          text-align: center;
          margin-bottom: 20px;
        }

        .payment-methods-image {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 300px;
          contain: layout;
        }

        .footer-bottom {
          border-top: 1px solid #333;
          padding: 20px 0;
          width: 100%;
          box-sizing: border-box;
        }

        /* ✅ FOOTER BOTTOM - centrado con sello + powered by + copyright */
        .footer-bottom-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          font-size: 14px;
          color: #b3b3b3;
          max-width: 100%;
          padding: 0 20px;
          box-sizing: border-box;
          text-align: center;
        }

        /* SELLO CURATOR TEAM */
        .footer-seal {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          line-height: 1.25;
        }

        .footer-seal-line1 {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #b3b3b3;
        }

        .footer-seal-line1 strong {
          font-weight: 600;
          color: #dcdcdc;
        }

        .footer-seal-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #e91e63;
          flex-shrink: 0;
        }

        .footer-seal-line2 {
          font-size: 12px;
          color: #e91e63;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        /* POWERED BY - destacado */
        .footer-powered {
          font-size: 15px;
          color: #8a8a8a;
        }

        .footer .footer-powered a,
        .footer .footer-powered a:link,
        .footer .footer-powered a:visited,
        .footer .footer-powered a:active {
          color: #e91e63 !important;
          text-decoration: none !important;
          font-weight: 600 !important;
          transition: color 0.2s ease !important;
        }

        .footer .footer-powered a:hover,
        .footer .footer-powered a:focus {
          color: #ff4081 !important;
        }

        .footer-powered-arrow {
          font-size: 0.85em;
        }

        .footer-copyright {
          font-size: 13px;
          color: #6f6f6f;
          margin: 0;
        }

        @media (max-width: 768px) {
          .footer-main {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .footer-brand {
            padding-right: 0;
          }

          .footer-bottom-content {
            gap: 14px;
            padding: 0 20px;
          }
        }

        @media (max-width: 480px) {
          .footer-container {
            padding: 40px 16px 20px;
          }

          .footer-main {
            gap: 25px;
          }

          .footer-bottom-content {
            padding: 0 10px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .footer-nav a,
          .footer-powered a {
            transition: none;
          }
          
          .skeleton-text {
            animation: none;
            background: #444;
          }
        }
      `}</style>
    </footer>
  );
}
