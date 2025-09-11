'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Search,
  Activity,
  Settings,
  Key,
  FileText,
  BarChart3,
  AlertCircle,
  Database,
  Globe,
  Target,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'System overview and metrics'
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Manage user accounts'
  },
  {
    name: 'Companies',
    href: '/admin/companies',
    icon: Building2,
    description: 'Manage identified companies'
  },
  {
    name: 'Jobs',
    href: '/admin/jobs',
    icon: FileText,
    description: 'Job scraping management'
  },
  {
    name: 'Search Terms',
    href: '/admin/search-terms',
    icon: Search,
    description: 'Configure search parameters'
  },
  {
    name: 'Scraping',
    href: '/admin/scraping',
    icon: Globe,
    description: 'Scraping operations'
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    description: 'Performance analytics'
  },
  {
    name: 'Activity Logs',
    href: '/admin/logs',
    icon: Activity,
    description: 'System activity monitoring'
  },
  {
    name: 'Automation',
    href: '/admin/automation',
    icon: Zap,
    description: 'Automation workflows'
  },
  {
    name: 'API Keys',
    href: '/admin/api-keys',
    icon: Key,
    description: 'API key management'
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    description: 'System configuration'
  }
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
                          (item.href !== '/admin' && pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon
                className={cn(
                  'mr-3 h-5 w-5 transition-colors',
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-400 group-hover:text-gray-500'
                )}
              />
              <div className="flex-1">
                <div className={cn(
                  'font-medium',
                  isActive ? 'text-blue-900' : 'text-gray-900'
                )}>
                  {item.name}
                </div>
                <div className={cn(
                  'text-xs mt-0.5',
                  isActive ? 'text-blue-600' : 'text-gray-500'
                )}>
                  {item.description}
                </div>
              </div>
              {isActive && (
                <div className="w-1 h-8 bg-blue-600 rounded-full -mr-3 ml-2" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div className="text-xs text-gray-600">
            System Operational
          </div>
        </div>
      </div>
    </aside>
  );
}