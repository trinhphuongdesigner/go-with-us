'use client';

import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <PageContainer>
        <PageHeader title="Trang chủ" subtitle={`Chào mừng trở lại${user ? `, ${user.name}` : ''}.`} />
        <Card title="Sắp ra mắt">
          <Typography variant="body1">
            Các khối theo vai trò (tổng quan công ty cho quản trị nền tảng, tổng quan đội ngũ cho quản trị
            công ty, ảnh chụp cá nhân cho nhân sự) sẽ có ở giai đoạn sau.
          </Typography>
        </Card>
    </PageContainer>
  );
}
