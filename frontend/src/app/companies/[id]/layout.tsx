'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { CompanyScopeProvider } from './CompanyScopeContext';

/**
 * Tier-2 shell for Super Admin's per-company management area (see
 * companyNavItems in AppShell.tsx for the matching sidebar). Just data
 * scope — chrome stays in the root AppShell — so every tab (dashboard,
 * employees, assessments, requests, settings) shares one company fetch.
 */
export default function CompanyDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  return <CompanyScopeProvider companyId={companyId}>{children}</CompanyScopeProvider>;
}
