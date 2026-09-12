'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import { colorTokens } from '@/theme/theme';

interface MindmapSkill {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  status: 'done' | 'in_progress' | 'upcoming';
  progress: number;
  totalTasks: number;
  doneTasks: number;
  description: string;
}

const INITIAL_SKILLS: MindmapSkill[] = [
  {
    id: 's1',
    code: '2.1',
    title: 'Lắng nghe tích cực',
    subtitle: 'Active Listening',
    status: 'done',
    progress: 100,
    totalTasks: 3,
    doneTasks: 3,
    description: 'Lắng nghe không ngắt lời, paraphrase và đặt câu hỏi mở làm rõ thông tin.',
  },
  {
    id: 's2',
    code: '2.2',
    title: 'Mô hình phản hồi SBI',
    subtitle: 'Situation - Behavior - Impact',
    status: 'in_progress',
    progress: 66,
    totalTasks: 3,
    doneTasks: 2,
    description: 'Cung cấp phản hồi khách quan dựa trên bối cảnh, hành vi thực tế và hệ quả đo lường được.',
  },
  {
    id: 's3',
    code: '2.3',
    title: 'Điều phối cuộc họp 1-on-1',
    subtitle: 'Effective 1-on-1 Sync',
    status: 'upcoming',
    progress: 0,
    totalTasks: 2,
    doneTasks: 0,
    description: 'Thiết lập nhịp 1-on-1 hàng tuần, tạo không gian an toàn tâm lý giúp thành viên chia sẻ cởi mở.',
  },
  {
    id: 's4',
    code: '2.4',
    title: 'Quản lý bất đồng quan điểm',
    subtitle: 'Conflict Navigation',
    status: 'upcoming',
    progress: 0,
    totalTasks: 2,
    doneTasks: 0,
    description: 'Nhận diện xung đột sớm, chuyển hóa mâu thuẫn thành thảo luận xây dựng theo định hướng win-win.',
  },
];

