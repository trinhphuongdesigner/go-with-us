'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import { colorTokens, radiusTokens } from '@/theme/theme';
import { useCompanyScope } from '../CompanyScopeContext';

const MOCK_REQUESTS = [
  { id: '1', name: 'Nguyễn Văn A', kind: 'Mục tiêu phát triển mới', detail: 'Đề xuất kỹ năng "Kiến trúc hệ thống"' },
  { id: '2', name: 'Trần Thị B', kind: 'Cập nhật hồ sơ năng lực', detail: 'Bổ sung chứng chỉ AWS Solutions Architect' },
  { id: '3', name: 'Lê Văn C', kind: 'Yêu cầu tham gia dự án', detail: 'Ứng tuyển vị trí Backend cho dự án Falcon' },
];

/**
 * UI mock — "Duyệt yêu cầu" has no backing request/approval model yet;
 * layout/interaction only, actions are disabled pending real data wiring.
 */
export default function CompanyRequestsPage() {
  const { company } = useCompanyScope();

  return (
    <PageContainer>
      <PageHeader
        title="Duyệt yêu cầu"
        subtitle={company ? `Yêu cầu đang chờ xử lý tại ${company.name}.` : undefined}
      />
      <Card title="Đang chờ duyệt" actions={<StatusChip label="Giao diện minh hoạ" tone="neutral" />}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Danh sách bên dưới chỉ để xem trước bố cục — sẽ kết nối luồng yêu cầu/duyệt thực tế ở bản cập
          nhật tiếp theo.
        </Typography>
        <Stack spacing={1.5}>
          {MOCK_REQUESTS.map((request) => (
            <Box
              key={request.id}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
                border: `1px solid ${colorTokens.border}`,
                borderRadius: `${radiusTokens.md}px`,
                p: 2,
              }}
            >
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {request.name}
                </Typography>
                <Typography variant="body2">{request.kind}</Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
                  {request.detail}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Sắp ra mắt">
                  <span>
                    <Button variant="outlined" size="small" disabled>
                      Từ chối
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Sắp ra mắt">
                  <span>
                    <Button variant="contained" size="small" disabled>
                      Duyệt
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Card>
    </PageContainer>
  );
}
