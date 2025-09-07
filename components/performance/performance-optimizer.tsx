'use client';

import { useEffect } from 'react';
import { usePerformanceStore } from '@/lib/stores/performance-store';

export function PerformanceOptimizer() {
  const { setShouldReduceAnimations } = usePerformanceStore();

  useEffect(() => {
    // Detect slow devices and reduce animations
    const detectSlowDevice = () => {
      const connection = (navigator as any).connection;
      const memory = (performance as any).memory;
      
      let isSlowDevice = false;
      
      // Check network connection
      if (connection?.effectiveType && ['slow-2g', '2g', '3g'].includes(connection.effectiveType)) {
        isSlowDevice = true;
      }
      
      // Check memory (if available)
      if (memory?.jsHeapSizeLimit && memory.jsHeapSizeLimit < 1073741824) { // Less than 1GB
        isSlowDevice = true;
      }
      
      // Check hardware concurrency
      if (navigator.hardwareConcurrency <= 2) {
        isSlowDevice = true;
      }
      
      setShouldReduceAnimations(isSlowDevice);
    };

    // Performance optimizations
    const performanceOptimizations = () => {
      // Intersection Observer for lazy loading
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                if (img.dataset.src) {
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                  observer.unobserve(img);
                }
              }
            });
          },
          { 
            rootMargin: '50px',
            threshold: 0.1 
          }
        );

        // Observe images with data-src
        document.querySelectorAll('img[data-src]').forEach((img) => {
          observer.observe(img);
        });
      }

      // Prefetch on hover
      const prefetchOnHover = (e: MouseEvent) => {
        const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement;
        if (link && link.hostname === window.location.hostname) {
          const prefetchLink = document.createElement('link');
          prefetchLink.rel = 'prefetch';
          prefetchLink.href = link.href;
          document.head.appendChild(prefetchLink);
        }
      };

      document.addEventListener('mouseover', prefetchOnHover);

      return () => {
        document.removeEventListener('mouseover', prefetchOnHover);
      };
    };

    detectSlowDevice();
    const cleanup = performanceOptimizations();

    // Cleanup on unmount
    return cleanup;
  }, [setShouldReduceAnimations]);

  return null;
}