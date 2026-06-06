import { useEffect, useCallback, useRef, useState } from 'react';

// ✅ HOOK OPTIMIZADO - Throttled scroll
export function useThrottledScroll(callback: (scrollY: number) => void, delay: number = 16) {
  const callbackRef = useRef(callback);
  const throttleRef = useRef<number>();

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleScroll = () => {
      if (throttleRef.current) return;
      
      throttleRef.current = requestAnimationFrame(() => {
        callbackRef.current(window.scrollY);
        throttleRef.current = undefined;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (throttleRef.current) {
        cancelAnimationFrame(throttleRef.current);
      }
    };
  }, [delay]);
}

// ✅ HOOK OPTIMIZADO - Intersection observer
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, options, hasIntersected]);

  return { isIntersecting, hasIntersected };
}

// ✅ HOOK OPTIMIZADO - Debounced value
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ✅ HOOK OPTIMIZADO - Media query con performance
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } 
    // Legacy browsers
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}

// ✅ HOOK OPTIMIZADO - Lazy loading
export function useLazyLoad() {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  
  const markAsLoaded = useCallback((src: string) => {
    setLoadedImages(prev => new Set([...prev, src]));
  }, []);
  
  const isLoaded = useCallback((src: string) => {
    return loadedImages.has(src);
  }, [loadedImages]);
  
  return { markAsLoaded, isLoaded };
}

// ✅ HOOK OPTIMIZADO - Performance monitoring
export function usePerformanceMonitoring() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Monitor Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Log metrics for debugging (remove in production)
        if (process.env.NODE_ENV === 'development') {
          console.log(`${entry.name}: ${entry.duration}ms`);
        }
        
        // Send to analytics in production
        if (process.env.NODE_ENV === 'production' && 'gtag' in window) {
          // @ts-ignore
          gtag('event', 'web_vitals', {
            custom_map: { metric_name: entry.name },
            metric_name: entry.name,
            value: Math.round(entry.duration),
          });
        }
      }
    });

    // Observe different types of performance entries
    try {
      observer.observe({ type: 'measure', buffered: true });
      observer.observe({ type: 'navigation', buffered: true });
      observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
      // Fallback for older browsers
      console.warn('Performance Observer not fully supported');
    }

    return () => {
      observer.disconnect();
    };
  }, []);
}

// ✅ HOOK OPTIMIZADO - Prefetch
export function usePrefetch() {
  const prefetchedUrls = useRef<Set<string>>(new Set());
  
  const prefetch = useCallback((href: string, priority: 'low' | 'high' = 'low') => {
    if (prefetchedUrls.current.has(href) || typeof window === 'undefined') return;
    
    prefetchedUrls.current.add(href);
    
    const link = document.createElement('link');
    link.rel = priority === 'high' ? 'preload' : 'prefetch';
    link.href = href;
    link.as = 'document';
    
    document.head.appendChild(link);
    
    // Cleanup after timeout
    setTimeout(() => {
      try {
        document.head.removeChild(link);
      } catch (e) {
        // Link might have been removed already
      }
    }, 5000);
  }, []);
  
  return { prefetch };
}