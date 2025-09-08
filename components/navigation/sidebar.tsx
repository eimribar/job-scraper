'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Home, Building2, Zap, Settings, User, ChevronRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrefetchCompanies, usePrefetchDashboardStats } from '@/lib/hooks/useCompanies';

interface SidebarProps {
  className?: string;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
}

export function Sidebar({ className }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();
  const prefetchCompanies = usePrefetchCompanies();
  const prefetchDashboardStats = usePrefetchDashboardStats();

  // Navigation items
  const navigationItems: NavigationItem[] = [
    {
      label: 'Dashboard',
      href: '/',
      icon: Home,
      isActive: pathname === '/',
    },
    {
      label: 'Companies',
      href: '/companies',
      icon: Building2,
      isActive: pathname === '/companies',
    },
    {
      label: 'Tier 1 Companies',
      href: '/tier-one',
      icon: Target,
      isActive: pathname === '/tier-one',
    },
    {
      label: 'Automation',
      href: '/automation',
      icon: Zap,
      isActive: pathname === '/automation',
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      isActive: pathname === '/settings',
    },
  ];

  // Prefetch data for instant navigation
  useEffect(() => {
    prefetchDashboardStats();
    prefetchCompanies({ page: 1, limit: 50 });
    prefetchCompanies({ page: 1, limit: 50, tool: 'outreach' });
    prefetchCompanies({ page: 1, limit: 50, tool: 'salesloft' });
  }, [prefetchCompanies, prefetchDashboardStats]);

  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-50 shadow-sm",
        isExpanded ? "w-60" : "w-16",
        className
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header with Logo */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="relative group flex-shrink-0">
            <div className="relative p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-sm">
              <Activity className="h-5 w-5 text-white" />
            </div>
          </div>
          
          <div className={cn(
            "flex-1 min-w-0 transition-all duration-300 ease-in-out",
            isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 w-0"
          )}>
            {isExpanded && (
              <>
                <h1 className="text-sm font-semibold text-gray-900 truncate">
                  Sales Tool Detector
                </h1>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs text-gray-500">Live</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    item.isActive
                      ? "bg-gray-900 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-all duration-200",
                    item.isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                  )} />
                  
                  <span className={cn(
                    "truncate transition-all duration-300 ease-in-out",
                    isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 w-0"
                  )}>
                    {item.label}
                  </span>

                  {item.isActive && isExpanded && (
                    <ChevronRight className="h-4 w-4 ml-auto opacity-60 transition-all duration-200" />
                  )}

                  {/* Tooltip for collapsed state */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-3 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                      <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center shadow-sm">
            <User className="h-4 w-4 text-white" />
          </div>
          
          <div className={cn(
            "flex-1 min-w-0 transition-all duration-300 ease-in-out",
            isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 w-0"
          )}>
            {isExpanded && (
              <>
                <p className="text-sm font-medium text-gray-900 truncate">Admin User</p>
                <p className="text-xs text-gray-500 truncate">admin@salestools.com</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}