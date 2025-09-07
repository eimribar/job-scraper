'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Settings, Activity, Building2, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();
  
  return (
    <header className="border-b bg-white/70 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative p-2.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Sales Tool Detector
                </h1>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live Monitoring
                  </span>
                  <span className="flex items-center gap-2">
                    <Image src="/logos/outreach_transparent.png" alt="Outreach" width={40} height={12} className="object-contain opacity-60" />
                    <span className="text-muted-foreground">•</span>
                    <Image src="/logos/salesloft_transparent.png" alt="SalesLoft" width={40} height={12} className="object-contain opacity-60" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
          
          <nav className="flex items-center gap-1">
            <Link href="/">
              <Button 
                variant={pathname === '/' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={cn(
                  "gap-2",
                  pathname === '/' ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "hover:bg-slate-50"
                )}
              >
                <Home className="h-3 w-3" />
                Dashboard
              </Button>
            </Link>
            
            <Link href="/companies">
              <Button 
                variant={pathname === '/companies' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={cn(
                  "gap-2",
                  pathname === '/companies' ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "hover:bg-slate-50"
                )}
              >
                <Building2 className="h-3 w-3" />
                Companies
              </Button>
            </Link>
            
            <Link href="/automation">
              <Button 
                variant={pathname === '/automation' ? 'default' : 'ghost'} 
                size="sm" 
                className={cn(
                  "gap-2",
                  pathname === '/automation' ? "bg-gradient-to-r from-purple-600 to-pink-600" : "hover:bg-purple-50"
                )}
              >
                <Zap className="h-3 w-3" />
                Automation
              </Button>
            </Link>
            
            <Link href="/settings">
              <Button 
                variant={pathname === '/settings' ? 'default' : 'ghost'} 
                size="icon" 
                className={cn(
                  "h-8 w-8",
                  pathname === '/settings' ? "bg-gradient-to-r from-slate-600 to-slate-700" : "hover:bg-slate-100"
                )}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}