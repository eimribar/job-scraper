import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ReactQueryProvider } from "@/lib/providers/react-query-provider";
import { ToastContainer } from "@/components/ui/toast";
import { MinimalNavigationProgress } from "@/components/ui/navigation-progress";
import { Sidebar } from "@/components/navigation/sidebar";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: 'swap', // Improve font loading performance
  preload: true,
});

export const metadata: Metadata = {
  title: "Sales Tool Detector | Find Companies Using Outreach & SalesLoft",
  description: "Internal SDR/GTM tool to identify companies using Outreach.io or SalesLoft through job posting analysis",
  keywords: "sales tools, outreach, salesloft, lead generation, sales automation",
  robots: "noindex, nofollow", // Internal tool
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://nslcadgicgkncajoyyno.supabase.co" />
        <link rel="dns-prefetch" href="https://api.openai.com" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="color-scheme" content="light" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <MinimalNavigationProgress />
        </Suspense>
        <ReactQueryProvider>
          <div className="relative min-h-screen">
            <Sidebar />
            {/* Main content area adjusted for sidebar */}
            <div className="ml-16 min-h-screen">
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              }>
                {children}
              </Suspense>
            </div>
            <ToastContainer />
          </div>
        </ReactQueryProvider>
        
        {/* Performance monitoring script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                // Monitor Core Web Vitals
                const observer = new PerformanceObserver((list) => {
                  for (const entry of list.getEntries()) {
                    if (entry.entryType === 'navigation') {
                      const navEntry = entry;
                      console.log('Page Load Time:', navEntry.loadEventEnd - navEntry.loadEventStart, 'ms');
                    }
                  }
                });
                observer.observe({ entryTypes: ['navigation'] });
                
                // Preload critical resources
                const preloadLinks = [
                  '/api/dashboard',
                  '/api/companies?page=1&limit=10'
                ];
                
                preloadLinks.forEach(url => {
                  const link = document.createElement('link');
                  link.rel = 'prefetch';
                  link.href = url;
                  document.head.appendChild(link);
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
