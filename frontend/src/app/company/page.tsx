'use client';

import * as React from 'react';
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
import * as companiesApi from '@/lib/api/companiesApi';
import { ApiError } from '@/lib/api/client';
import { colorTokens } from '@/theme/theme';
import type { Company } from '@/types';

/**
 * Company Admin's own "company management" landing — reached by clicking
 * the company identity in the header. Company Admin acts as the company
 * itself, so this is the closest equivalent to an Employee's "Hồ sơ của tôi".
 */
export default function CompanyPage() {
  const [company, setCompany] = React.useState<Company | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: '', industry: '' });
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    companiesApi
      .getMyCompany()
      .then((c) => {
        setCompany(c);
        setForm({ name: c.name, industry: c.industry ?? '' });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được thông tin công ty');
      });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const updated = await companiesApi.updateMyCompany({
        name: form.name,
        industry: form.industry || undefined,
      });
      setCompany(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Không lưu được thông tin công ty');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Quản lý công ty" subtitle="Thông tin công ty của bạn." />

      {error ? (
        <Card>
          <Typography variant="body1" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        </Card>
      ) : !company ? (
        <PageSkeleton variant="form" />
      ) : (
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
            <Avatar sx={{ width: 56, height: 56, bgcolor: colorTokens.primary, color: '#ffffff' }}>
              <ApartmentOutlinedIcon />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h2">{company.name}</Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {company.industry ?? 'Chưa rõ ngành'}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
                Tạo ngày {new Date(company.createdAt).toLocaleDateString('vi-VN')}
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
      )}
    </PageContainer>
  );
}
