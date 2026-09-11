'use client';

import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import StatusChip from '@/components/ui/StatusChip';
import { useCompanyScope } from '../CompanyScopeContext';

const MOCK_CYCLES = [
  { month: 'Tháng 9/2026', status: 'Đang diễn ra', approved: 4, total: 12 },
  { month: 'Tháng 8/2026', status: 'Đã hoàn tất', approved: 15, total: 15 },
  { month: 'Tháng 7/2026', status: 'Đã hoàn tất', approved: 14, total: 14 },
];

const STATUS_TONE: Record<string, 'info' | 'success'> = {
  'Đang diễn ra': 'info',
  'Đã hoàn tất': 'success',
};

/**
 * UI mock — no assessment-cycle-by-company backend endpoint exists yet for
 * Super Admin; layout/interaction only, real data wiring is a follow-up.
 */
export default function CompanyAssessmentsPage() {
  const { company } = useCompanyScope();

  return (
    <PageContainer>
      <PageHeader
        title="Đánh giá chéo"
        subtitle={company ? `Chu kỳ đánh giá của ${company.name}.` : undefined}
      />
      <Card title="Chu kỳ đánh giá" actions={<StatusChip label="Giao diện minh hoạ" tone="neutral" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Dữ liệu bên dưới chỉ để xem trước bố cục — sẽ kết nối API đánh giá chéo thực tế ở bản cập nhật
          tiếp theo.
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Chu kỳ</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Đã duyệt / Tổng số</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {MOCK_CYCLES.map((cycle) => (
              <TableRow key={cycle.month}>
                <TableCell>{cycle.month}</TableCell>
                <TableCell>
                  <StatusChip label={cycle.status} tone={STATUS_TONE[cycle.status] ?? 'neutral'} />
                </TableCell>
                <TableCell>
                  {cycle.approved}/{cycle.total}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageContainer>
  );
}
