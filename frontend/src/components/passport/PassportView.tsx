'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@/components/ui/Card';
import MarkdownBlock from '@/components/ui/MarkdownBlock';
import { colorTokens } from '@/theme/theme';
import type { CareerPassport, PassportPeriod } from '@/lib/api/careerPassportApi';
import { ASSESSMENT_TYPE_LABEL, EMPLOYMENT_STATUS_LABEL, formatMonth } from '@/lib/labels';

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
  return (
    <>
      <Card sx={{ mb: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2.5}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Avatar
            src={passport.user.avatarUrl ?? undefined}
            sx={{ width: 64, height: 64, bgcolor: colorTokens.primary, color: '#ffffff' }}
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
            <Stat label="Vị trí" value={passport.periods.length} />
            <Stat
              label="Đánh giá"
              value={passport.periods.reduce(
                (sum, period) => sum + period.assessments.length,
                0,
              )}
            />
            <Stat label="Chứng chỉ" value={passport.certifications.length} />
          </Stack>
        </Stack>

        {passport.skills.length > 0 ? (
          <>
            <Divider sx={{ my: 2.5 }} />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
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
        <Card title="Tóm tắt sự nghiệp" sx={{ mb: 3 }}>
          <MarkdownBlock source={passport.overallSummary.content} />
        </Card>
      ) : null}

      {passport.periods.length === 0 ? (
        <Card title="Lịch sử làm việc">
          <Typography variant="body2">
            Chưa có kỳ làm việc nào được ghi nhận.
          </Typography>
        </Card>
      ) : (
        passport.periods.map((period) => (
          <Card
            key={period.id}
            sx={{ mb: 3 }}
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
                  Dự án
                </Typography>
                <Stack spacing={1}>
                  {period.projectExperiences.map((project) => (
                    <Box key={project.id}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {project.name} — {project.role}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                        {project.domain ? `${project.domain} · ` : ''}
                        {project.techStack.join(', ')}
                      </Typography>
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
                          {assessment.cycle?.period ?? 'n/a'} · {ASSESSMENT_TYPE_LABEL[assessment.type] ?? assessment.type}
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
        <Card title="Chứng chỉ & thành tích">
          <Stack spacing={1.5}>
            {passport.certifications.map((certification) => (
              <Typography key={certification.id} variant="body2">
                🎓 {certification.name}
                {certification.score ? ` · ${certification.score}` : ''}
                {certification.issuer ? ` · ${certification.issuer}` : ''}
              </Typography>
            ))}
            {passport.awards.map((award) => (
              <Typography key={award.id} variant="body2">
                🏆 {award.title}
                {award.issuer ? ` · ${award.issuer}` : ''}
                {award.category === 'PERSONAL' ? ' · cá nhân' : ''}
              </Typography>
            ))}
          </Stack>
        </Card>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
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
