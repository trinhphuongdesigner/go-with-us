'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { CompanyScopeProvider } from '@/contexts/CompanyScopeContext';

/**
 * Shell for Super Admin's single per-company screen (info + reassign/reset
 * the Company Admin account) — chrome stays in the root AppShell, this just
 * provides the company data fetch to the page below.
 */
export default function CompanyDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  return <CompanyScopeProvider companyId={companyId}>{children}</CompanyScopeProvider>;
}
