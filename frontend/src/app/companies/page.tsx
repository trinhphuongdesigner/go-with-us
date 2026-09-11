'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import ViewToggle, { type ViewMode } from '@/components/ui/ViewToggle';
import { colorTokens, radiusTokens } from '@/theme/theme';
import * as companiesApi from '@/lib/api/companiesApi';
import { ApiError } from '@/lib/api/client';
import type { Company } from '@/types';

const EMPTY_FORM = {
  name: '',
  industry: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');

  const refresh = React.useCallback(() => {
    companiesApi
      .listCompanies()
      .then(setCompanies)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh sách công ty');
      });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleField = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreate = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await companiesApi.createCompany({
        name: form.name,
        industry: form.industry || undefined,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setForm(EMPTY_FORM);
      setFormOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không tạo được công ty');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
        <PageHeader
          title="Công ty"
          subtitle="Mọi công ty trên nền tảng."
          actions={
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => setFormOpen((v) => !v)}
            >
              Công ty mới
            </Button>
          }
        />

        {formOpen ? (
          <Card title="Tạo công ty" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
              <TextField label="Tên công ty" value={form.name} onChange={handleField('name')} size="small" />
              <TextField label="Ngành (tuỳ chọn)" value={form.industry} onChange={handleField('industry')} size="small" />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Tài khoản quản trị công ty
              </Typography>
              <TextField label="Tên quản trị" value={form.adminName} onChange={handleField('adminName')} size="small" />
              <TextField label="Email quản trị" value={form.adminEmail} onChange={handleField('adminEmail')} size="small" />
              <TextField
                label="Mật khẩu quản trị"
                type="password"
                value={form.adminPassword}
                onChange={handleField('adminPassword')}
                size="small"
              />
              {formError ? (
                <Typography variant="body2" sx={{ color: 'error.main' }}>
                  {formError}
                </Typography>
              ) : null}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="contained"
                  disabled={submitting || !form.name || !form.adminName || !form.adminEmail || !form.adminPassword}
                  onClick={handleCreate}
                >
                  Tạo
                </Button>
                <Button variant="text" onClick={() => setFormOpen(false)}>
                  Hủy
                </Button>
              </Box>
            </Box>
          </Card>
        ) : null}

        <Card title="Công ty" actions={<ViewToggle value={viewMode} onChange={setViewMode} />}>
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : !companies ? (
            <PageSkeleton variant={viewMode === 'card' ? 'cards' : 'table'} rows={5} embedded />
          ) : companies.length === 0 ? (
            <Typography variant="body1">Chưa có công ty nào.</Typography>
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
                  onClick={() => router.push(`/companies/${company.id}`)}
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
                  <Typography variant="body2" sx={{ fontSize: 12, mt: 'auto' }}>
                    Tạo ngày {new Date(company.createdAt).toLocaleDateString('vi-VN')}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Ngành</TableCell>
                  <TableCell>Ngày tạo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((company) => (
                  <TableRow
                    key={company.id}
                    hover
                    onClick={() => router.push(`/companies/${company.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{company.name}</TableCell>
                    <TableCell>{company.industry ?? '—'}</TableCell>
                    <TableCell>{new Date(company.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
    </PageContainer>
  );
}
