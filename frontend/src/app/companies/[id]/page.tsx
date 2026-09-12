'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import StatusChip from '@/components/ui/StatusChip';
import * as usersApi from '@/lib/api/usersApi';
import { formatDate } from '@/lib/labels';
import { isEmployeeRole } from '@/lib/roles';
import type { User } from '@/types';
import { useCompanyScope } from './CompanyScopeContext';

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="body2">{label}</Typography>
      <Typography variant="h2">{value}</Typography>
    </Box>
  );
}

export default function CompanyDashboardPage() {
  const { companyId, company, error } = useCompanyScope();
  const [members, setMembers] = React.useState<User[] | null>(null);

  // Fetch members for counts
  React.useEffect(() => {
    usersApi
      .listUsers()
      .then((users) => setMembers(users.filter((u) => u.companyId === companyId)))
      .catch(() => setMembers([]));
  }, [companyId]);

  // For the member whose info we are editing (placeholder: first employee or company admin)
  const [editingMember, setEditingMember] = React.useState<User | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<User>>({});
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const employeeCount = members?.filter((m) => isEmployeeRole(m.role)).length ?? null;
  const adminCount = members?.filter((m) => m.role === 'COMPANY_ADMIN').length ?? null;

  // Start editing a member (demo: pick first employee)
  const startEdit = (member: User) => {
    setEditingMember(member);
    setEditForm({
      jobTitle: member.jobTitle ?? '',
      contributionScore: member.contributionScore,
      attitudeScore: member.attitudeScore,
    });
    setSaveError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    setSaveLoading(true);
    setSaveError(null);

    try {
      await usersApi.updateUser(editingMember.id, {
        jobTitle: editForm.jobTitle ?? undefined,
        contributionScore: editForm.contributionScore ?? undefined,
        attitudeScore: editForm.attitudeScore ?? undefined,
      });
      // Refresh members list
      setMembers((prev) =>
        prev?.map((m) =>
          m.id === editingMember.id ? { ...m, ...editForm } : m
        ) ?? []
      );
      setEditingMember(null);
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Lưu thông tin công ty thất bại');
    } finally {
      setSaveLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingMember(null);
    setSaveError(null);
  };

  return (
    <PageContainer>
      <PageHeader
        title={company?.name ?? 'Tổng quan công ty'}
        subtitle={company ? `Tạo ngày ${formatDate(company.createdAt)}` : undefined}
      />

      {error ? (
        <Card>
          <Typography variant="body1" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        </Card>
      ) : !company ? (
        <PageSkeleton variant="cards" />
      ) : (
        <Stack spacing={3}>
          <Card title="Chỉ số nhanh">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ flexWrap: 'wrap' }}>
              <StatTile label="Nhân sự" value={employeeCount ?? '—'} />
              <StatTile label="Quản trị viên" value={adminCount ?? '—'} />
              <StatTile label="Đánh giá đang chờ duyệt" value="—" />
              <StatTile label="Yêu cầu đang chờ duyệt" value="—" />
            </Stack>
          </Card>

          {/* NEW: Thông tin cá nhân trong công ty - editable */}
          <Card
            title="Thông tin cá nhân trong công ty"
            actions={
              editingMember ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveEdit}
                    disabled={saveLoading}
                  >
                    {saveLoading ? 'Đang lưu...' : 'Lưu'}
                  </Button>
                  <Button variant="text" size="small" onClick={cancelEdit}>
                    Hủy
                  </Button>
                </Box>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => startEdit(members?.[0] ?? { id: '', email: '', role: 'EMPLOYEE' } as User)}
                >
                  Chỉnh sửa
                </Button>
              )
            }
          >
            {saveError && (
              <Typography color="error" sx={{ mb: 2 }}>
                {saveError}
              </Typography>
            )}

            {editingMember ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Thông tin cơ bản</Typography>
                  <TextField
                    label="Vị trí công ty"
                    value={editForm.jobTitle ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    size="small"
                    fullWidth
                    sx={{ mb: 2 }}
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle1" gutterBottom>Điểm cống hiến & Xếp hạng</Typography>
                  <TextField
                    label="Điểm cống hiến"
                    type="number"
                    value={editForm.contributionScore ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, contributionScore: Number(e.target.value) || 0 })}
                    size="small"
                    fullWidth
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    label="Điểm thái độ"
                    type="number"
                    value={editForm.attitudeScore ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, attitudeScore: Number(e.target.value) || 0 })}
                    size="small"
                    fullWidth
                  />
                </Box>

                <Box sx={{ gridColumn: '1 / -1', mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Email công ty</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>
                    {editingMember.email}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Chọn nhân sự để chỉnh sửa thông tin trong công ty (vị trí, chức vụ, điểm cống hiến, thái độ...).
                Email công ty sẽ khác email cá nhân.
              </Typography>
            )}
          </Card>

          <Card
            title="Hoạt động gần đây"
            actions={<StatusChip label="Giao diện minh hoạ" tone="neutral" />}
          >
            <Typography variant="body2">
              Khu vực này sẽ hiển thị hoạt động thực tế của công ty (đánh giá vừa duyệt, yêu cầu mới, nhân
              sự mới tham gia…) khi được nối dữ liệu ở bản cập nhật tiếp theo.
            </Typography>
          </Card>
        </Stack>
      )}
    </PageContainer>
  );
}