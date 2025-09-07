import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface PerformanceState {
  // Navigation state
  isNavigating: boolean;
  setNavigating: (isNavigating: boolean) => void;
  
  // Loading states  
  loadingStates: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;
  
  // Cache optimization
  prefetchedData: Map<string, any>;
  setPrefetchedData: (key: string, data: any) => void;
  getPrefetchedData: (key: string) => any;
  
  // Performance metrics
  metrics: {
    lastNavigationTime: number;
    averageLoadTime: number;
    navigationCount: number;
  };
  updateMetrics: (loadTime: number) => void;
  
  // UI optimizations
  shouldReduceAnimations: boolean;
  setShouldReduceAnimations: (reduce: boolean) => void;
}

export const usePerformanceStore = create<PerformanceState>()(
  devtools(
    (set, get) => ({
      // Navigation
      isNavigating: false,
      setNavigating: (isNavigating) => set({ isNavigating }),
      
      // Loading states
      loadingStates: {},
      setLoading: (key, loading) =>
        set((state) => ({
          loadingStates: { ...state.loadingStates, [key]: loading },
        })),
      
      // Cache
      prefetchedData: new Map(),
      setPrefetchedData: (key, data) =>
        set((state) => {
          const newMap = new Map(state.prefetchedData);
          newMap.set(key, data);
          return { prefetchedData: newMap };
        }),
      getPrefetchedData: (key) => get().prefetchedData.get(key),
      
      // Metrics
      metrics: {
        lastNavigationTime: 0,
        averageLoadTime: 0,
        navigationCount: 0,
      },
      updateMetrics: (loadTime) =>
        set((state) => {
          const newCount = state.metrics.navigationCount + 1;
          const newAverage =
            (state.metrics.averageLoadTime * state.metrics.navigationCount + loadTime) / newCount;
          
          return {
            metrics: {
              lastNavigationTime: loadTime,
              averageLoadTime: newAverage,
              navigationCount: newCount,
            },
          };
        }),
      
      // UI optimizations
      shouldReduceAnimations: false,
      setShouldReduceAnimations: (reduce) => set({ shouldReduceAnimations: reduce }),
    }),
    {
      name: 'performance-store',
    }
  )
);