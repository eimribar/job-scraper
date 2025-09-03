'use client';

import React, { useState } from "react";
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
import { ExternalLink, Download, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Company {
  id: string;
  company: string;
  tool_detected: string;
  context: string;
  job_title: string;
  job_url: string;
  identified_date: string;
}

interface CompaniesTableProps {
  companies: Company[];
  totalCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: { tool?: string; search?: string }) => void;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const itemsPerPage = 50;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleFilterChange = () => {
    onFilterChange({
      tool: toolFilter === 'all' ? undefined : toolFilter,
      search: searchTerm || undefined,
    });
  };

  const clearFilters = () => {
    setToolFilter('all');
    setSearchTerm('');
    onFilterChange({});
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

  const hasActiveFilters = toolFilter !== 'all' || searchTerm;

  const getToolBadge = (tool: string) => {
    if (tool === 'Outreach.io') {
      return <span className="text-green-600 font-medium">🎯 Outreach</span>;
    }
    if (tool === 'SalesLoft') {
      return <span className="text-blue-600 font-medium">⚡ SalesLoft</span>;
    }
    if (tool === 'Both') {
      return <span className="text-purple-600 font-medium">🎯⚡ Both</span>;
    }
    return <span>{tool}</span>;
  };

  // Get tool statistics
  const toolStats = companies.reduce((acc, company) => {
    acc[company.tool_detected] = (acc[company.tool_detected] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Outreach.io</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {toolStats['Outreach.io'] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">SalesLoft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {toolStats['SalesLoft'] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Both Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {toolStats['Both'] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleFilterChange()}
                className="pl-10"
              />
            </div>
            
            <Select value={toolFilter} onValueChange={setToolFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by tool" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tools</SelectItem>
                <SelectItem value="Outreach.io">🎯 Outreach.io</SelectItem>
                <SelectItem value="SalesLoft">⚡ SalesLoft</SelectItem>
                <SelectItem value="Both">🎯⚡ Both</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleFilterChange} variant="default">
              Apply Filters
            </Button>

            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            )}

            <Button onClick={onExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[250px]">Company</TableHead>
                  <TableHead className="w-[150px]">Tool</TableHead>
                  <TableHead className="w-[250px]">Job Title</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead className="w-[100px]">Job Link</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <React.Fragment key={company.id}>
                    <TableRow className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        {company.company}
                      </TableCell>
                      <TableCell>
                        {getToolBadge(company.tool_detected)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {company.job_title}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {expandedRows.has(company.id) 
                              ? company.context 
                              : (company.context?.substring(0, 150) + (company.context?.length > 150 ? '...' : ''))}
                          </span>
                          {company.context?.length > 150 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(company.id)}
                            >
                              {expandedRows.has(company.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.job_url && (
                          <a
                            href={company.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(company.identified_date), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} companies
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                  const pageNum = currentPage - 2 + idx;
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}