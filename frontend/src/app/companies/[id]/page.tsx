'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineOutlined';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import * as companiesApi from '@/lib/api/companiesApi';
import * as usersApi from '@/lib/api/usersApi';
import { ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/labels';
import { colorTokens } from '@/theme/theme';
import { useCompanyScope } from '@/contexts/CompanyScopeContext';
import type { User } from '@/types';

/**
 * Super Admin's only per-company screen: view/edit company info, delete the
 * company, and reassign/reset its Company Admin account. Super Admin does
 * not manage employees, assessments, or requests for a company — that's
 * Company Admin/HR/BOD territory (see AppShell's employee-facing
 * /my-companies scope).
 */
export default function CompanyDetailPage() {
  const router = useRouter();
  const { ask, dialog } = useConfirmDialog();
  const { companyId, company, error, refresh } = useCompanyScope();

  const [form, setForm] = React.useState({ name: '', industry: '' });
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [admins, setAdmins] = React.useState<User[] | undefined>(undefined);
  const [editingAdminId, setEditingAdminId] = React.useState<string | null>(null);
  const [adminForm, setAdminForm] = React.useState({ name: '', email: '' });
  const [savingAdmin, setSavingAdmin] = React.useState(false);
  const [adminError, setAdminError] = React.useState<string | null>(null);
  const [adminNotice, setAdminNotice] = React.useState<string | null>(null);
  const [passwordByAdminId, setPasswordByAdminId] = React.useState<Record<string, string>>({});
  const [resettingAdminId, setResettingAdminId] = React.useState<string | null>(null);

  const loadAdmins = React.useCallback(() => {
    usersApi
      .listUsers({ role: 'COMPANY_ADMIN', companyId })
      .then(setAdmins)
      .catch(() => setAdmins([]));
  }, [companyId]);

  React.useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

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

  const handleSaveAdmin = async (adminId: string) => {
    setAdminError(null);
    setAdminNotice(null);
    setSavingAdmin(true);
    try {
      const updated = await usersApi.updateUser(adminId, {
        name: adminForm.name,
        email: adminForm.email,
      });
      setAdmins((prev) => prev?.map((a) => (a.id === adminId ? updated : a)));
      setEditingAdminId(null);
      setAdminNotice('Đã cập nhật tài khoản quản trị.');
    } catch (err) {
      setAdminError(err instanceof ApiError ? err.message : 'Không cập nhật được tài khoản quản trị');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleResetPassword = async (adminId: string) => {
    const password = passwordByAdminId[adminId];
    if (!password) return;
    setAdminError(null);
    setAdminNotice(null);
    setResettingAdminId(adminId);
    try {
      await usersApi.resetPassword(adminId, password);
      setPasswordByAdminId((prev) => ({ ...prev, [adminId]: '' }));
      setAdminNotice('Đã đặt lại mật khẩu quản trị viên.');
    } catch (err) {
      setAdminError(err instanceof ApiError ? err.message : 'Không đặt lại được mật khẩu');
    } finally {
      setResettingAdminId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={company?.name ?? 'Công ty'}
        subtitle="Thông tin công ty và tài khoản quản trị."
        actions={
          <Button variant="outlined" onClick={() => router.push('/companies')}>
            ← Tất cả công ty
          </Button>
        }
      />

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
                <Button
                  variant="outlined"
                  onClick={() => {
                    setForm({ name: company.name, industry: company.industry ?? '' });
                    setEditing(true);
                  }}
                >
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

          <Card title="Tài khoản quản trị công ty">
            {adminError ? (
              <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
                {adminError}
              </Typography>
            ) : null}
            {adminNotice ? (
              <Typography variant="body2" sx={{ color: 'success.main', mb: 2 }}>
                {adminNotice}
              </Typography>
            ) : null}

            {admins === undefined ? (
              <PageSkeleton variant="form" embedded />
            ) : admins.length === 0 ? (
              <Typography variant="body2">Công ty này chưa có tài khoản quản trị.</Typography>
            ) : (
              <Stack divider={<Box sx={{ borderTop: `1px solid ${colorTokens.border}` }} />} spacing={3}>
                {admins.map((admin) => {
                  const isEditing = editingAdminId === admin.id;
                  return (
                    <Stack key={admin.id} spacing={2} sx={{ pt: 2, '&:first-of-type': { pt: 0 } }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ alignItems: { sm: 'center' } }}>
                        <Avatar sx={{ width: 48, height: 48, bgcolor: colorTokens.primarySubtle, color: colorTokens.primary }}>
                          <PersonOutlineIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {isEditing ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 420 }}>
                              <TextField
                                label="Tên"
                                value={adminForm.name}
                                onChange={(e) => setAdminForm((prev) => ({ ...prev, name: e.target.value }))}
                                size="small"
                              />
                              <TextField
                                label="Email"
                                value={adminForm.email}
                                onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
                                size="small"
                              />
                              <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Button
                                  variant="contained"
                                  disabled={savingAdmin || !adminForm.name || !adminForm.email}
                                  onClick={() => handleSaveAdmin(admin.id)}
                                >
                                  Lưu
                                </Button>
                                <Button variant="text" onClick={() => setEditingAdminId(null)}>
                                  Hủy
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {admin.name}
                              </Typography>
                              <Typography variant="body2">{admin.email}</Typography>
                            </>
                          )}
                        </Box>
                        {!isEditing ? (
                          <Button
                            variant="outlined"
                            onClick={() => {
                              setAdminForm({ name: admin.name, email: admin.email });
                              setEditingAdminId(admin.id);
                            }}
                          >
                            Chỉnh sửa
                          </Button>
                        ) : null}
                      </Stack>

                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Đặt lại mật khẩu
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                          <TextField
                            label="Mật khẩu mới"
                            type="password"
                            value={passwordByAdminId[admin.id] ?? ''}
                            onChange={(e) =>
                              setPasswordByAdminId((prev) => ({ ...prev, [admin.id]: e.target.value }))
                            }
                            size="small"
                            sx={{ maxWidth: 280 }}
                          />
                          <Button
                            variant="outlined"
                            disabled={
                              resettingAdminId === admin.id ||
                              (passwordByAdminId[admin.id] ?? '').length < 8
                            }
                            onClick={() => handleResetPassword(admin.id)}
                          >
                            Đặt lại mật khẩu
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            )}
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
                  description: `Xóa "${company.name}" và tài khoản quản trị? Hành động này không thể hoàn tác.`,
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
