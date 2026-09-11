'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Card from '@/components/ui/Card';

export type PageSkeletonVariant = 'page' | 'table' | 'list' | 'form' | 'profile' | 'cards';

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  rows?: number;
  /** Skip the outer Card — use when already inside a Card. */
  embedded?: boolean;
}

function Bar({ width, height = 16 }: { width: string | number; height?: number }) {
  return <Skeleton variant="rounded" width={width} height={height} />;
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <Stack spacing={1.5}>
      <Bar width="40%" height={18} />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={44} />
      ))}
    </Stack>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <Stack spacing={2}>
      {Array.from({ length: rows }).map((_, index) => (
        <Box key={index}>
          <Bar width="55%" height={18} />
          <Box sx={{ mt: 1 }}>
            <Bar width="80%" height={14} />
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function FormSkeleton() {
  return (
    <Stack spacing={2}>
      <Bar width="30%" height={14} />
      <Skeleton variant="rounded" height={44} />
      <Bar width="30%" height={14} />
      <Skeleton variant="rounded" height={44} />
      <Bar width="30%" height={14} />
      <Skeleton variant="rounded" height={88} />
      <Skeleton variant="rounded" width={140} height={44} />
    </Stack>
  );
}

function ProfileSkeleton() {
  return (
    <Stack spacing={3}>
      <Card>
        <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
          <Skeleton variant="circular" width={64} height={64} />
          <Box sx={{ flex: 1 }}>
            <Bar width="36%" height={22} />
            <Box sx={{ mt: 1 }}>
              <Bar width="52%" height={14} />
            </Box>
          </Box>
        </Stack>
      </Card>
      <Card>
        <Bar width="28%" height={20} />
        <Box sx={{ mt: 2 }}>
          <ListSkeleton rows={4} />
        </Box>
      </Card>
    </Stack>
  );
}

function CardsSkeleton() {
  return (
    <Stack spacing={3}>
      <Card>
        <Bar width="24%" height={20} />
        <Box sx={{ mt: 2 }}>
          <Bar width="70%" />
        </Box>
      </Card>
      <Card>
        <TableSkeleton rows={4} />
      </Card>
    </Stack>
  );
}

/**
 * Page / card loading placeholder. Use instead of a bare spinner or
 * “Loading…” text while a list or detail fetch is in flight.
 */
export default function PageSkeleton({ variant = 'page', rows = 5, embedded = false }: PageSkeletonProps) {
  const body =
    variant === 'table' ? (
      <TableSkeleton rows={rows} />
    ) : variant === 'list' ? (
      <ListSkeleton rows={rows} />
    ) : variant === 'form' ? (
      <FormSkeleton />
    ) : variant === 'profile' ? (
      <ProfileSkeleton />
    ) : variant === 'cards' ? (
      <CardsSkeleton />
    ) : (
      <Stack spacing={3}>
        <Box>
          <Bar width={220} height={32} />
          <Box sx={{ mt: 1 }}>
            <Bar width={280} height={14} />
          </Box>
        </Box>
        <Card>
          <TableSkeleton rows={rows} />
        </Card>
      </Stack>
    );

  if (embedded || variant === 'profile' || variant === 'cards' || variant === 'page') {
    return body;
  }

  return <Card>{body}</Card>;
}
