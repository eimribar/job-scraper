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
import { ExternalLink, Download, Search, Info, ChevronDown, ChevronUp, Sparkles, X, Filter, Home, ChevronRight, CheckCircle2, Circle, Users } from "lucide-react";
import { format } from "date-fns";
import { ToolIcon } from '@/components/tool-logos';
import { Checkbox } from '@/components/ui/checkbox';

interface Company {
  id: string;
  company_name: string;
  company?: string;
  tool_detected: string;
  signal_type: string;
  context: string;
  confidence: string;
  job_title: string;
  job_url: string;
  platform: string;
  identified_date: string;
  leads_generated?: boolean;
  leads_generated_date?: string;
  leads_generated_by?: string;
  lead_gen_notes?: string;
  tier?: string;
  sponsor_1?: string;
  sponsor_2?: string;
  rep_sdr_bdr?: string;
}

interface CompaniesTableProps {
  companies: Company[];
  totalCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: { tool?: string; confidence?: string; search?: string; excludeGoogleSheets?: boolean; leadStatus?: string }) => void;
  onExport: () => void;
  compact?: boolean;
}

export function CompaniesTable({
  companies,
  totalCount,
  currentPage,
  onPageChange,
  onFilterChange,
  onExport,
  compact = false,
}: CompaniesTableProps) {
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [leadFilter, setLeadFilter] = useState<string>('all');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
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
      search: searchTerm || undefined,
      excludeGoogleSheets: filterToUse === 'new',
      leadStatus: leadFilter === 'all' ? undefined : leadFilter,
    });
  };

  const clearAllFilters = () => {
    setToolFilter('all');
    setSearchTerm('');
    setSourceFilter('all');
    setLeadFilter('all');
    onFilterChange({});
  };

  const hasActiveFilters = toolFilter !== 'all' || searchTerm || sourceFilter !== 'all' || leadFilter !== 'all';

  const getToolBadge = (tool: string) => {
    return <ToolIcon tool={tool} showText={false} />;
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

  // Confidence badge removed - not in current data model

  const handleLeadStatusUpdate = async (companyId: string, leadsGenerated: boolean) => {
    try {
      const response = await fetch('/api/companies/update-lead-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          leadsGenerated,
          generatedBy: 'Manual Update'
        })
      });

      if (response.ok) {
        // Refresh the page or update state
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const handleBulkLeadUpdate = async (leadsGenerated: boolean) => {
    if (selectedCompanies.size === 0) return;
    
    try {
      const response = await fetch('/api/companies/update-lead-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyIds: Array.from(selectedCompanies),
          leadsGenerated,
          generatedBy: 'Bulk Update'
        })
      });

      if (response.ok) {
        setSelectedCompanies(new Set());
        window.location.reload();
      }
    } catch (error) {
      console.error('Error bulk updating lead status:', error);
    }
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

      <Card className="border-0 shadow-sm">
        {!compact && (
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Companies</h2>
              <Badge variant="secondary" className="font-medium">
                {totalCount}
              </Badge>
            </div>
            <Button onClick={onExport} variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleFilterChange()}
                className="pl-9 bg-white border-slate-200"
              />
            </div>
          </div>
          
          <Select value={toolFilter} onValueChange={(value) => {
            setToolFilter(value);
            onFilterChange({
              tool: value === 'all' ? undefined : value,
              search: searchTerm || undefined,
              excludeGoogleSheets: sourceFilter === 'new',
              leadStatus: leadFilter === 'all' ? undefined : leadFilter,
            });
          }}>
            <SelectTrigger className="w-[180px] bg-white border-slate-200 hover:bg-slate-50">
              <SelectValue placeholder="Filter by tool" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="all">All Tools</SelectItem>
              <SelectItem value="Outreach.io">Outreach.io</SelectItem>
              <SelectItem value="SalesLoft">SalesLoft</SelectItem>
            </SelectContent>
          </Select>

          <Select value={leadFilter} onValueChange={(value) => {
            setLeadFilter(value);
            onFilterChange({
              tool: toolFilter === 'all' ? undefined : toolFilter,
              search: searchTerm || undefined,
              excludeGoogleSheets: sourceFilter === 'new',
              leadStatus: value === 'all' ? undefined : value,
            });
          }}>
            <SelectTrigger className="w-[180px] bg-white border-slate-200 hover:bg-slate-50">
              <div className="flex items-center gap-2">
                {leadFilter === 'with_leads' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                {leadFilter === 'without_leads' && <Circle className="h-3 w-3 text-orange-600" />}
                <SelectValue placeholder="Lead status" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="all">All Companies</SelectItem>
              <SelectItem value="with_leads">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Has Leads</span>
                </div>
              </SelectItem>
              <SelectItem value="without_leads">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-orange-600" />
                  <span>Needs Leads</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

        </div>
        
        {/* Bulk Actions Bar */}
        {selectedCompanies.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mt-4">
            <span className="text-sm font-medium">{selectedCompanies.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkLeadUpdate(true)}
              className="gap-2"
            >
              <CheckCircle2 className="h-3 w-3" />
              Mark as Leads Generated
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkLeadUpdate(false)}
              className="gap-2"
            >
              <Circle className="h-3 w-3" />
              Mark as No Leads
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedCompanies(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </CardHeader>
        )}
      
      <CardContent className={compact ? "p-0" : "p-0 sm:p-6"}>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px] hidden sm:table-cell">
                  <Checkbox
                    checked={selectedCompanies.size === companies.length && companies.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCompanies(new Set(companies.map(c => c.id)));
                      } else {
                        setSelectedCompanies(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="min-w-[150px]">Company</TableHead>
                <TableHead className="w-[80px]">Leads</TableHead>
                <TableHead className="min-w-[100px]">Tool</TableHead>
                <TableHead className="hidden md:table-cell">Signal</TableHead>
                <TableHead className="hidden lg:table-cell">Tier</TableHead>
                <TableHead className="hidden xl:table-cell">Job Title</TableHead>
                <TableHead className="hidden sm:table-cell">Platform</TableHead>
                <TableHead className="hidden sm:table-cell">Discovered</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
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
                        <Checkbox
                          checked={selectedCompanies.has(company.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedCompanies);
                            if (checked) {
                              newSelected.add(company.id);
                            } else {
                              newSelected.delete(company.id);
                            }
                            setSelectedCompanies(newSelected);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {company.company || company.company_name}
                            {company.context && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRowExpansion(company.id)}
                                className="h-4 w-4 p-0"
                              >
                                {expandedRows.has(company.id) ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="flex gap-2 md:hidden">
                            {getSignalBadge(company.signal_type)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 transition-all hover:scale-110"
                          onClick={() => handleLeadStatusUpdate(company.id, !company.leads_generated)}
                          title={company.leads_generated ? "Mark as needs leads" : "Mark as has leads"}
                        >
                          {company.leads_generated ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 hover:text-green-700" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground hover:text-orange-600 transition-colors" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {getToolBadge(company.tool_detected)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getSignalBadge(company.signal_type)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {company.tier ? (
                          <Badge variant="outline" className="text-xs">
                            {company.tier}
                          </Badge>
                        ) : '-'}
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
                        <TableCell colSpan={10} className="bg-muted/50">
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
        {!compact && totalPages > 1 && (
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