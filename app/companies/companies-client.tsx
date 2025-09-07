'use client';

import { useState } from "react";
import { CompaniesTableWrapper } from "@/components/companies/companies-table-wrapper";
import { useRouter } from "next/navigation";

interface CompaniesClientProps {
  companies: any[];
  totalCount: number;
  currentPage: number;
  initialTool?: string;
  initialSearch?: string;
  dashboardStats: {
    totalCompanies: number;
    outreachCount: number;
    salesLoftCount: number;
    bothCount: number;
  };
}

export function CompaniesClient({
  companies,
  totalCount,
  currentPage,
  initialTool,
  initialSearch,
  dashboardStats,
}: CompaniesClientProps) {
  // Use the CompaniesTableWrapper which handles routing and performance optimizations
  return (
    <CompaniesTableWrapper
      companies={companies}
      totalCount={totalCount}
      compact={false}
    />
  );
}