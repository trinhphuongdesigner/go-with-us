'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import * as companiesApi from '@/lib/api/companiesApi';
import { ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/labels';
import { colorTokens } from '@/theme/theme';
import { useCompanyScope } from '../CompanyScopeContext';

export default function CompanySettingsPage() {
  const router = useRouter();
  const { ask, dialog } = useConfirmDialog();
  const { companyId, company, error, refresh } = useCompanyScope();

  const [form, setForm] = React.useState({ name: '', industry: '' });
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (company) {
      setForm({ name: company.name, industry: company.industry ?? '' });
    }
  }, [company]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await companiesApi.updateCompany(companyId, {
        name: form.name,
        industry: form.industry || undefined,
      });
      refresh();
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Không lưu được thông tin công ty');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await companiesApi.deleteCompany(companyId);
      router.push('/companies');
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Không xóa được công ty');
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Cài đặt công ty" subtitle="Thông tin công ty và các thao tác quản trị." />

      {error ? (
        <Card>
          <Typography variant="body1" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        </Card>
      ) : !company ? (
        <PageSkeleton variant="form" />
      ) : (
        <Stack spacing={3}>
          <Card
            title="Thông tin công ty"
            actions={
              editing ? null : (
                <Button variant="outlined" onClick={() => setEditing(true)}>
                  Chỉnh sửa
                </Button>
              )
            }
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ alignItems: { sm: 'center' }, mb: 3 }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: colorTokens.accent, color: colorTokens.accentContrast }}>
                <ApartmentOutlinedIcon />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h2">{company.name}</Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>
                  {company.industry ?? 'Chưa rõ ngành'}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
                  Tạo ngày {formatDate(company.createdAt)}
                </Typography>
              </Box>
            </Stack>

            {editing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
                <TextField
                  label="Tên công ty"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  size="small"
                />
                <TextField
                  label="Ngành (tuỳ chọn)"
                  value={form.industry}
                  onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
                  size="small"
                />
                {saveError ? (
                  <Typography variant="body2" sx={{ color: 'error.main' }}>
                    {saveError}
                  </Typography>
                ) : null}
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button variant="contained" disabled={saving || !form.name} onClick={handleSave}>
                    Lưu
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => {
                      setEditing(false);
                      setForm({ name: company.name, industry: company.industry ?? '' });
                    }}
                  >
                    Hủy
                  </Button>
                </Box>
              </Box>
            ) : null}
          </Card>

          <Card title="Vùng nguy hiểm">
            <Typography variant="body2" sx={{ mb: 2 }}>
              Xóa công ty sẽ xóa toàn bộ tài khoản quản trị liên kết. Hành động này không thể hoàn tác.
            </Typography>
            {deleteError ? (
              <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
                {deleteError}
              </Typography>
            ) : null}
            <Button
              variant="outlined"
              color="error"
              onClick={() =>
                ask({
                  title: 'Xóa công ty',
                  description: `Xóa “${company.name}” và tài khoản quản trị? Hành động này không thể hoàn tác.`,
                  confirmLabel: 'Xóa',
                  danger: true,
                  onConfirm: handleDelete,
                })
              }
            >
              Xóa công ty
            </Button>
          </Card>
        </Stack>
      )}
      {dialog}
    </PageContainer>
  );
}
