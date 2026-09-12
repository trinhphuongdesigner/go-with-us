'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { CompanyScopeProvider } from '@/contexts/CompanyScopeContext';

/**
 * Shell for the employee-facing per-company scope (see myCompanyNavItems in
 * AppShell.tsx for the matching sidebar). Just data scope — chrome stays in
 * the root AppShell — so every tab (currently only Cross Assessment) shares
 * one company fetch.
 */
export default function MyCompanyDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  return <CompanyScopeProvider companyId={companyId}>{children}</CompanyScopeProvider>;
}
