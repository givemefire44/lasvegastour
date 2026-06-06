// ✅ EXPORTS CENTRALIZADOS - Fácil importación
export {
    useThrottledScroll,
    useIntersectionObserver,
    useDebounce,
    useMediaQuery,
    useLazyLoad,
    usePerformanceMonitoring,
    usePrefetch
  } from './usePerformance';
  
  // Re-export para compatibilidad
  export { usePerformanceMonitoring as usePerformance } from './usePerformance';