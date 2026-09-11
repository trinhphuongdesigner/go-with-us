'use client';

import * as React from 'react';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import IconButton from '@/components/ui/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
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
  const { ask, dialog } = useConfirmDialog();
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    try {
      await companiesApi.deleteCompany(id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được công ty');
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

        <Card title="Công ty">
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : !companies ? (
            <PageSkeleton variant="table" rows={5} embedded />
          ) : companies.length === 0 ? (
            <Typography variant="body1">Chưa có công ty nào.</Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Ngành</TableCell>
                  <TableCell>Ngày tạo</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id} hover>
                    <TableCell>{company.name}</TableCell>
                    <TableCell>{company.industry ?? '—'}</TableCell>
                    <TableCell>{new Date(company.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Xóa công ty">
                        <IconButton
                          size="sm"
                          aria-label="Xóa công ty"
                          onClick={() =>
                            ask({
                              title: 'Xóa công ty',
                              description: `Xóa “${company.name}” và tài khoản quản trị? Hành động này không thể hoàn tác.`,
                              confirmLabel: 'Xóa',
                              danger: true,
                              onConfirm: () => handleDelete(company.id),
                            })
                          }
                        >
                          <DeleteOutlineOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
        {dialog}
    </PageContainer>
  );
}
