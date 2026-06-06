// ✅ PERFORMANCE UTILITIES - Sin errores de TypeScript

// ✅ THROTTLE OPTIMIZADO
export function throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastExecTime = 0;
    
    return (...args: Parameters<T>) => {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func(...args);
        lastExecTime = currentTime;
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func(...args);
          lastExecTime = Date.now();
        }, delay);
      }
    };
  }
  
  // ✅ DEBOUNCE OPTIMIZADO
  export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }
  
  // ✅ RAF THROTTLE - Para animaciones
  export function rafThrottle<T extends (...args: unknown[]) => unknown>(
    func: T
  ): (...args: Parameters<T>) => void {
    let rafId: number | null = null;
    
    return (...args: Parameters<T>) => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        func(...args);
        rafId = null;
      });
    };
  }
  
  // ✅ PRELOAD RESOURCES
  export function preloadResource(href: string, as: string = 'document'): void {
    if (typeof window === 'undefined') return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    
    document.head.appendChild(link);
  }
  
  // ✅ PREFETCH NEXT PAGE
  export function prefetchPage(href: string): void {
    if (typeof window === 'undefined') return;
    
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    
    document.head.appendChild(link);
  }
  
  // ✅ LAZY LOAD INTERSECTION OBSERVER
  export function createLazyLoader(
    callback: (entries: IntersectionObserverEntry[]) => void,
    options: IntersectionObserverInit = {}
  ): IntersectionObserver | null {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return null;
    }
    
    return new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    });
  }
  
  // ✅ PERFORMANCE METRICS
  export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, number> = new Map();
    
    static getInstance(): PerformanceMonitor {
      if (!PerformanceMonitor.instance) {
        PerformanceMonitor.instance = new PerformanceMonitor();
      }
      return PerformanceMonitor.instance;
    }
    
    startMeasure(name: string): void {
      if (typeof window === 'undefined') return;
      performance.mark(`${name}-start`);
    }
    
    endMeasure(name: string): number {
      if (typeof window === 'undefined') return 0;
      
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name, 'measure')[0];
      const duration = measure?.duration || 0;
      
      this.metrics.set(name, duration);
      
      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚡ ${name}: ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    }
    
    getMetric(name: string): number | undefined {
      return this.metrics.get(name);
    }
    
    getAllMetrics(): Record<string, number> {
      return Object.fromEntries(this.metrics);
    }
  }
  
  // ✅ RESOURCE HINTS
  export function addResourceHints(urls: string[]): void {
    if (typeof window === 'undefined') return;
    
    urls.forEach(url => {
      try {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = new URL(url).origin;
        document.head.appendChild(link);
      } catch (error) {
        console.warn(`Invalid URL for resource hint: ${url}`);
      }
    });
  }
  
  // ✅ CRITICAL CSS DETECTOR
  export function detectCriticalCSS(): string[] {
    if (typeof window === 'undefined') return [];
    
    const criticalElements: string[] = [];
    const viewportHeight = window.innerHeight;
    
    // Get all elements in viewport
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const tagName = element.tagName.toLowerCase();
        const classes = Array.from(element.classList).map(c => `.${c}`).join('');
        criticalElements.push(`${tagName}${classes}`);
      }
    });
    
    return [...new Set(criticalElements)];
  }
  
  // ✅ MEMORY USAGE MONITOR - Tipado correctamente
  interface MemoryInfo {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }
  
  export function getMemoryUsage(): MemoryInfo | null {
    if (typeof window === 'undefined' || !('memory' in performance)) {
      return null;
    }
    
    return (performance as unknown as { memory: MemoryInfo }).memory;
  }
  
  // ✅ NETWORK INFO - Tipado correctamente
  interface NetworkInfo {
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  }
  
  export function getNetworkInfo(): NetworkInfo | null {
    if (typeof window === 'undefined' || !('connection' in navigator)) {
      return null;
    }
    
    const connection = (navigator as unknown as { connection: NetworkInfo }).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }
  
  // ✅ FONT LOADING OPTIMIZATION
  export function optimizeFontLoading(fontFamily: string): void {
    if (typeof window === 'undefined') return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    link.href = `/fonts/${fontFamily}.woff2`;
    
    document.head.appendChild(link);
  }
  
  // ✅ BUNDLE ANALYZER
  export function analyzeBundleSize(): void {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return;
    
    const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    
    console.group('📦 Bundle Analysis');
    console.log('Scripts:', scripts.length);
    console.log('Stylesheets:', styles.length);
    
    scripts.forEach((script) => {
      console.log(`- ${script.src}`);
    });
    
    console.groupEnd();
  }
  
  // ✅ EXPORT PERFORMANCE MONITOR INSTANCE
  export const performanceMonitor = PerformanceMonitor.getInstance();
  
  // ✅ CORE WEB VITALS HELPER
  export function measureCoreWebVitals(): void {
    if (typeof window === 'undefined') return;
    
    // LCP
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          console.log('LCP:', lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // FID
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const fidEntry = entry as PerformanceEventTiming;
            console.log('FID:', fidEntry.processingStart - fidEntry.startTime);
          }
        }).observe({ type: 'first-input', buffered: true });
        
        // CLS
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const clsEntry = entry as LayoutShift;
            if (!clsEntry.hadRecentInput) {
              clsValue += clsEntry.value;
            }
          }
          console.log('CLS:', clsValue);
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }
  
  // ✅ INTERFACES PARA TIPOS PERSONALIZADOS
  interface LayoutShift extends PerformanceEntry {
    value: number;
    hadRecentInput: boolean;
  }