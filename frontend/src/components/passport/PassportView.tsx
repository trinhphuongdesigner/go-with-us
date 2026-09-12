'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import MarkdownBlock from '@/components/ui/MarkdownBlock';
import { colorTokens } from '@/theme/theme';
import type {
  CareerPassport,
  DimensionScores,
  PassportPeriod,
} from '@/lib/api/careerPassportApi';
import {
  ASSESSMENT_TYPE_LABEL,
  EMPLOYMENT_STATUS_LABEL,
  formatMonth,
} from '@/lib/labels';

/**
 * The read-only career record — the same view whether it is the owner, an
 * admin, or a prospective employer opening a share link. Only APPROVED
 * assessments reach this component (the backend filters them out).
 */
export default function PassportView({
  passport,
  actionsFor,
}: {
  passport: CareerPassport;
  /** Owner-only controls (e.g. "generate summary"), rendered per period. */
  actionsFor?: (period: PassportPeriod) => React.ReactNode;
}) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const validScores = passport.periods
    .map((p) => p.averageScore)
    .filter((s): s is number => s !== null);
  const overallAvgScore =
    validScores.length > 0
      ? (
          validScores.reduce((sum, s) => sum + s, 0) / validScores.length
        ).toFixed(1)
      : null;

  return (
    <>
      {/* Print Stylesheet for A4 export */}
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 14mm 12mm 16mm 12mm;
              }
              body {
                background-color: #ffffff !important;
                color: #1c2836 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              nav, header, aside, .no-print, button, [role="navigation"], #floating-assistant-root {
                display: none !important;
              }
              .passport-print-card {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                box-shadow: none !important;
                border: 1px solid #cbd5e1 !important;
                margin-bottom: 16px !important;
              }
              .print-watermark {
                display: block !important;
              }
            }
          `,
        }}
      />

      {/* Screen-only Action & Verified Banner */}
      <Box
        className="no-print"
        sx={{
          mb: 3,
          p: 2,
          borderRadius: '16px',
          bgcolor: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              bgcolor: 'rgba(45, 138, 110, 0.12)',
              color: colorTokens.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <VerifiedUserOutlinedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, color: colorTokens.text }}
            >
              Hồ sơ năng lực xác thực (Career Passport)
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: colorTokens.neutral400, display: 'block' }}
            >
              Lịch sử làm việc, kỹ năng và đánh giá đã được tổ chức phê duyệt,
              đồng hành cả đời cùng nhân sự.
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="outlined"
          size="sm"
          startIcon={<PrintOutlinedIcon />}
          onClick={handlePrint}
          sx={{ fontWeight: 600, flexShrink: 0 }}
        >
          In / Xuất PDF
        </Button>
      </Box>

      {/* Print-only Header Banner */}
      <Box
        className="print-watermark"
        sx={{
          display: 'none',
          '@media print': { display: 'block !important' },
          mb: 3,
          pb: 2,
          borderBottom: '2px solid #3368A0',
        }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: colorTokens.accent,
                letterSpacing: '0.04em',
              }}
            >
              CAREERMATE PASSPORT
            </Typography>
            <Typography variant="caption" sx={{ color: colorTokens.neutral400 }}>
              HỒ SƠ NĂNG LỰC & ĐÁNH GIÁ CHÍNH THỨC XUYÊN SUỐT SỰ NGHIỆP
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Chip
              icon={<WorkspacePremiumOutlinedIcon />}
              label="VERIFIED AUDIT RECORD"
              size="small"
              color="primary"
              sx={{ fontWeight: 700, fontSize: 11 }}
            />
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: colorTokens.neutral400,
                mt: 0.5,
              }}
            >
              Ngày xuất: {new Date().toLocaleDateString('vi-VN')}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Main Profile Summary Card */}
      <Card sx={{ mb: 3 }} className="passport-print-card">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2.5}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Avatar
            src={passport.user.avatarUrl ?? undefined}
            sx={{
              width: 64,
              height: 64,
              bgcolor: colorTokens.accent,
              color: colorTokens.accentContrast,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {passport.user.name?.[0]?.toUpperCase() ?? '?'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h2">{passport.user.name}</Typography>
            <Typography variant="body2" sx={{ mt: 0.25 }}>
              {passport.user.jobTitle ?? 'Chưa có chức danh'}
              {passport.user.company ? ` @ ${passport.user.company.name}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={3}>
            <Stat label="Kỳ làm việc" value={passport.periods.length} />
            <Stat
              label="Đánh giá"
              value={passport.periods.reduce(
                (sum, period) => sum + period.assessments.length,
                0,
              )}
            />
            {overallAvgScore ? (
              <Stat label="Điểm TB" value={`${overallAvgScore}/10`} />
            ) : null}
            <Stat label="Chứng chỉ" value={passport.certifications.length} />
          </Stack>
        </Stack>

        {passport.skills.length > 0 ? (
          <>
            <Divider sx={{ my: 2.5 }} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: colorTokens.neutral400,
                textTransform: 'uppercase',
                display: 'block',
                mb: 1,
              }}
            >
              Kỹ năng chuyên môn
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', gap: 1 }}
            >
              {passport.skills.map((entry) => (
                <Chip
                  key={entry.id}
                  label={`${entry.skill.name} · ${entry.level}/5`}
                  size="small"
                  variant={entry.level >= 4 ? 'filled' : 'outlined'}
                  color={entry.level >= 4 ? 'primary' : 'default'}
                />
              ))}
            </Stack>
          </>
        ) : null}
      </Card>

      {passport.overallSummary ? (
        <Card
          title="Tóm tắt sự nghiệp"
          sx={{ mb: 3 }}
          className="passport-print-card"
        >
          <MarkdownBlock source={passport.overallSummary.content} />
        </Card>
      ) : null}

      {passport.periods.length === 0 ? (
        <Card title="Lịch sử làm việc" className="passport-print-card">
          <Typography variant="body2">
            Chưa có kỳ làm việc nào được ghi nhận.
          </Typography>
        </Card>
      ) : (
        passport.periods.map((period) => (
          <Card
            key={period.id}
            sx={{ mb: 3 }}
            className="passport-print-card"
            title={`${period.jobTitle} @ ${period.company.name}`}
            actions={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                {period.averageScore !== null ? (
                  <Chip
                    label={`TB ${period.averageScore}/10`}
                    size="small"
                    color="success"
                  />
                ) : null}
                <Chip
                  label={EMPLOYMENT_STATUS_LABEL[period.status] ?? period.status}
                  size="small"
                  color={period.status === 'ACTIVE' ? 'primary' : 'default'}
                />
                {actionsFor ? actionsFor(period) : null}
              </Stack>
            }
          >
            <Typography variant="body2" sx={{ mb: 2 }}>
              {formatMonth(period.startDate)} → {formatMonth(period.endDate)}
              {period.level ? ` · ${period.level}` : ''}
              {period.department ? ` · ${period.department}` : ''}
            </Typography>

            {period.summary ? (
              <Box sx={{ mb: 2 }}>
                <MarkdownBlock source={period.summary.content} />

                {period.summary.dimensionScores ? (
                  <DimensionScoresBreakdown
                    scores={period.summary.dimensionScores}
                  />
                ) : null}

                {period.summary.strengths.length > 0 ? (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}
                  >
                    {period.summary.strengths.map((strength) => (
                      <Chip
                        key={strength}
                        label={strength}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ) : null}
                {period.summary.growthAreas.length > 0 ? (
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}
                  >
                    {period.summary.growthAreas.map((area) => (
                      <Chip
                        key={area}
                        label={area}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ) : null}
              </Box>
            ) : null}

            {period.projectExperiences.length > 0 ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Dự án đã tham gia
                </Typography>
                <Stack spacing={1}>
                  {period.projectExperiences.map((project) => (
                    <Box
                      key={project.id}
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        bgcolor: '#fafafc',
                        border: '1px solid #f0edf7',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {project.name} — {project.role}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: 12.5, color: '#475569', mt: 0.25 }}
                      >
                        {project.domain ? `${project.domain} · ` : ''}
                        {project.techStack.join(', ')}
                      </Typography>
                      {project.contribution ? (
                        <Typography
                          variant="body2"
                          sx={{ fontSize: 12, color: '#64748b', mt: 0.5 }}
                        >
                          {project.contribution}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}

            {period.assessments.length > 0 ? (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Đánh giá đã duyệt
                </Typography>
                <Stack divider={<Divider />} spacing={1}>
                  {period.assessments.map((assessment) => (
                    <Box
                      key={assessment.id}
                      sx={{
                        pt: 0.75,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {assessment.cycle?.period ?? 'n/a'} ·{' '}
                          {ASSESSMENT_TYPE_LABEL[assessment.type] ??
                            assessment.type}
                        </Typography>
                        {assessment.highlights ? (
                          <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                            {assessment.highlights}
                          </Typography>
                        ) : null}
                      </Box>
                      {assessment.totalScore !== null ? (
                        <Chip
                          label={`${assessment.totalScore}/10`}
                          size="small"
                          color={
                            assessment.totalScore >= 7
                              ? 'success'
                              : assessment.totalScore >= 5
                                ? 'warning'
                                : 'default'
                          }
                        />
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Card>
        ))
      )}

      {passport.certifications.length > 0 || passport.awards.length > 0 ? (
        <Card
          title="Chứng chỉ & thành tích"
          className="passport-print-card"
        >
          <Stack spacing={1.5}>
            {passport.certifications.map((certification) => (
              <Typography key={certification.id} variant="body2">
                🎓 {certification.name}
                {certification.score ? ` · Điểm: ${certification.score}` : ''}
                {certification.issuer ? ` · Đơn vị cấp: ${certification.issuer}` : ''}
              </Typography>
            ))}
            {passport.awards.map((award) => (
              <Typography key={award.id} variant="body2">
                🏆 {award.title}
                {award.issuer ? ` · Đơn vị: ${award.issuer}` : ''}
                {award.category === 'PERSONAL' ? ' · cá nhân' : ''}
                {award.description ? ` — ${award.description}` : ''}
              </Typography>
            ))}
          </Stack>
        </Card>
      ) : null}

      {/* Print-only footer */}
      <Box
        className="print-watermark"
        sx={{
          display: 'none',
          '@media print': { display: 'block !important' },
          mt: 4,
          pt: 2,
          borderTop: '1px solid #cbd5e1',
          textAlign: 'center',
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: colorTokens.neutral400, fontSize: 11 }}
        >
          Tài liệu được trích xuất từ nền tảng CareerMate • Xác thực tự động bởi
          hệ thống đánh giá năng lực • Ngày xuất:{' '}
          {new Date().toLocaleDateString('vi-VN')}
        </Typography>
      </Box>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h2" sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
    </Box>
  );
}

function DimensionScoresBreakdown({ scores }: { scores: DimensionScores }) {
  const dimensions = [
    {
      label: 'Chuyên cần & Đúng hạn',
      key: 'attendance',
      value: scores.attendance,
    },
    {
      label: 'Chủ động & Tiên phong',
      key: 'proactiveness',
      value: scores.proactiveness,
    },
    {
      label: 'Kiến thức chuyên môn',
      key: 'knowledge',
      value: scores.knowledge,
    },
    {
      label: 'Kỹ năng & Thực thi',
      key: 'skill',
      value: scores.skill,
    },
    {
      label: 'Tích cực tham gia hoạt động',
      key: 'activityParticipation',
      value: scores.activityParticipation,
    },
  ];

  return (
    <Box
      sx={{
        my: 2,
        p: 2,
        borderRadius: '12px',
        bgcolor: '#fafafc',
        border: '1px solid #f0edf7',
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, mb: 1.5, color: colorTokens.text }}
      >
        Đánh giá 5 trục năng lực chuẩn hóa (Thang 10):
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
          gap: 1.5,
        }}
      >
        {dimensions.map((dim) => (
          <Box
            key={dim.key}
            sx={{
              p: 1.25,
              bgcolor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e8e7f0',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                mb: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: '#475569' }}
              >
                {dim.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: colorTokens.accent }}
              >
                {dim.value}/10
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, dim.value * 10)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: '#e2e8f0',
                '& .MuiLinearProgress-bar': {
                  bgcolor:
                    dim.value >= 8 ? colorTokens.success : colorTokens.accent,
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

