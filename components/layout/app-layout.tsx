'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/navigation/sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Hide sidebar on auth pages
  const isAuthPage = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/auth') ||
                     pathname?.startsWith('/signin') ||
                     pathname?.startsWith('/signup');

  return (
    <>
      {!isAuthPage && <Sidebar />}
      {/* Main content area adjusted for sidebar only when sidebar is shown */}
      <div className={!isAuthPage ? "ml-16 min-h-screen" : "min-h-screen"}>
        {children}
      </div>
    </>
  );
}