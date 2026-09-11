'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PageSkeleton from '@/components/ui/PageSkeleton';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import { listRoles, updateRolePermissions } from '@/lib/api/rolesApi';
import { ROLE_LABEL } from '@/lib/labels';
import type { AdminPermission, RoleDefinition } from '@/types';

const ALL_PERMISSIONS: AdminPermission[] = ['VIEW', 'COLLECT', 'CROSS_ASSESS', 'APPROVE', 'EDIT', 'FULL'];

const PERMISSION_LABELS: Record<AdminPermission, string> = {
  VIEW: 'Xem dữ liệu',
  COLLECT: 'Thu thập dữ liệu',
  CROSS_ASSESS: 'Đánh giá chéo',
  APPROVE: 'Duyệt',
  EDIT: 'Chỉnh sửa',
  FULL: 'Toàn quyền (FULL)',
};

export default function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = React.useState<RoleDefinition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Local state for editing permissions before save
  const [draftPermissions, setDraftPermissions] = React.useState<Record<string, AdminPermission[]>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRoles();
      setRoles(data);
      // Initialize drafts from fetched data
      const drafts: Record<string, AdminPermission[]> = {};
      data.forEach((r) => {
        drafts[r.role] = [...r.permissions];
      });
      setDraftPermissions(drafts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được danh sách phân quyền');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (user && (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN')) {
      void load();
    }
  }, [user, load]);

  const togglePermission = (role: string, perm: AdminPermission) => {
    setDraftPermissions((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(perm)
        ? current.filter((p) => p !== perm)
        : [...current, perm];
      return { ...prev, [role]: next };
    });
    setNotice(null);
  };

  const hasChanges = (role: string) => {
    const original = roles.find((r) => r.role === role)?.permissions ?? [];
    const draft = draftPermissions[role] ?? [];
    if (original.length !== draft.length) return true;
    return original.some((p) => !draft.includes(p)) || draft.some((p) => !original.includes(p));
  };

  const handleSave = async (role: string) => {
    setSaving(role);
    setError(null);
    setNotice(null);
    try {
      const permissions = draftPermissions[role] ?? [];
      await updateRolePermissions(role as RoleDefinition['role'], { permissions });
      setNotice(`Đã lưu quyền cho ${ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được phân quyền');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (role: string) => {
    const original = roles.find((r) => r.role === role)?.permissions ?? [];
    setDraftPermissions((prev) => ({ ...prev, [role]: [...original] }));
    setNotice(null);
  };

  if (!user || (user.role !== 'COMPANY_ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return (
      <PageContainer>
        <PageHeader title="Phân quyền" />
        <Card title="Không có quyền truy cập">
          <Typography variant="body1">
            Trang này chỉ dành cho Quản trị công ty (Company Admin) hoặc Quản trị nền tảng (Super Admin).
          </Typography>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Phân quyền"
        subtitle="Quản lý quyền hạn cho các vai trò HR và BOD trong công ty."
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {notice ? (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}

      {loading ? (
        <PageSkeleton variant="cards" />
      ) : roles.length === 0 ? (
        <Card title="Chưa có vai trò">
          <Typography variant="body2">
            Chưa có định nghĩa phân quyền cho công ty này. Hãy liên hệ Super Admin để khởi tạo.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={3}>
          {roles.map((roleDef) => {
            const roleKey = roleDef.role;
            const draft = draftPermissions[roleKey] ?? [];
            const changed = hasChanges(roleKey);

            return (
              <Card
                key={roleDef.id}
                title={ROLE_LABEL[roleKey] ?? roleKey}
                actions={
                  <Stack direction="row" spacing={1}>
                    {changed ? (
                      <Button size="small" onClick={() => handleReset(roleKey)}>
                        Đặt lại
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleSave(roleKey)}
                      disabled={saving === roleKey || !changed}
                    >
                      {saving === roleKey ? 'Đang lưu...' : 'Lưu'}
                    </Button>
                  </Stack>
                }
              >
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Vai trò: <strong>{roleKey}</strong> — các quyền dưới đây áp dụng cho tất cả người dùng có vai trò này trong công ty.
                </Typography>

                <FormGroup>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1,
                    }}
                  >
                    {ALL_PERMISSIONS.map((perm) => (
                      <FormControlLabel
                        key={perm}
                        control={
                          <Checkbox
                            checked={draft.includes(perm)}
                            onChange={() => togglePermission(roleKey, perm)}
                            size="small"
                          />
                        }
                        label={PERMISSION_LABELS[perm]}
                        sx={{ m: 0 }}
                      />
                    ))}
                  </Box>
                </FormGroup>

                {draft.includes('FULL') ? (
                  <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'warning.main' }}>
                    FULL cấp toàn quyền — người dùng sẽ vượt qua mọi kiểm tra quyền cụ thể.
                  </Typography>
                ) : null}
              </Card>
            );
          })}
        </Stack>
      )}
    </PageContainer>
  );
}
