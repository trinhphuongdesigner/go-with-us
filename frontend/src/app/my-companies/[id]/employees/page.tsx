'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import StatusChip from '@/components/ui/StatusChip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Pagination from '@mui/material/Pagination';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import ViewToggle, { type ViewMode } from '@/components/ui/ViewToggle';
import { colorTokens, radiusTokens } from '@/theme/theme';
import * as usersApi from '@/lib/api/usersApi';
import { ApiError } from '@/lib/api/client';
import { isEmployeeRole } from '@/lib/roles';
import { useCompanyScope } from '@/contexts/CompanyScopeContext';
import type { Role, User } from '@/types';

const PAGE_SIZE = 20;

const ROLE_LABEL: Partial<Record<Role, string>> = {
  BOD: 'Ban giám đốc',
  HR: 'Nhân sự',
  EMPLOYEE: 'Nhân viên',
};

const ROLE_TONE: Partial<Record<Role, 'info' | 'success' | 'neutral'>> = {
  BOD: 'info',
  HR: 'success',
  EMPLOYEE: 'neutral',
};

export default function EmployeesPage() {
  const router = useRouter();
  const { companyId } = useCompanyScope();
  const [employees, setEmployees] = React.useState<User[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<Role | 'ALL'>('ALL');
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    usersApi
      .listUsers({ companyId })
      .then((users) => setEmployees(users.filter((u) => isEmployeeRole(u.role))))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh sách nhân sự');
      });
  }, [companyId]);

  const availableRoles = React.useMemo(() => {
    const roles = new Set<Role>();
    employees?.forEach((employee) => roles.add(employee.role));
    return Array.from(roles);
  }, [employees]);

  const filteredEmployees = React.useMemo(() => {
    if (!employees) return [];
    const keyword = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesRole = roleFilter === 'ALL' || employee.role === roleFilter;
      const matchesKeyword =
        !keyword ||
        employee.name?.toLowerCase().includes(keyword) ||
        employee.email?.toLowerCase().includes(keyword) ||
        employee.jobTitle?.toLowerCase().includes(keyword);
      return matchesRole && matchesKeyword;
    });
  }, [employees, search, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));

  React.useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedEmployees = filteredEmployees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageContainer>
        <PageHeader title="Nhân sự" subtitle="Đội ngũ của công ty bạn." />
        <Card title="Nhân sự" actions={<ViewToggle value={viewMode} onChange={setViewMode} />}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Tìm theo tên, email, chức danh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 260, flex: 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              select
              size="small"
              label="Vai trò"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="ALL">Tất cả vai trò</MenuItem>
              {availableRoles.map((role) => (
                <MenuItem key={role} value={role}>
                  {ROLE_LABEL[role] ?? role}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : !employees ? (
            <PageSkeleton variant={viewMode === 'card' ? 'cards' : 'table'} rows={5} embedded />
          ) : filteredEmployees.length === 0 ? (
            <Typography variant="body1">
              {employees.length === 0 ? 'Chưa có nhân sự nào.' : 'Không tìm thấy nhân sự phù hợp.'}
            </Typography>
          ) : viewMode === 'card' ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 2,
              }}
            >
              {pagedEmployees.map((employee) => (
                <Box
                  key={employee.id}
                  onClick={() => router.push(`/my-companies/${companyId}/employees/${employee.id}`)}
                  sx={{
                    border: `1px solid ${colorTokens.border}`,
                    borderRadius: `${radiusTokens.md}px`,
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                    '&:hover': { borderColor: colorTokens.primary },
                  }}
                >
                  <Avatar
                    src={employee.avatarUrl ?? undefined}
                    sx={{ width: 48, height: 48, bgcolor: colorTokens.primary, color: '#ffffff' }}
                  >
                    {employee.name?.[0]?.toUpperCase() ?? '?'}
                  </Avatar>
                  <Typography variant="body1" sx={{ fontWeight: 600, mt: 1 }}>
                    {employee.name}
                  </Typography>
                  <Typography variant="body2">{employee.jobTitle ?? 'Chưa có chức danh'}</Typography>
                  <StatusChip label={ROLE_LABEL[employee.role] ?? employee.role} tone={ROLE_TONE[employee.role]} />
                  <Box sx={{ display: 'flex', gap: 2, mt: 1, fontSize: 12, color: colorTokens.secondary }}>
                    <span>Đóng góp: {employee.contributionScore ?? '—'}</span>
                    <span>Thái độ: {employee.attitudeScore ?? '—'}</span>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Vai trò</TableCell>
                  <TableCell>Chức danh</TableCell>
                  <TableCell>Điểm đóng góp</TableCell>
                  <TableCell>Điểm thái độ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    onClick={() => router.push(`/my-companies/${companyId}/employees/${employee.id}`)}
                    hover
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>
                      <StatusChip label={ROLE_LABEL[employee.role] ?? employee.role} tone={ROLE_TONE[employee.role]} />
                    </TableCell>
                    <TableCell>{employee.jobTitle ?? '—'}</TableCell>
                    <TableCell>{employee.contributionScore ?? '—'}</TableCell>
                    <TableCell>{employee.attitudeScore ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {employees && filteredEmployees.length > PAGE_SIZE ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pageCount}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          ) : null}
        </Card>
    </PageContainer>
  );
}
