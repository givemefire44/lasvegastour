'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { client } from '@/sanity/lib/client';

interface FooterPage {
  title: string;
  slug: string;
  footerOrder?: number;
}

// Los links institucionales arrancan escritos aca para que salgan en el HTML del
// servidor. Antes se pedian a Sanity recien en el navegador: un crawler veia cuatro
// placeholders (skeleton) y ningun enlace a About Us. Son los mismos cuatro que devuelve
// la query hoy (15 nov 2026); si en Sanity se agrega o saca uno, el fetch lo corrige en el
// cliente, y conviene actualizar esta lista tambien.
const FOOTER_PAGES_SSR: FooterPage[] = [
  { title: 'About Us', slug: 'about-us' },
  { title: 'Terms & Conditions', slug: 'terms-and-conditions' },
  { title: 'Cookies & Privacy Policy', slug: 'cookies-and-privacy-policy' },
  { title: 'Contact Us', slug: 'contact-us' },
];

// Columnas de navegacion en todo el sitio, en HTML plano (15 nov 2026): las guias de cada
// vertical reciben un enlace desde cada pagina, siempre con el mismo texto. Los hubs ya salen
// en los chips; aca van los de las decisiones grandes. Todo slug es una page o hub publicado:
// verificado con HTTP 200 ese dia.
const FOOTER_COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Grand Canyon & day trips',
    links: [
      ['/grand-canyon-west-vs-south-rim-from-las-vegas', 'West vs South Rim'],
      ['/grand-canyon-day-trip-from-las-vegas-how-long', 'How long the day is'],
      ['/is-the-grand-canyon-day-trip-from-las-vegas-worth-it', 'Is the day trip worth it'],
      ['/grand-canyon-west-skywalk-eagle-point-guano-point', 'Skywalk and viewpoints'],
      ['/hoover-dam-tour-from-las-vegas', 'Hoover Dam'],
      ['/red-rock-canyon-from-las-vegas', 'Red Rock Canyon'],
      ['/valley-of-fire-from-las-vegas', 'Valley of Fire'],
      ['/antelope-canyon-tour-from-las-vegas-what-reviews-say', 'Antelope Canyon'],
      ['/zion-national-park-from-las-vegas', 'Zion National Park'],
    ],
  },
  {
    // Las ocho categorias del catalogo (15 nov 2026): no tenian ningun enlace en el header ni en
    // el footer del HTML del servidor; ahora lo tienen desde cada pagina. Los hubs siguen en los
    // chips de casi todas las paginas.
    title: 'Tours by category',
    links: [
      ['/tours', 'All Las Vegas tours'],
      ['/tours/grand-canyon-tours', 'Grand Canyon tours'],
      ['/tours/helicopter-tours', 'Helicopter tours'],
      ['/tours/shows', 'Shows and entertainment'],
      ['/tours/strip-tours', 'Strip and city tours'],
      ['/tours/day-trips', 'Day trips and national parks'],
      ['/tours/hoover-dam-tours', 'Hoover Dam tours'],
      ['/tours/adventure-tours', 'Adventure and outdoor'],
      ['/tours/nightlife', 'Nightlife and bar crawls'],
      ['/tour-finder', 'Tour finder'],
    ],
  },
  {
    title: 'Shows & planning',
    links: [
      ['/how-to-choose-las-vegas-shows', 'How to choose a show'],
      ['/las-vegas-show-seats-where-to-sit', 'Where to sit'],
      ['/las-vegas-helicopter-tours-which-worth-it', 'Which helicopter tour'],
      ['/how-much-las-vegas-trip-costs', 'What the trip costs'],
      ['/las-vegas-resort-fees-tipping-hidden-charges', 'Resort fees and tipping'],
      ['/las-vegas-tour-pickup-and-meeting-point', 'Hotel pickup'],
      ['/how-to-get-around-las-vegas', 'Getting around'],
      ['/first-time-las-vegas-how-to-plan', 'First time in Las Vegas'],
      ['/las-vegas-guides', 'Every guide'],
    ],
  },
];

const FOOTER_QUERY = `
  *[_type == "page" && defined(showInFooter) && showInFooter == true] | order(coalesce(footerOrder, 999) asc, title asc) {
    title,
    "slug": slug.current,
    footerOrder
  }
`;

