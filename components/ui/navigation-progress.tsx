'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleStart = () => setIsLoading(true);
    const handleComplete = () => setIsLoading(false);

    // Simulate route changes by watching pathname and searchParams changes
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 100);

    return () => {
      clearTimeout(timer);
    };
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 0 }}
          transition={{ 
            duration: 0.3,
            ease: "easeInOut"
          }}
          className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 origin-left z-[9999]"
          style={{
            transformOrigin: '0%'
          }}
        />
      )}
    </AnimatePresence>
  );
}

// Alternative minimal progress bar for better performance
export function MinimalNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    setProgress(30); // Start progress

    const timer1 = setTimeout(() => setProgress(60), 50);
    const timer2 = setTimeout(() => setProgress(90), 100);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setIsVisible(false), 200);
    }, 150);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [pathname, searchParams]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 bg-slate-200 z-[9999]">
      <div
        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}