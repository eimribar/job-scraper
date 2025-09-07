'use client';

import { useState } from "react";
import { CompaniesTable } from "./companies-table";
import { useRouter } from "next/navigation";

interface CompaniesTableWrapperProps {
  companies: any[];
  totalCount: number;
  compact?: boolean;
}

export function CompaniesTableWrapper({ companies, totalCount, compact = false }: CompaniesTableWrapperProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  
  const handleFilterChange = (filters: { tool?: string; confidence?: string; search?: string }) => {
    // For dashboard view, navigate to companies page with filters
    const params = new URLSearchParams();
    if (filters.tool) params.set('tool', filters.tool);
    if (filters.confidence) params.set('confidence', filters.confidence);
    if (filters.search) params.set('search', filters.search);
    
    router.push(`/companies?${params.toString()}`);
  };
  
  const handlePageChange = (page: number) => {
    // For dashboard view, navigate to companies page
    router.push(`/companies?page=${page}`);
  };
  
  const handleExport = async () => {
    // Navigate to companies page for export
    router.push('/companies');
  };
  
  return (
    <CompaniesTable
      companies={companies}
      totalCount={totalCount}
      currentPage={currentPage}
      onPageChange={handlePageChange}
      onFilterChange={handleFilterChange}
      onExport={handleExport}
      compact={compact}
    />
  );
}