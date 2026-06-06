'use client';

import { useState, useEffect } from 'react';

interface CookieBannerProps {
  position?: 'bottom' | 'top';
  primaryColor?: string;
}

export default function CookieBanner({ 
  position = 'bottom',
  primaryColor = '#e91e63'
}: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Verificar si ya se aceptaron las cookies
    const cookieConsent = localStorage.getItem('cookie-consent');
    if (!cookieConsent) {
      // Mostrar banner después de 1 segundo
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
    
    // Analytics opcional
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
  };

  const declineCookies = () => {
    localStorage.setItem('cookie-consent', 'declined');
    localStorage.setItem('cookie-consent-date', new Date().toISOString());
    setIsVisible(false);
    
    // Analytics opcional - denegar
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }
  };

  // No renderizar en servidor
  if (!isClient || !isVisible) return null;

  return (
    <>
      <div 
        className={`cookie-banner ${position}`}
        role="dialog"
        aria-labelledby="cookie-title"
        aria-describedby="cookie-description"
      >
        <div className="cookie-content">
          <div className="cookie-text">
            <h3 id="cookie-title" className="cookie-title">
              🍪 We use cookies
            </h3>
            <p id="cookie-description" className="cookie-description">
              We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
              By clicking "Accept All", you consent to our use of cookies.
              <br />
              <a href="/privacy-policy" className="cookie-link">
                Learn more about our Privacy Policy
              </a>
            </p>
          </div>
          
          <div className="cookie-actions">
            <button 
              className="cookie-btn cookie-btn-decline"
              onClick={declineCookies}
              aria-label="Decline cookies"
            >
              Decline
            </button>
            <button 
              className="cookie-btn cookie-btn-accept"
              onClick={acceptCookies}
              aria-label="Accept all cookies"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>

      {/* Overlay opcional */}
      <div className="cookie-overlay" onClick={acceptCookies}></div>

      <style jsx>{`
        .cookie-banner {
          position: fixed;
          left: 20px;
          right: 20px;
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          border: 1px solid #e0e0e0;
          z-index: 9999;
          max-width: 500px;
          margin: 0 auto;
          animation: slideIn 0.5s ease-out;
        }

        .cookie-banner.bottom {
          bottom: 20px;
        }

        .cookie-banner.top {
          top: 20px;
        }

        .cookie-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .cookie-text {
          flex: 1;
        }

        .cookie-title {
          font-size: 18px;
          font-weight: 700;
          color: #202124;
          margin: 0 0 10px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cookie-description {
          font-size: 14px;
          color: #5f6368;
          line-height: 1.5;
          margin: 0;
        }

        .cookie-link {
          color: ${primaryColor};
          text-decoration: none;
          font-weight: 600;
        }

        .cookie-link:hover {
          text-decoration: underline;
        }

        .cookie-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .cookie-btn {
          padding: 10px 20px;
          border-radius: 25px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid;
          font-family: inherit;
        }

        .cookie-btn-decline {
          background: transparent;
          color: #5f6368;
          border-color: #e0e0e0;
          flex: 1;
          min-width: 100px;
        }

        .cookie-btn-decline:hover {
          background: #f5f5f5;
          border-color: #d0d0d0;
        }

        .cookie-btn-accept {
          background: ${primaryColor};
          color: white;
          border-color: ${primaryColor};
          flex: 2;
          min-width: 120px;
        }

        .cookie-btn-accept:hover {
          background: #c2185b;
          border-color: #c2185b;
          transform: translateY(-1px);
        }

        .cookie-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.1);
          z-index: 9998;
          opacity: 0;
          animation: fadeIn 0.5s ease-out forwards;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .cookie-banner {
            left: 16px;
            right: 16px;
            bottom: 16px;
            padding: 16px;
            max-width: none;
          }

          .cookie-title {
            font-size: 16px;
          }

          .cookie-description {
            font-size: 13px;
          }

          .cookie-actions {
            flex-direction: column;
          }

          .cookie-btn {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .cookie-banner {
            left: 12px;
            right: 12px;
            bottom: 12px;
            padding: 14px;
          }
        }

        /* ACCESIBILIDAD */
        @media (prefers-reduced-motion: reduce) {
          .cookie-banner {
            animation: none;
          }
          
          .cookie-overlay {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}