'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@/components/ui/Button';
import PageSkeleton from '@/components/ui/PageSkeleton';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import PassportView from '@/components/passport/PassportView';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  getCareerPassport,
  type CareerPassport,
} from '@/lib/api/careerPassportApi';

/**
 * The admin-side read of one employee's career record. Read-only: generating
 * or saving a summary is the employee's own call, from /career-passport.
 */
export default function EmployeePassportPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const [passport, setPassport] = React.useState<CareerPassport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCareerPassport(params.id);
        if (!cancelled) setPassport(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : 'Không tải được hộ chiếu nghề nghiệp',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, user]);

  return (
    <PageContainer>
        <PageHeader
          title={passport ? `${passport.user.name} — Hộ chiếu nghề nghiệp` : 'Hộ chiếu nghề nghiệp'}
          subtitle="Các kỳ làm việc, đánh giá đã duyệt và tóm tắt AI."
          actions={
            <Button
              component={NextLink}
              href={`/employees/${params.id}`}
              variant="outlined"
            >
              Quay lại tổng quan
            </Button>
          }
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
    </PageContainer>
  );
}