export default function MindmapView({
  onBack,
  companion = 'milo',
  reducedMotion = false,
}: {
  onBack: () => void;
  companion?: 'milo' | 'an' | 'none';
  reducedMotion?: boolean;
}) {
  const [skills, setSkills] = React.useState<MindmapSkill[]>(INITIAL_SKILLS);
  const [selectedSkillId, setSelectedSkillId] = React.useState<string>('s2');
  const [recalculating, setRecalculating] = React.useState<boolean>(false);
  const [recalcSuccess, setRecalcSuccess] = React.useState<boolean>(false);

  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? skills[1];

  const handleToggleTask = (skillId: string) => {
    setSkills((prev) =>
      prev.map((skill) => {
        if (skill.id !== skillId) return skill;
        const newDone = skill.doneTasks < skill.totalTasks ? skill.doneTasks + 1 : 0;
        const newProgress = Math.round((newDone / skill.totalTasks) * 100);
        const newStatus = newProgress === 100 ? 'done' : newProgress > 0 ? 'in_progress' : 'upcoming';
        return {
          ...skill,
          doneTasks: newDone,
          progress: newProgress,
          status: newStatus,
        };
      }),
    );
  };

  const handleRecalculate = () => {
    setRecalculating(true);
    setRecalcSuccess(false);
    setTimeout(() => {
      setRecalculating(false);
      setRecalcSuccess(true);
      setTimeout(() => setRecalcSuccess(false), 4000);
    }, 1200);
  };

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      {/* Top Header & Breadcrumbs */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          mb: 3,
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={onBack}
            startIcon={<ArrowBackRoundedIcon />}
            sx={{
              borderRadius: '12px',
              borderColor: colorTokens.divider,
              color: colorTokens.text,
              bgcolor: colorTokens.surface,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13,
              '&:hover': { bgcolor: colorTokens.bg, borderColor: '#6d5bd0' },
            }}
          >
            Quay lại Bậc thang
          </Button>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6d5bd0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sơ đồ kỹ năng nhánh · Bước 02
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: colorTokens.text }}>
              Giao tiếp & Phản hồi
            </Typography>
          </Box>
        </Stack>

        <Chip
          icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: '#6d5bd0 !important' }} />}
          label="Tạo bởi CareerMate AI"
          sx={{
            bgcolor: '#faf5ff',
            color: '#6d5bd0',
            fontWeight: 600,
            fontSize: 12,
            border: '1px solid #ede9fe',
          }}
        />
      </Stack>

      {recalcSuccess && (
        <Alert severity="success" sx={{ mb: 2.5, borderRadius: '12px' }}>
          AI đã tính toán lại lộ trình dựa trên tiến độ mới nhất của bạn!
        </Alert>
      )}

      {/* Main 2-Column Layout: Mindmap Canvas (Left 8 cols) + AI Explanation Panel (Right 4 cols) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '8fr 4fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Mindmap Canvas */}
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: '20px',
            bgcolor: colorTokens.surface,
            border: `1px solid ${colorTokens.divider}`,
            boxShadow: '0 2px 8px rgba(28,27,46,.04)',
            overflow: 'hidden',
          }}
        >
          {/* Node Diagram Header */}
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: colorTokens.text }}>
              Cây phân rã kỹ năng thực hành
            </Typography>
            <Typography sx={{ fontSize: 12, color: colorTokens.neutral400 }}>
              Nhấn vào từng kỹ năng để xem chi tiết
            </Typography>
          </Stack>

          {/* SVG Mindmap Area */}
          <Box
            sx={{
              position: 'relative',
              p: { xs: 2, md: 3 },
              borderRadius: '16px',
              bgcolor: '#fafafc',
              border: '1px solid #f0edf7',
              minHeight: 480,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* SVG Connecting Curves */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6d5bd0" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              {/* Responsive SVG Bezier curves from center to 4 quadrants */}
              <path
                d="M 50% 50% C 30% 50%, 20% 25%, 15% 20%"
                stroke="url(#curveGradient)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={reducedMotion ? 'none' : '6 4'}
                style={{
                  animation: reducedMotion ? 'none' : 'dashflow 20s linear infinite',
                }}
              />
              <path
                d="M 50% 50% C 70% 50%, 80% 25%, 85% 20%"
                stroke="url(#curveGradient)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={reducedMotion ? 'none' : '6 4'}
                style={{
                  animation: reducedMotion ? 'none' : 'dashflow 20s linear infinite',
                }}
              />
              <path
                d="M 50% 50% C 30% 50%, 20% 75%, 15% 80%"
                stroke="url(#curveGradient)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={reducedMotion ? 'none' : '6 4'}
                style={{
                  animation: reducedMotion ? 'none' : 'dashflow 20s linear infinite',
                }}
              />
              <path
                d="M 50% 50% C 70% 50%, 80% 75%, 85% 80%"
                stroke="url(#curveGradient)"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={reducedMotion ? 'none' : '6 4'}
                style={{
                  animation: reducedMotion ? 'none' : 'dashflow 20s linear infinite',
                }}
              />
            </svg>

            {/* Central Node */}
            <Box
              sx={{
                zIndex: 2,
                p: 2.5,
                borderRadius: '20px',
                bgcolor: '#ffffff',
                border: '2px solid #6d5bd0',
                boxShadow: '0 8px 24px rgba(109,91,208,0.18)',
                textAlign: 'center',
                maxWidth: 240,
                my: 4,
                position: 'relative',
                animation: reducedMotion ? 'none' : 'pulseGlow 3s ease-in-out infinite',
                '@keyframes pulseGlow': {
                  '0%, 100%': { boxShadow: '0 8px 24px rgba(109,91,208,0.18)' },
                  '50%': { boxShadow: '0 12px 32px rgba(109,91,208,0.32)' },
                },
                '@keyframes dashflow': {
                  to: { strokeDashoffset: -100 },
                },
              }}
            >
              {companion !== 'none' && (
                <Box
                  component="img"
                  src={companion === 'an' ? '/an-avatar.png' : '/milo-head.png'}
                  alt="Mascot"
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: '2px solid #6d5bd0',
                    mx: 'auto',
                    mb: 1,
                    bgcolor: '#faf5ff',
                    objectFit: 'cover',
                  }}
                />
              )}
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6d5bd0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                CỘT MỐC TRUNG TÂM
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: colorTokens.text, mt: 0.5 }}>
                Giao tiếp & Phản hồi
              </Typography>
              <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, mt: 0.25 }}>
                4 kỹ năng cốt lõi
              </Typography>
            </Box>

            {/* 4 Skill Cards Grid surrounding the center */}
            <Box
              sx={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                zIndex: 2,
              }}
            >
              {skills.map((skill) => {
                const isSelected = skill.id === selectedSkillId;
                const isDone = skill.status === 'done';
                const isInProgress = skill.status === 'in_progress';

                return (
                  <Box
                    key={skill.id}
                    onClick={() => setSelectedSkillId(skill.id)}
                    sx={{
                      p: 2,
                      borderRadius: '14px',
                      bgcolor: isSelected ? '#ffffff' : 'rgba(255,255,255,0.85)',
                      border: `2px solid ${
                        isSelected ? '#6d5bd0' : isInProgress ? '#ddd6fe' : colorTokens.divider
                      }`,
                      boxShadow: isSelected
                        ? '0 6px 20px rgba(109,91,208,0.14)'
                        : '0 2px 6px rgba(28,27,46,0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: '#6d5bd0',
                        transform: reducedMotion ? 'none' : 'translateY(-2px)',
                      },
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6d5bd0' }}>
                        Kỹ năng {skill.code}
                      </Typography>
                      <Chip
                        size="small"
                        label={isDone ? 'Hoàn thành' : isInProgress ? 'Đang làm' : 'Sắp tới'}
                        sx={{
                          fontSize: 10,
                          fontWeight: 600,
                          height: 22,
                          bgcolor: isDone ? '#dcfce7' : isInProgress ? '#faf5ff' : '#f1f5f9',
                          color: isDone ? '#15803d' : isInProgress ? '#6d5bd0' : '#64748b',
                        }}
                      />
                    </Stack>

                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text }}>
                      {skill.title}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, mb: 1.5 }}>
                      {skill.subtitle}
                    </Typography>

                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 11, color: colorTokens.neutral400 }}>
                        Tiến độ: {skill.doneTasks}/{skill.totalTasks} bài tập
                      </Typography>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: colorTokens.text }}>
                        {skill.progress}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={skill.progress}
                      sx={{
                        height: 5,
                        borderRadius: 3,
                        bgcolor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: isDone ? colorTokens.success : '#6d5bd0',
                          borderRadius: 3,
                        },
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Selected Skill Quick Action Bar */}
          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: '14px',
              bgcolor: '#fafafc',
              border: '1px solid #f0edf7',
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { sm: 'center' },
              gap: 2,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: colorTokens.text }}>
                {selectedSkill.code}: {selectedSkill.title}
              </Typography>
              <Typography sx={{ fontSize: 12, color: colorTokens.neutral400, mt: 0.25 }}>
                {selectedSkill.description}
              </Typography>
            </Box>
            <Button
              variant="contained"
              onClick={() => handleToggleTask(selectedSkill.id)}
              startIcon={
                selectedSkill.progress === 100 ? (
                  <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
                ) : (
                  <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{
                bgcolor: selectedSkill.progress === 100 ? colorTokens.success : '#6d5bd0',
                '&:hover': {
                  bgcolor: selectedSkill.progress === 100 ? '#15803d' : '#5847be',
                },
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 12,
                px: 2,
                flexShrink: 0,
              }}
            >
              {selectedSkill.progress === 100
                ? 'Đã hoàn thành (Nhấn để reset)'
                : 'Đánh dấu hoàn thành 1 bài tập'}
            </Button>
          </Box>
        </Box>

        {/* Right Column: AI Reasoning Drawer ("Vì sao AI gợi ý bước này?") */}
        <Stack spacing={2.5}>
          <Box
            sx={{
              p: 2.5,
              borderRadius: '20px',
              bgcolor: colorTokens.surface,
              border: '2px solid #ddd6fe',
              background: 'linear-gradient(180deg, #ffffff 0%, #faf5ff 100%)',
              boxShadow: '0 2px 8px rgba(109,91,208,0.06)',
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <AutoAwesomeOutlinedIcon sx={{ color: '#6d5bd0', fontSize: 20 }} />
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: colorTokens.text }}>
                Vì sao AI gợi ý bước này?
              </Typography>
            </Stack>

            <Typography sx={{ fontSize: 12, color: colorTokens.neutral400, mb: 2 }}>
              Dựa trên phân tích tự động từ hồ sơ năng lực và mục tiêu thăng tiến của bạn.
            </Typography>

            <Stack spacing={2}>
              {/* Point 1: 360 Feedback */}
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#ffffff', border: '1px solid #ede9fe' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <InsightsOutlinedIcon sx={{ color: '#6d5bd0', fontSize: 16 }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: colorTokens.text }}>
                    Đánh giá 360 gần nhất
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, lineHeight: 1.4 }}>
                  Kỹ năng giao tiếp và phản hồi 2 chiều của bạn đạt 3.4/5.0. AI xác định đây là đòn bẩy quan trọng nhất (+24% khả năng thăng chức Trưởng nhóm).
                </Typography>
              </Box>

              {/* Point 2: Competency Standard */}
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#ffffff', border: '1px solid #ede9fe' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <DescriptionOutlinedIcon sx={{ color: '#6d5bd0', fontSize: 16 }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: colorTokens.text }}>
                    Tài liệu tiêu chuẩn đối chiếu
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: 11, color: colorTokens.neutral400, lineHeight: 1.4 }}>
                  Khung năng lực Lãnh đạo Vận hành 2026 (Bộ chuẩn doanh nghiệp) quy định quản lý cấp nhóm phải làm chủ kỹ thuật SBI và nhịp 1-on-1 hàng tuần.
                </Typography>
              </Box>

              {/* Point 3: Expected Outcome */}
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#166534', mb: 0.5 }}>
                  🎯 Kết quả kỳ vọng sau 4 tuần
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#166534', lineHeight: 1.4 }}>
                  Tăng 35% hiệu quả phối hợp công việc liên phòng ban và giảm 50% thời gian xử lý các hiểu lầm nội bộ.
                </Typography>
              </Box>
            </Stack>

            {/* AI Recalculate Button */}
            <Button
              fullWidth
              variant="outlined"
              onClick={handleRecalculate}
              disabled={recalculating}
              startIcon={
                recalculating ? (
                  <CircularProgress size={16} sx={{ color: '#6d5bd0' }} />
                ) : (
                  <RefreshRoundedIcon sx={{ color: '#6d5bd0' }} />
                )
              }
              sx={{
                mt: 2.5,
                borderRadius: '12px',
                borderColor: '#6d5bd0',
                color: '#6d5bd0',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 12,
                py: 1,
                '&:hover': { bgcolor: '#faf5ff', borderColor: '#5847be' },
              }}
            >
              {recalculating ? 'Đang phân tích lại sơ đồ...' : 'Yêu cầu AI tính toán lại sơ đồ'}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
