'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ViewToggle, { type ViewMode } from '@/components/ui/ViewToggle';
import { colorTokens, radiusTokens } from '@/theme/theme';
import * as companiesApi from '@/lib/api/companiesApi';
import { ApiError } from '@/lib/api/client';
import type { Company } from '@/types';

/**
 * Employee-facing company picker — a person can belong to more than one
 * company (CompanyMembership), so this is the entry point into a per-
 * company scope (e.g. Cross Assessment lives inside /my-companies/:id).
 * Styled like the Super Admin company list at /companies, but scoped to
 * "companies I belong to" and with no create-company action.
 */
export default function MyCompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');

  React.useEffect(() => {
    companiesApi
      .listMyCompanies()
      .then(setCompanies)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh sách công ty');
      });
  }, []);

  return (
    <PageContainer>
      <PageHeader title="Công ty" subtitle="Các công ty bạn thuộc về." />

      <Card title="Công ty" actions={<ViewToggle value={viewMode} onChange={setViewMode} />}>
        {error ? (
          <Typography variant="body2" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        ) : !companies ? (
          <PageSkeleton variant={viewMode === 'card' ? 'cards' : 'table'} rows={5} embedded />
        ) : companies.length === 0 ? (
          <Typography variant="body1">Bạn chưa thuộc công ty nào.</Typography>
        ) : viewMode === 'card' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 2,
            }}
          >
            {companies.map((company) => (
              <Box
                key={company.id}
                onClick={() => router.push(`/my-companies/${company.id}`)}
                sx={{
                  border: `1px solid ${colorTokens.border}`,
                  borderRadius: `${radiusTokens.md}px`,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                  '&:hover': { borderColor: colorTokens.primary },
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: `${radiusTokens.sm}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: colorTokens.primarySubtle,
                    color: colorTokens.primary,
                    flexShrink: 0,
                  }}
                >
                  <ApartmentOutlinedIcon fontSize="small" />
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {company.name}
                </Typography>
                <Typography variant="body2">{company.industry ?? 'Chưa rõ ngành'}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Ngành</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.map((company) => (
                <TableRow
                  key={company.id}
                  hover
                  onClick={() => router.push(`/my-companies/${company.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{company.name}</TableCell>
                  <TableCell>{company.industry ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
