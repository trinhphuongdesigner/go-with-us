'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Typography from '@mui/material/Typography';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import PassportView from '@/components/passport/PassportView';
import { ApiError } from '@/lib/api/client';
import {
  getSharedPassport,
  type CareerPassport,
} from '@/lib/api/careerPassportApi';
import { colorTokens } from '@/theme/theme';

/**
 * The public, token-only passport view a prospective employer opens.
 * Deliberately outside AppShell — there is no session here, just the link.
 */
export default function SharedPassportPage() {
  const params = useParams<{ token: string }>();

  const [passport, setPassport] = React.useState<CareerPassport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getSharedPassport(params.token);
        if (!cancelled) setPassport(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Liên kết chia sẻ này không còn hiệu lực',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: colorTokens.canvas }}>
      <PageContainer>
        <PageHeader
          title="Hộ chiếu nghề nghiệp"
          subtitle="Bản xem chia sẻ chỉ đọc — lịch sử làm việc, đánh giá đã duyệt và thành tích."
          actions={<Chip label="Bản chia sẻ" color="primary" variant="outlined" />}
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}
        {loading ? (
          <PageSkeleton variant="profile" />
        ) : passport ? (
          <PassportView passport={passport} />
        ) : null}

        {passport ? (
          <Typography
            variant="body2"
            sx={{ mt: 4, textAlign: 'center' }}
          >
            Được chia sẻ bởi {passport.user.name} qua CareerMate. Chỉ hiện đánh giá
            mà công ty đã duyệt.
          </Typography>
        ) : null}
      </PageContainer>
    </Box>
  );
}
