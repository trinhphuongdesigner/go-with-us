'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import PageSkeleton from '@/components/ui/PageSkeleton';
import * as companiesApi from '@/lib/api/companiesApi';
import * as usersApi from '@/lib/api/usersApi';
import { ApiError } from '@/lib/api/client';
import { colorTokens } from '@/theme/theme';
import { ROLE_LABEL } from '@/lib/labels';
import type { Company, User } from '@/types';
import type { CompanyMember } from '@/lib/api/companiesApi';

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

  const [members, setMembers] = React.useState<CompanyMember[] | null>(null);
  const [roster, setRoster] = React.useState<User[]>([]);
  const [addUserId, setAddUserId] = React.useState('');
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [membersBusy, setMembersBusy] = React.useState(false);

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

  const refreshMembers = React.useCallback((companyId: string) => {
    companiesApi
      .listMembers(companyId)
      .then(setMembers)
      .catch((err) => {
        setMembersError(err instanceof ApiError ? err.message : 'Không tải được danh sách thành viên');
      });
  }, []);

  React.useEffect(() => {
    if (!company) return;
    refreshMembers(company.id);
    usersApi.listUsers({ companyId: company.id }).then(setRoster).catch(() => setRoster([]));
  }, [company, refreshMembers]);

  const addableUsers = roster.filter(
    (u) => !members?.some((m) => m.userId === u.id),
  );

  const handleAddMember = async () => {
    if (!company || !addUserId) return;
    setMembersError(null);
    setMembersBusy(true);
    try {
      await companiesApi.addMember(company.id, addUserId);
      setAddUserId('');
      refreshMembers(company.id);
    } catch (err) {
      setMembersError(err instanceof ApiError ? err.message : 'Không thêm được thành viên');
    } finally {
      setMembersBusy(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!company) return;
    setMembersError(null);
    setMembersBusy(true);
    try {
      await companiesApi.removeMember(company.id, userId);
      refreshMembers(company.id);
    } catch (err) {
      setMembersError(err instanceof ApiError ? err.message : 'Không xóa được thành viên');
    } finally {
      setMembersBusy(false);
    }
  };

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

        <Card title="Thành viên công ty">
          {membersError ? (
            <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
              {membersError}
            </Typography>
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              select
              label="Thêm nhân sự"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              size="small"
              sx={{ minWidth: 260 }}
              disabled={addableUsers.length === 0}
            >
              {addableUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABEL[u.role]})
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" disabled={!addUserId || membersBusy} onClick={handleAddMember}>
              Thêm vào công ty
            </Button>
          </Stack>

          {!members ? (
            <PageSkeleton variant="list" embedded />
          ) : members.length === 0 ? (
            <Typography variant="body2">Chưa có thành viên nào.</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={1.5}>
              {members.map((member) => (
                <Box
                  key={member.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    pt: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {member.user.name}
                    </Typography>
                    <Typography variant="body2">{member.user.email}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Chip label={ROLE_LABEL[member.user.role]} size="small" />
                    <IconButton
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={membersBusy}
                    >
                      <CloseOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Card>
        </Stack>
      )}
    </PageContainer>
  );
}
