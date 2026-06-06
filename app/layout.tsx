import "./globals.css";
import MinimalHeader from "./components/MinimalHeader";
import CookieBanner from "./components/CookieBanner";
import ScrollToTop from "./components/ScrollToTop";
import Script from 'next/script';
import DeferredGA from './components/DeferredGA';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (
    <html lang="en">
      <head>
        {/* BLINDAJE CONTRA CRASH POR AUTO-TRADUCCIÓN (Google Translate + React).
            Debe ir PRIMERO para correr antes de la hidratación. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (typeof Node === 'function' && Node.prototype) {
                  var originalRemoveChild = Node.prototype.removeChild;
                  Node.prototype.removeChild = function (child) {
                    if (child.parentNode !== this) { return child; }
                    return originalRemoveChild.apply(this, arguments);
                  };
                  var originalInsertBefore = Node.prototype.insertBefore;
                  Node.prototype.insertBefore = function (newNode, referenceNode) {
                    if (referenceNode && referenceNode.parentNode !== this) { return newNode; }
                    return originalInsertBefore.apply(this, arguments);
                  };
                }
              })();
            `,
          }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* GOOGLE SEARCH CONSOLE DESDE ENV */}
        <meta 
          name="google-site-verification" 
          content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION} 
        />
          {/* BING WEBMASTER TOOLS */}
  <meta name="msvalidate.01" content="B1AC01FD1C1A1A60775D00AFC3A02FF0" />

  {/* YANDEX WEBMASTER */}
  <meta name="yandex-verification" content="bedb4889f025f024" />
  
  {/* Pinterest verification */}
  <meta name="p:domain_verify" content="2b3c008e585100c73bd04a8081cd1e92"/>
  
        {/* PRECONNECT PARA MEJORAR VELOCIDAD */}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://widget.getyourguide.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
      </head>
      <body suppressHydrationWarning={true}>
        <MinimalHeader />
        <main>{children}</main>
        
        {/* SCROLL TO TOP - GLOBAL PARA TODAS LAS PÁGINAS */}
        <ScrollToTop />
        
        {/* COOKIE BANNER - AL FINAL PARA QUE APAREZCA ENCIMA DE TODO */}
        <CookieBanner 
          position="bottom"
          primaryColor="#e91e63"
        />

        {/* COMPONENTE PARA GA4 DIFERIDO */}
        <DeferredGA />
        
        {/* VERCEL ANALYTICS */}
        <Analytics />
        
        {/* SOLO GETYOURGUIDE */}
        <Script
          src="https://widget.getyourguide.com/dist/pa.umd.production.min.js"
          data-gyg-partner-id={process.env.NEXT_PUBLIC_GETYOURGUIDE_PARTNER_ID}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}