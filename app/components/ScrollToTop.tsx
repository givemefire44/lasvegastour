'use client';

import { useState, useEffect, useCallback } from 'react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  // ✅ OPTIMIZADO - Throttling para reducir reprocesamiento
  const throttledScrollHandler = useCallback(() => {
    let ticking = false;
    
    return () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Solo una lectura por frame
          const scrolled = window.scrollY > 300;
          setIsVisible(scrolled);
          ticking = false;
        });
        ticking = true;
      }
    };
  }, []);

  useEffect(() => {
    const handleScroll = throttledScrollHandler();
    
    // ✅ PASSIVE EVENT LISTENER - Mejor rendimiento
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [throttledScrollHandler]);

  // ✅ OPTIMIZADO - Scroll suave sin reprocesamiento
  const scrollToTop = useCallback(() => {
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <div className="scroll-to-top-container">
        <button 
          className="scroll-to-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <span className="scroll-arrow">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M10 19L20 9L30 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 29L20 19L30 29" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>

      {/* 🌿 ESTILOS VERDES - TOTALMENTE CAMBIADOS */}
      <style jsx>{`
        .scroll-to-top-container {
          /* 🎯 CONTROL TOTAL - CAMBIÁ LO QUE QUIERAS */
          position: fixed;
          bottom: 150px;        /* ⬆️⬇️ ALTURA: cambiá el número */
         /* left: 20px;          ⬅️➡️ IZQUIERDA: cambiá el número */
          right: 620px;         ⬅️➡️ DERECHA: descomentá esto y comentá "left"  
          /*  left: 50%; transform: translateX(-50%);  🎯 CENTRO: descomentá estas dos líneas*/
          z-index: 1000;
          box-sizing: border-box;
          will-change: transform;
        }

        .scroll-to-top-btn {
          /* 🌿 VERDE PARA MEJOR VISIBILIDAD */
          background: transparent;
          border: 1.5px solid #28a745;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          transition: all 0.25s ease;
          will-change: transform;
        }

        .scroll-arrow {
          /* 🌿 FLECHAS VERDES */
          color: #28a745;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.25s ease;
        }

        .scroll-arrow svg {
          width: 40px;
          height: 40px;
        }

        .scroll-to-top-btn:hover {
          /* 🌿 HOVER VERDE TRANSPARENTE */
          background: rgba(40, 167, 69, 0.08);
          border-color: #28a745;
        }

        .scroll-to-top-btn:hover .scroll-arrow {
          color: #28a745;
        }

        .scroll-to-top-btn:active {
          background: rgba(40, 167, 69, 0.12);
        }

        /* 📱 RESPONSIVE - CONTROL TOTAL */
        @media (max-width: 768px) {
          .scroll-to-top-container {
            bottom: 220px;      /* ⬆️⬇️ ALTURA MOBILE: cambiá el número */
            /*left: 15px;         ⬅️➡️ POSICIÓN MOBILE: cambiá el número */
             right: 125px;       /*⬅️➡️ O USÁ RIGHT: descomentá y comentá "left" */
          }

          .scroll-to-top-btn {
            width: 38px;
            height: 38px;
          }

          .scroll-arrow svg {
            width: 32px;
            height: 32px;
          }
        }

        /* 📱 PANTALLAS MUY CHICAS (400px y menos) */
        @media (max-width: 400px) {
          .scroll-to-top-container {
            bottom: 125px;      /* ⬆️⬇️ ALTURA 400px: cambiá el número */
           /* left: 10px;         ⬅️➡️ POSICIÓN 400px: cambiá el número */
             right: 30px;      /* ⬅️➡️ O USÁ RIGHT: descomentá y comentá "left" */
          }

          .scroll-to-top-btn {
            width: 36px;       /* Un poquito más chico */
            height: 36px;
          }

          .scroll-arrow svg {
            width: 30px;       /* Flechas más chicas */
            height: 30px;
          }
        }

        /* 🌟 ANIMACIÓN DE ENTRADA */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .scroll-to-top-container {
          animation: fadeInUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
}