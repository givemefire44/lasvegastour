'use client';

import { useEffect } from 'react';

export default function DeferredGA() {
  useEffect(() => {
    let gaLoaded = false;
    
    const loadGA = () => {
      if (gaLoaded) return;
      gaLoaded = true;
      
      // Cargar GA4 script
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_TRACKING_ID}`;
      script.async = true;
      document.head.appendChild(script);
      
      script.onload = () => {
        // @ts-ignore
        window.dataLayer = window.dataLayer || [];
        // @ts-ignore
        function gtag(){dataLayer.push(arguments);}
        // @ts-ignore
        gtag('js', new Date());
        // @ts-ignore
        gtag('config', process.env.NEXT_PUBLIC_GA_TRACKING_ID);
      };
    };
    
    // Cargar después de 3 segundos O primer scroll/click
    const timer = setTimeout(loadGA, 3000);
    
    const onUserInteraction = () => {
      clearTimeout(timer);
      loadGA();
      window.removeEventListener('scroll', onUserInteraction);
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
    };
    
    window.addEventListener('scroll', onUserInteraction);
    window.addEventListener('click', onUserInteraction);
    window.addEventListener('keydown', onUserInteraction);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onUserInteraction);
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
    };
  }, []);

  return null; // No renderiza nada, solo maneja la lógica
}