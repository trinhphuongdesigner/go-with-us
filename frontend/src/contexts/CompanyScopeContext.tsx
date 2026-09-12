'use client';

import * as React from 'react';
import * as companiesApi from '@/lib/api/companiesApi';
import { ApiError } from '@/lib/api/client';
import type { Company } from '@/types';

interface CompanyScopeValue {
  companyId: string;
  company: Company | null;
  error: string | null;
  refresh: () => void;
}

const CompanyScopeContext = React.createContext<CompanyScopeValue | null>(null);

/** Shared company fetch for every tab under a per-company scope (/companies/[id], /my-companies/[id]) — set by CompanyScopeProvider. */
export function useCompanyScope() {
  const ctx = React.useContext(CompanyScopeContext);
  if (!ctx) {
    throw new Error('useCompanyScope must be used within CompanyScopeProvider');
  }
  return ctx;
}

export function CompanyScopeProvider({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const [company, setCompany] = React.useState<Company | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    companiesApi
      .getCompany(companyId)
      .then(setCompany)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được thông tin công ty');
      });
  }, [companyId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <CompanyScopeContext.Provider value={{ companyId, company, error, refresh }}>
      {children}
    </CompanyScopeContext.Provider>
  );
}
