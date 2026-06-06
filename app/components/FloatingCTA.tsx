'use client';

import { useState, useEffect } from 'react';

interface FloatingCTAProps {
  affiliateUrl?: string;
  ctaText?: string;
  showOnlyOnHomepage?: boolean;
}

export default function FloatingCTA({ 
  affiliateUrl = "https://www.getyourguide.com/colosseum-tours",
  ctaText = "Book Tour",
  showOnlyOnHomepage = true
}: FloatingCTAProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isHomepage, setIsHomepage] = useState(false);

  useEffect(() => {
    const checkIfHomepage = () => {
      const currentPath = window.location.pathname;
      setIsHomepage(currentPath === '/' || currentPath === '');
    };

    checkIfHomepage();

    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (typeof window === 'undefined') return null;
  if (showOnlyOnHomepage && !isHomepage) return null;
  if (!isVisible) return null;

  const handleClick = () => {
    window.open(affiliateUrl, '_blank');
  };

  return (
    <>
      {/* CTA ELEGANTE Y COMPACTO */}
      <div 
        className="elegant-cta"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'fixed',
          bottom: '120px',
          right: '470px',
          zIndex: 999999,
          cursor: 'pointer',
          transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: isVisible ? 'slideInRight 0.6s ease-out' : 'none',
        }}
      >
        {/* BOTÓN PRINCIPAL */}
        <div 
          style={{
            background: isHovered 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '14px 20px',
            borderRadius: '50px',
            boxShadow: isHovered 
              ? '0 8px 25px rgba(102, 126, 234, 0.4)'
              : '0 4px 15px rgba(102, 126, 234, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '15px',
            fontWeight: '600',
            letterSpacing: '0.3px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease'
          }}
        >
          {/* ICONO SIMPLE */}
          <div style={{
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🎫
          </div>
          
          {/* TEXTO */}
          <span>{ctaText}</span>
          
          {/* FLECHA SUTIL */}
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5"
            style={{
              transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
              transition: 'transform 0.2s ease',
              opacity: 0.8
            }}
          >
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>

        {/* BADGE PEQUEÑO Y DISCRETO */}
        <div 
          style={{
            position: 'absolute',
            top: '-6px',
            right: '-6px',
            background: '#ff4757',
            color: 'white',
            fontSize: '9px',
            fontWeight: '700',
            padding: '3px 6px',
            borderRadius: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 2px 8px rgba(255, 71, 87, 0.3)',
            animation: isVisible ? 'pulse 2s infinite' : 'none'
          }}
        >
          Hot
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .elegant-cta:active {
          transform: translateY(0) scale(0.95) !important;
        }

        /* RESPONSIVE - NO INTERFIERE CON OTROS ELEMENTOS */
        @media (max-width: 768px) {
          .elegant-cta {
            bottom: 90px !important;
            right: 20px !important;
            font-size: 14px !important;
          }
        }

        @media (max-width: 480px) {
          .elegant-cta {
            bottom: 80px !important;
            right: 16px !important;
            padding: 12px 16px !important;
            font-size: 13px !important;
          }
        }
      `}</style>
    </>
  );
}