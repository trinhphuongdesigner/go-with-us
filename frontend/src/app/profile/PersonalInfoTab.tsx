'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import { getUser, updateUser } from '@/lib/api/usersApi';
import type { EmploymentEntry } from '@/lib/api/competencyProfileApi';
import type { User } from '@/types';

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  EMPLOYEE: 'Nhân viên',
};

interface FormState {
  name: string;
  jobTitle: string;
  phone: string;
  dateOfBirth: string;
  idNumber: string;
  gender: string;
  onboardDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

const toInputDate = (value?: string | null) => (value ? value.slice(0, 10) : '');

function calculateAge(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function toFormState(user: User): FormState {
  return {
    name: user.name,
    jobTitle: user.jobTitle ?? '',
    phone: user.phone ?? '',
    dateOfBirth: toInputDate(user.dateOfBirth),
    idNumber: user.idNumber ?? '',
    gender: user.gender ?? '',
    onboardDate: toInputDate(user.onboardDate),
    emergencyContactName: user.emergencyContactName ?? '',
    emergencyContactPhone: user.emergencyContactPhone ?? '',
  };
}

/**
 * Personal/HR info — name, contact, date of birth, national ID, onboard
 * date, etc. `role` (system access level: SUPER_ADMIN/COMPANY_ADMIN/
 * EMPLOYEE) is shown read-only only — self-edit of that field is a
 * privilege-escalation risk and UpdateUserDto intentionally never accepts
 * it. `onboardDate` is admin-only in UsersService; EMPLOYEE callers get it
 * read-only here to match.
 */
export default function PersonalInfoTab({
  employments,
}: {
  employments: EmploymentEntry[];
}) {
  const { user: authUser } = useAuth();
  const [record, setRecord] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!authUser) return;
    getUser(authUser.id)
      .then((data) => {
        setRecord(data);
        setForm(toFormState(data));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được thông tin cá nhân'))
      .finally(() => setLoading(false));
  }, [authUser]);

  const canEditOnboardDate = authUser?.role !== 'EMPLOYEE';
  const currentEmployment = employments.find((e) => e.status === 'ACTIVE');
  const age = form?.dateOfBirth ? calculateAge(form.dateOfBirth) : null;

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => (prev ? { ...prev, [field]: event.target.value } : prev));
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!authUser || !form) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Parameters<typeof updateUser>[1] = {
        name: form.name.trim(),
        jobTitle: form.jobTitle.trim() || undefined,
        phone: form.phone.trim() || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
        idNumber: form.idNumber.trim() || undefined,
        gender: form.gender || undefined,
        emergencyContactName: form.emergencyContactName.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      };
      if (canEditOnboardDate && form.onboardDate) {
        payload.onboardDate = new Date(form.onboardDate).toISOString();
      }
      const updated = await updateUser(authUser.id, payload);
      setRecord(updated);
      setForm(toFormState(updated));
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được thông tin cá nhân');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form || !record) {
    return <PageSkeleton variant="form" embedded />;
  }

  return (
    <Box>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Đã lưu thông tin cá nhân.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip size="small" label={ROLE_LABELS[record.role] ?? record.role} />
        {currentEmployment ? (
          <Chip
            size="small"
            variant="outlined"
            label={`Vai trò tại công ty: ${currentEmployment.jobTitle}${currentEmployment.level ? ` · ${currentEmployment.level}` : ''}`}
          />
        ) : null}
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', mb: 2.5 }}>
        “Vai trò tại công ty” đến từ quá trình làm việc hiện tại và có thể khác với vai trò/chuyên môn bạn tự khai bên dưới
        (ví dụ bạn là FE nhưng đang đảm nhiệm vị trí Full Stack ở công ty này).
      </Typography>

      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Họ và tên" value={form.name} onChange={handleChange('name')} fullWidth required />
          <TextField label="Email" value={record.email} fullWidth disabled />
        </Stack>

        <TextField
          label="Vai trò / chuyên môn"
          helperText="Vai trò chuyên môn bạn tự khai — độc lập với công ty đang làm."
          value={form.jobTitle}
          onChange={handleChange('jobTitle')}
          fullWidth
        />

        <Divider />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="Số điện thoại" value={form.phone} onChange={handleChange('phone')} fullWidth />
          <TextField
            select
            label="Giới tính"
            value={form.gender}
            onChange={handleChange('gender')}
            fullWidth
          >
            <MenuItem value="">
              <em>Không chọn</em>
            </MenuItem>
            {GENDER_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Ngày sinh"
            type="date"
            value={form.dateOfBirth}
            onChange={handleChange('dateOfBirth')}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <TextField
            label="Tuổi"
            value={age ?? ''}
            fullWidth
            disabled
            helperText="Tính tự động từ ngày sinh"
          />
        </Stack>

        <TextField label="Số CCCD / CMND" value={form.idNumber} onChange={handleChange('idNumber')} fullWidth />

        <TextField
          label="Ngày onboard"
          type="date"
          value={form.onboardDate}
          onChange={handleChange('onboardDate')}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
          disabled={!canEditOnboardDate}
          helperText={!canEditOnboardDate ? 'Chỉ Admin mới có thể chỉnh sửa ngày onboard.' : undefined}
        />

        <Divider />

        <Typography variant="h3">Liên hệ khẩn cấp</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Tên người liên hệ"
            value={form.emergencyContactName}
            onChange={handleChange('emergencyContactName')}
            fullWidth
          />
          <TextField
            label="Số điện thoại liên hệ"
            value={form.emergencyContactPhone}
            onChange={handleChange('emergencyContactPhone')}
            fullWidth
          />
        </Stack>

        <Box>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
