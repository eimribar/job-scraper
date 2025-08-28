'use client';

import React, { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ExternalLink, Download, Search, Info, ChevronDown, ChevronUp, Sparkles, X, Filter, Home, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Company {
  id: string;
  company_name: string;
  tool_detected: string;
  signal_type: string;
  context: string;
  confidence: string;
  job_title: string;
  job_url: string;
  platform: string;
  identified_date: string;
}

interface CompaniesTableProps {
  companies: Company[];
  totalCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: { tool?: string; confidence?: string; search?: string; excludeGoogleSheets?: boolean }) => void;
  onExport: () => void;
}

export function CompaniesTable({
  companies,
  totalCount,
  currentPage,
  onPageChange,
  onFilterChange,
  onExport,
}: CompaniesTableProps) {
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'new' | 'imported'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    total: 0,
    newDiscoveries: 0,
    googleSheets: 0
  });
  
  // Fetch stats dynamically
  useEffect(() => {
    fetch('/api/companies/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats);
        }
      })
      .catch(err => console.error('Failed to fetch stats:', err));
  }, []);

  const itemsPerPage = 20;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleFilterChange = (newSourceFilter?: 'all' | 'new' | 'imported') => {
    const filterToUse = newSourceFilter !== undefined ? newSourceFilter : sourceFilter;
    onFilterChange({
      tool: toolFilter === 'all' ? undefined : toolFilter,
      confidence: confidenceFilter === 'all' ? undefined : confidenceFilter,
      search: searchTerm || undefined,
      excludeGoogleSheets: filterToUse === 'new',
    });
  };

  const clearAllFilters = () => {
    setToolFilter('all');
    setConfidenceFilter('all');
    setSearchTerm('');
    setSourceFilter('all');
    onFilterChange({});
  };

  const hasActiveFilters = toolFilter !== 'all' || confidenceFilter !== 'all' || searchTerm || sourceFilter !== 'all';

  const getToolBadge = (tool: string) => {
    if (tool === 'Outreach.io') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
          🎯 Outreach
        </Badge>
      );
    }
    if (tool === 'SalesLoft') {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
          ⚡ SalesLoft
        </Badge>
      );
    }
    return <Badge variant="outline">{tool}</Badge>;
  };

  const getSignalBadge = (signal: string) => {
    const variants = {
      required: { variant: 'destructive', label: 'Required' },
      preferred: { variant: 'default', label: 'Preferred' },
      stack_mention: { variant: 'secondary', label: 'Stack Mention' },
    } as const;

    const config = variants[signal as keyof typeof variants];
    if (!config) return <Badge variant="outline">{signal}</Badge>;

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-50 text-green-700 border-green-200',
      medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      low: 'bg-gray-50 text-gray-700 border-gray-200',
    };

    const colorClass = colors[confidence as keyof typeof colors] || 'bg-gray-50 text-gray-700';

    return (
      <Badge variant="outline" className={colorClass}>
        {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
      </Badge>
    );
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between p-4 bg-background border-b">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <a href="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="h-4 w-4" />
            <span>Dashboard</span>
          </a>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Companies</span>
          {sourceFilter !== 'all' && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground">
                {sourceFilter === 'new' ? 'New Discoveries' : 'Google Sheets Import'}
              </span>
            </>
          )}
        </div>
        {hasActiveFilters && (
          <Button 
            onClick={clearAllFilters}
            variant="ghost" 
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Clear all filters
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              Companies Using Sales Tools
              <Badge variant="secondary" className="ml-2">
                {totalCount} total
              </Badge>
            </CardTitle>
            <Button onClick={onExport} variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          
          {/* Professional Filter Buttons */}
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Data Source</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600 border-green-200">
                  107 New
                </Badge>
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  690 Imported
                </Badge>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant={sourceFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSourceFilter('all');
                  handleFilterChange('all');
                }}
                className="min-w-[120px]"
              >
                All Companies
                <Badge variant="secondary" className="ml-2">{stats.total || totalCount}</Badge>
              </Button>
              
              <Button
                variant={sourceFilter === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSourceFilter('new');
                  handleFilterChange('new');
                }}
                className="min-w-[140px]"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                New Discoveries
                <Badge variant="secondary" className="ml-2">{stats.newDiscoveries}</Badge>
              </Button>
              
              <Button
                variant={sourceFilter === 'imported' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSourceFilter('imported');
                  handleFilterChange('imported');
                }}
                className="min-w-[140px]"
              >
                Google Sheets
                <Badge variant="secondary" className="ml-2">{stats.googleSheets}</Badge>
              </Button>
            </div>
          </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleFilterChange()}
                className="pl-9"
              />
            </div>
          </div>
          
          <Select value={toolFilter} onValueChange={(value) => {
            setToolFilter(value);
            onFilterChange({
              tool: value === 'all' ? undefined : value,
              confidence: confidenceFilter === 'all' ? undefined : confidenceFilter,
              search: searchTerm || undefined,
              excludeGoogleSheets: sourceFilter === 'new',
            });
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by tool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tools</SelectItem>
              <SelectItem value="Outreach.io">Outreach.io</SelectItem>
              <SelectItem value="SalesLoft">SalesLoft</SelectItem>
            </SelectContent>
          </Select>

          <Select value={confidenceFilter} onValueChange={(value) => {
            setConfidenceFilter(value);
            onFilterChange({
              tool: toolFilter === 'all' ? undefined : toolFilter,
              confidence: value === 'all' ? undefined : value,
              search: searchTerm || undefined,
              excludeGoogleSheets: sourceFilter === 'new',
            });
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

        </div>
      </CardHeader>
      
      <CardContent className="p-0 sm:p-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px] hidden sm:table-cell"></TableHead>
                <TableHead className="min-w-[150px]">Company</TableHead>
                <TableHead className="min-w-[100px]">Tool</TableHead>
                <TableHead className="hidden md:table-cell">Signal</TableHead>
                <TableHead className="hidden lg:table-cell">Confidence</TableHead>
                <TableHead className="hidden xl:table-cell">Job Title</TableHead>
                <TableHead className="hidden sm:table-cell">Platform</TableHead>
                <TableHead className="hidden sm:table-cell">Discovered</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No companies found matching your criteria</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <React.Fragment key={company.id}>
                    <TableRow className="hover:bg-muted/50 transition-colors">
                      <TableCell className="hidden sm:table-cell">
                        {company.context && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(company.id)}
                            className="h-8 w-8 p-0"
                          >
                            {expandedRows.has(company.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          {company.company_name}
                          <div className="flex gap-2 md:hidden">
                            {getSignalBadge(company.signal_type)}
                            {getConfidenceBadge(company.confidence)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getToolBadge(company.tool_detected)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getSignalBadge(company.signal_type)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {getConfidenceBadge(company.confidence)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate hidden xl:table-cell">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{company.job_title || '-'}</span>
                            </TooltipTrigger>
                            {company.job_title && (
                              <TooltipContent className="max-w-[300px]">
                                <p>{company.job_title}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {company.platform || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {company.identified_date ? format(new Date(company.identified_date), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {company.job_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-8 w-8 p-0"
                          >
                            <a
                              href={company.job_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View job posting"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(company.id) && company.context && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/50">
                          <div className="p-4">
                            <div className="flex items-start gap-2">
                              <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              <div className="space-y-2">
                                <p className="font-medium text-sm">Detection Context:</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {company.context}
                                </p>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex-1 text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} companies
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      className="w-8"
                    >
                      {page}
                    </Button>
                  );
                })}
                {totalPages > 5 && <span className="text-muted-foreground">...</span>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}