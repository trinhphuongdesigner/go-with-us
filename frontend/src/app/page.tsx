'use client';

import * as React from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import PageContainer from '@/components/layout/PageContainer';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const userName = user?.name ?? 'Minh Anh';

  return (
    <PageContainer>
        {/* Page Header */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2 }}>
          <Box>
            <Typography variant="h1" sx={{ fontSize: { xs: 24, sm: 28 }, fontWeight: 700, color: '#1c1b2e' }}>
              Chào {userName},
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Hôm nay, bạn muốn tiến thêm bước nào?
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<EditOutlinedIcon sx={{ color: '#6d5bd0' }} />}
            component={Link}
            href="/profile"
            sx={{
              borderRadius: '12px',
              borderColor: '#e2e8f0',
              color: '#1c1b2e',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              bgcolor: '#ffffff',
              '&:hover': { borderColor: '#6d5bd0', bgcolor: '#fafafc' },
            }}
          >
            Cập nhật hồ sơ
          </Button>
        </Box>

        {/* 2-Column Dashboard Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '8fr 4fr' }, gap: 3, alignItems: 'start' }}>
          
          {/* Left Column (8 cols) */}
          <Stack spacing={3}>
            
            {/* Lộ trình đang theo đuổi Card */}
            <Box
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: '20px',
                bgcolor: '#ffffff',
                border: '1px solid #e8e7f0',
                boxShadow: '0 1px 3px rgba(28,27,46,.04)',
              }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
                LỘ TRÌNH ĐANG THEO ĐUỔI
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#1c1b2e', mt: 0.5 }}>
                Trưởng nhóm vận hành
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.25 }}>
                Bạn đang ở bước 2: Giao tiếp & phản hồi.
              </Typography>

              {/* Step Progress Line with Milo Mascot on Step 2 */}
              <Box
                sx={{
                  py: 4,
                  px: 3,
                  my: 3,
                  borderRadius: '16px',
                  bgcolor: '#fafafc',
                  border: '1px solid #f0edf7',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 520, mx: 'auto', position: 'relative' }}>
                  
                  {/* Step 1 */}
                  <Stack spacing={0.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#16a34a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                      <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1c1b2e' }}>1</Typography>
                    <Typography sx={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>Nền tảng<br />vững chắc</Typography>
                  </Stack>

                  {/* Connector 1-2 */}
                  <Box sx={{ flex: 1, height: 3, bgcolor: '#6d5bd0', mx: 1.5 }} />

                  {/* Step 2 (Active with Milo) */}
                  <Stack spacing={0.5} sx={{ alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                    {/* Milo Standing with float animation */}
                    <Box
                      component="img"
                      src="/milo-standing.png"
                      alt="Milo"
                      sx={{
                        position: 'absolute',
                        top: -50,
                        width: 44,
                        height: 52,
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 4px 6px rgba(109,91,208,0.25))',
                        animation: 'floatMilo 3s ease-in-out infinite',
                        '@keyframes floatMilo': {
                          '0%, 100%': { transform: 'translateY(0px)' },
                          '50%': { transform: 'translateY(-6px)' },
                        },
                      }}
                    />
                    <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#6d5bd0', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, boxShadow: '0 0 16px rgba(109,91,208,0.45)' }}>
                      2
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6d5bd0' }}>2</Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6d5bd0', lineHeight: 1.2 }}>Giao tiếp<br />& phản hồi</Typography>
                  </Stack>

                  {/* Connector 2-3 */}
                  <Box sx={{ flex: 1, height: 3, bgcolor: '#e2e8f0', mx: 1.5 }} />

                  {/* Step 3 */}
                  <Stack spacing={0.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#ffffff', border: '2px solid #cbd5e1', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                      3
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>3</Typography>
                    <Typography sx={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.2 }}>Quản lý<br />công việc</Typography>
                  </Stack>

                  {/* Connector 3-4 */}
                  <Box sx={{ flex: 1, height: 3, bgcolor: '#e2e8f0', mx: 1.5 }} />

                  {/* Step 4 */}
                  <Stack spacing={0.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: '#ffffff', border: '2px solid #cbd5e1', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FlagOutlinedIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>4</Typography>
                    <Typography sx={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.2 }}>Dẫn dắt<br />đội nhóm</Typography>
                  </Stack>

                </Box>
              </Box>

              {/* Progress bar */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', mb: 1 }}>
                  <span>1/4 cột mốc hoàn thành</span>
                  <Typography component="span" sx={{ fontWeight: 700, color: '#1c1b2e', fontSize: 12 }}>25%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={25}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': { bgcolor: '#6d5bd0', borderRadius: 4 },
                  }}
                />
              </Box>

              {/* Time Details & Actions */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, pt: 1 }}>
                <Stack direction="row" spacing={3} sx={{ fontSize: 12, color: '#64748b' }}>
                  <span>📅 12 tuần</span>
                  <span>🕒 3 giờ mỗi tuần</span>
                </Stack>

                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    component={Link}
                    href="/development-plan"
                    endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      bgcolor: '#6d5bd0',
                      '&:hover': { bgcolor: '#5847be' },
                      borderRadius: '12px',
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: 13,
                      px: 2.5,
                      py: 1,
                    }}
                  >
                    Tiếp tục bước 2
                  </Button>
                  <Button
                    component={Link}
                    href="/development-plan"
                    endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      color: '#6d5bd0',
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: 13,
                      p: 0,
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    Xem toàn bộ lộ trình
                  </Button>
                </Stack>
              </Box>
            </Box>

            {/* Hồ sơ năng lực Card */}
            <Box
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: '20px',
                bgcolor: '#ffffff',
                border: '1px solid #e8e7f0',
                boxShadow: '0 1px 3px rgba(28,27,46,.04)',
              }}
            >
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1c1b2e', mb: 2 }}>
                Hồ sơ năng lực
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
                <Box sx={{ p: 2, borderRadius: '14px', bgcolor: '#fafafc', border: '1px solid #f0edf7', textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#6d5bd0' }}>8</Typography>
                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>Kỹ năng</Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: '14px', bgcolor: '#fafafc', border: '1px solid #f0edf7', textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>4</Typography>
                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>Dự án</Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: '14px', bgcolor: '#fafafc', border: '1px solid #f0edf7', textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#5847be' }}>2</Typography>
                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>Chứng chỉ</Typography>
                </Box>
              </Box>

              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', mb: 1 }}>
                Hoạt động gần đây
              </Typography>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '12px', bgcolor: '#fafafc', fontSize: 12 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6d5bd0' }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 12 }}>Đánh giá tháng 8</Typography>
                    <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '6px', bgcolor: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 600 }}>
                      Đã duyệt
                    </Box>
                  </Stack>
                  <Typography sx={{ color: '#64748b', fontSize: 12 }}>Góp ý từ quản lý và đồng nghiệp</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '12px', bgcolor: '#fafafc', fontSize: 12 }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#94a3b8' }} />
                    <Typography sx={{ fontWeight: 700, fontSize: 12 }}>Dự án cải tiến quy trình</Typography>
                    <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '6px', bgcolor: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 600 }}>
                      Đã cập nhật
                    </Box>
                  </Stack>
                  <Typography sx={{ color: '#64748b', fontSize: 12 }}>Vai trò và đóng góp đã được ghi nhận</Typography>
                </Box>
              </Stack>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, mt: 2, borderTop: '1px solid #f0edf7' }}>
                <Button
                  component={Link}
                  href="/profile"
                  endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 14 }} />}
                  sx={{ color: '#6d5bd0', textTransform: 'none', fontWeight: 600, fontSize: 13, p: 0 }}
                >
                  Xem hồ sơ
                </Button>
                <Button
                  component={Link}
                  href="/profile/import"
                  startIcon={<PostAddOutlinedIcon sx={{ fontSize: 16, color: '#6d5bd0' }} />}
                  variant="outlined"
                  sx={{ borderRadius: '10px', borderColor: '#e2e8f0', color: '#1c1b2e', textTransform: 'none', fontSize: 12, fontWeight: 600 }}
                >
                  Thêm từ tài liệu
                </Button>
              </Box>
            </Box>

          </Stack>

          {/* Right Column (4 cols) */}
          <Stack spacing={3}>
            
            {/* Việc cần làm Card */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: '20px',
                bgcolor: '#ffffff',
                border: '1px solid #e8e7f0',
                boxShadow: '0 1px 3px rgba(28,27,46,.04)',
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1c1b2e', mb: 2 }}>
                Việc cần làm
              </Typography>

              <Stack spacing={1.5}>
                <Box sx={{ p: 1.5, borderRadius: '14px', border: '1px solid #ede9fe', bgcolor: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <DescriptionOutlinedIcon sx={{ color: '#6d5bd0', fontSize: 20 }} />
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1c1b2e' }}>Tự đánh giá tháng 9</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>Hạn 20/09</Typography>
                    </Box>
                  </Stack>
                  <Button component={Link} href="/assessments" sx={{ bgcolor: '#6d5bd0', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'none', borderRadius: '8px', px: 1.5, py: 0.5, '&:hover': { bgcolor: '#5847be' } }}>
                    Mở đánh giá →
                  </Button>
                </Box>

                <Box sx={{ p: 1.5, borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', '&:hover': { bgcolor: '#fafafc' }, cursor: 'pointer' }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <PeopleAltOutlinedIcon sx={{ color: '#64748b', fontSize: 20 }} />
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#1c1b2e' }}>Thực hành buổi trao đổi</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>Trong tuần</Typography>
                    </Box>
                  </Stack>
                  <ChevronRightRoundedIcon sx={{ color: '#cbd5e1' }} />
                </Box>

                <Box sx={{ p: 1.5, borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', '&:hover': { bgcolor: '#fafafc' }, cursor: 'pointer' }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <PostAddOutlinedIcon sx={{ color: '#64748b', fontSize: 20 }} />
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#1c1b2e' }}>Cập nhật kinh nghiệm mới</Typography>
                      <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>Khi thuận tiện</Typography>
                    </Box>
                  </Stack>
                  <ChevronRightRoundedIcon sx={{ color: '#cbd5e1' }} />
                </Box>
              </Stack>
            </Box>

            {/* Trợ lý đồng hành Card */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: '20px',
                border: '2px solid #ddd6fe',
                background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)',
                boxShadow: '0 1px 3px rgba(28,27,46,.04)',
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <AutoAwesomeOutlinedIcon sx={{ color: '#6d5bd0', fontSize: 18 }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1c1b2e' }}>
                  Trợ lý đồng hành
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 11, color: '#64748b', mb: 2 }}>
                Gợi ý bước tiếp theo từ hồ sơ và mục tiêu của bạn.
              </Typography>

              <Stack spacing={1} sx={{ mb: 2 }}>
                <Box
                  component={Link}
                  href="/assistant"
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: '#ffffff',
                    border: '1px solid #ede9fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: '#1c1b2e',
                    textDecoration: 'none',
                    '&:hover': { borderColor: '#6d5bd0' },
                  }}
                >
                  <span>💬 Tôi nên phát triển kỹ năng nào?</span>
                  <ChevronRightRoundedIcon sx={{ color: '#6d5bd0', fontSize: 18 }} />
                </Box>

                <Box
                  component={Link}
                  href="/development-plan"
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: '#ffffff',
                    border: '1px solid #ede9fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: '#1c1b2e',
                    textDecoration: 'none',
                    '&:hover': { borderColor: '#6d5bd0' },
                  }}
                >
                  <span>📋 Điều chỉnh lộ trình của tôi?</span>
                  <ChevronRightRoundedIcon sx={{ color: '#6d5bd0', fontSize: 18 }} />
                </Box>
              </Stack>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <Button
                  component={Link}
                  href="/assistant"
                  endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 12 }} />}
                  sx={{ color: '#6d5bd0', textTransform: 'none', fontWeight: 700, fontSize: 11, p: 0 }}
                >
                  Mở trợ lý AI
                </Button>
                <Typography sx={{ color: '#94a3b8', fontSize: 11 }}>
                  Bạn xem đề xuất trước khi lưu.
                </Typography>
              </Box>
            </Box>

            {/* Ghi nhận gần đây */}
            <Box
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: '#ffffff',
                border: '1px solid #e8e7f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmojiEventsOutlinedIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1c1b2e' }}>Hoàn thành cột mốc Nền tảng</Typography>
                  <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>Cột mốc đầu tiên trong lộ trình</Typography>
                </Box>
              </Stack>
              <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>30/08/2026</Typography>
            </Box>

          </Stack>

        </Box>
      </PageContainer>
  );
}
