'use client';

import { useState } from "react";
import { CompaniesTable } from "@/components/companies/companies-table-simple";
import { useRouter } from "next/navigation";

interface CompaniesClientProps {
  companies: any[];
  totalCount: number;
  currentPage: number;
  initialTool?: string;
  initialSearch?: string;
}

export function CompaniesClient({
  companies,
  totalCount,
  currentPage,
  initialTool,
  initialSearch,
}: CompaniesClientProps) {
  const router = useRouter();
  
  const handleFilterChange = (filters: { tool?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters.tool) params.set('tool', filters.tool);
    if (filters.search) params.set('search', filters.search);
    params.set('page', '1');
    
    router.push(`/companies?${params.toString()}`);
  };
  
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams();
    if (initialTool) params.set('tool', initialTool);
    if (initialSearch) params.set('search', initialSearch);
    params.set('page', page.toString());
    
    router.push(`/companies?${params.toString()}`);
  };
  
  const handleExport = async () => {
    const params = new URLSearchParams();
    if (initialTool) params.set('tool', initialTool);
    params.set('format', 'csv');
    
    // Create a download link
    const response = await fetch(`/api/export?${params.toString()}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companies-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  
  return (
    <CompaniesTable
      companies={companies}
      totalCount={totalCount}
      currentPage={currentPage}
      onPageChange={handlePageChange}
      onFilterChange={handleFilterChange}
      onExport={handleExport}
    />
  );
}