export default function Footer() {
  const [footerPages, setFooterPages] = useState<FooterPage[]>(FOOTER_PAGES_SSR);
  // El año se calcula: un "© 2024" fijo hacia parecer abandonado al sitio, y un año
  // de inicio no se afirma (el WHOIS dice otra cosa).
  const year = new Date().getFullYear();

  useEffect(() => {
    let vivo = true;
    client
      .fetch(FOOTER_QUERY)
      .then((pages) => {
        if (vivo && Array.isArray(pages) && pages.length > 0) setFooterPages(pages);
      })
      .catch((err) => console.error('Error fetching footer pages:', err));
    return () => { vivo = false; };
  }, []);

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
  bookings are processed by the booking platform (Viator or GetYourGuide) and the tours are run by the
  tour operator, at their listed prices with no added markup. We may earn a commission when you book
  through our links, at no extra cost to you.
</p>
            <div className="footer-contact">
              {/* Sin la direccion en texto: Cloudflare la ofusca y en el HTML queda
                  "[email protected]", que se lee como pagina rota. */}
              <p>📧 <a href="/contact-us" style={{ color: '#ffffff' }}>Contact us</a></p>
            </div>

            {/* Quien esta detras, en HTML plano (sin fetch ni JS) para que lo lean los
                crawlers en todas las paginas. Los links son los del About. La direccion
                es la misma del schema Organization de la home. */}
            <div className="footer-author">
              <p className="footer-author-title">
                Curated by <a href="https://www.intercoper.com/author/mario-dalo" target="_blank" rel="noopener">Mario Dalo</a>, founder of <a href="https://www.intercoper.com/about" target="_blank" rel="noopener">Intercoper</a>
              </p>
              <ul className="footer-author-links">
                <li><a href="https://www.linkedin.com/in/mariodalo/" target="_blank" rel="noopener">LinkedIn</a></li>
                <li><a href="https://orcid.org/0009-0003-7402-0338" target="_blank" rel="noopener">ORCID</a></li>
                <li><a href="https://zenodo.org/communities/intercoper-research" target="_blank" rel="noopener">Research datasets on Zenodo</a></li>
              </ul>
              <address className="footer-address">
                Intercoper · Larrea 1280, C1117 Buenos Aires, Argentina
              </address>
            </div>
          </div>

          {/* NAVEGACIÓN DEL SITIO, en HTML plano */}
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} className="footer-nav" aria-label={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map(([href, label]) => (
                  <li key={href}><a href={href}>{label}</a></li>
                ))}
              </ul>
            </nav>
          ))}

          {/* NAVEGACIÓN DE PÁGINAS */}
          <div className="footer-nav">
            <h4>Company</h4>
            <ul>
              {/* El catalogo propio entra al footer el 25 oct 2026, cuando salio
                  del widget del sidebar. Ahi era un boton de conversion que
                  mandaba para adentro —en 103 de 121 articulos— y le ganaba el
                  click al que si sale a la OTA. Aca es lo que siempre fue:
                  navegacion. Y la gana en todo el sitio, no solo en articulos. */}
              <li>
                <a href="/tours">All Las Vegas Tours</a>
              </li>
              <li>
                <a href="/las-vegas-research">The Research Program</a>
              </li>
              {/* El map va aca adentro: styled-jsx no le pone su clase al JSX armado
                  fuera del return, y esos <li> quedaban sin estilo. */}
              {footerPages.map((page) => (
                <li key={page.slug || page.title}>
                  <a href={`/${page.slug || '#'}`}>{page.title}</a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* PAYMENT METHODS: bajan a una fila propia para dejarle las columnas a la navegacion */}
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
              <Link href="https://intercoper.com/portfolio/lasvegastour-com" target="_blank" rel="noopener noreferrer">
                <span style={{ color: '#e91e63', fontWeight: 600 }}>Intercoper<span style={{ fontSize: '0.85em' }}> ↗</span></span>
              </Link>
            </div>

            {/* COPYRIGHT */}
            <p className="footer-copyright">&copy; {year} lasvegastour.com. All rights reserved.</p>

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
          grid-template-columns: 1.7fr repeat(4, minmax(0, 1fr));
          gap: 32px;
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

        .footer-author {
          margin-top: 16px;
          font-size: 13px;
          color: #b3b3b3;
          line-height: 1.6;
        }
        .footer-author a {
          color: #ffffff;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .footer-author-title {
          margin-bottom: 6px;
        }
        .footer-author-links {
          list-style: none;
          padding: 0;
          margin: 0 0 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 4px 14px;
        }
        .footer-address {
          font-style: normal;
          color: #8a8a8a;
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
          margin-bottom: 9px;
          line-height: 1.35;
        }

        .footer-nav h4 {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 13px !important;
          color: #f4c95d !important;
          border-bottom: 2px solid #e91e63;
          padding-bottom: 8px;
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
          color: #f4c95d !important; /* era #00ff00 de prueba; amarillo de la paleta */
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
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
          min-width: 0;
          border-top: 1px solid #333;
          padding: 20px 0;
        }

        .footer-payments-main h4 {
          text-align: center;
          margin: 0;
          font-size: 14px;
          color: #b3b3b3;
          font-weight: 600;
        }

        .payment-methods-image {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 180px;
          contain: layout;
        }

        @media (max-width: 1024px) {
          .footer-main {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .footer-brand {
            grid-column: 1 / -1;
          }
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
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 28px 20px;
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