'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import PageSkeleton from '@/components/ui/PageSkeleton';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  approveAssessment,
  getAssessment,
  rejectAssessment,
  submitAssessment,
  updateAssessment,
  type AssessmentDetail,
} from '@/lib/api/assessmentsApi';
import { ASSESSMENT_STATUS_LABEL, ASSESSMENT_TYPE_LABEL } from '@/lib/labels';
import { colorTokens } from '@/theme/theme';

const MOODS = [
  { value: 'Energised', label: 'Tràn năng lượng' },
  { value: 'Steady', label: 'Ổn định' },
  { value: 'Stretched', label: 'Căng sức' },
  { value: 'Tired', label: 'Mệt' },
  { value: 'Frustrated', label: 'Bức bối' },
] as const;

/**
 * One assessment: fill it in while it is a draft, read it once submitted,
 * approve/reject it as an admin. Approval is the point where it becomes
 * permanent history for the person.
 */
export default function AssessmentDetailPage() {
  const params = useParams<{ id: string; assessmentId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const backHref = `/my-companies/${params.id}/assessments`;

  const [assessment, setAssessment] = React.useState<AssessmentDetail | null>(
    null,
  );
  const [scores, setScores] = React.useState<Record<string, number>>({});
  const [comments, setComments] = React.useState<Record<string, string>>({});
  const [mood, setMood] = React.useState('');
  const [highlights, setHighlights] = React.useState('');
  const [comment, setComment] = React.useState('');

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAssessment(params.assessmentId);
      setAssessment(data);
      setMood(data.mood ?? '');
      setHighlights(data.highlights ?? '');
      setComment(data.comment ?? '');
      setScores(
        Object.fromEntries(data.answers.map((a) => [a.questionId, a.score])),
      );
      setComments(
        Object.fromEntries(
          data.answers.map((a) => [a.questionId, a.comment ?? '']),
        ),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không tải được bài đánh giá này',
      );
    } finally {
      setLoading(false);
    }
  }, [params.assessmentId]);

  React.useEffect(() => {
    // Wrapped so the initial fetch's setState lands after the effect.
    void (async () => {
      await load();
    })();
  }, [load]);

  const isAdmin = user?.role === 'BOD' || user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isAuthor = assessment?.reviewerId === user?.id;
  const editable = assessment?.status === 'DRAFT' && isAuthor;
  const canReview = isAdmin && assessment?.status === 'SUBMITTED';

  const questions =
    assessment?.template.groups.flatMap((group) => group.questions) ?? [];
  const answeredCount = questions.filter(
    (q) => scores[q.id] !== undefined,
  ).length;

  const buildPayload = () => ({
    mood: mood || undefined,
    highlights: highlights || undefined,
    comment: comment || undefined,
    answers: Object.entries(scores).map(([questionId, score]) => ({
      questionId,
      score,
      comment: comments[questionId] || undefined,
    })),
  });

  const handleSaveDraft = async () => {
    if (!assessment) return;
    setBusy(true);
    setError(null);
    try {
      await updateAssessment(assessment.id, buildPayload());
      setNotice('Đã lưu bản nháp.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!assessment) return;
    if (answeredCount === 0) {
      setError('Chấm ít nhất một tiêu chí trước khi gửi.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitAssessment(assessment.id, buildPayload());
      setNotice('Đã gửi chờ duyệt.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!assessment) return;
    setBusy(true);
    setError(null);
    try {
      await approveAssessment(assessment.id);
      setNotice('Đã duyệt — bài này giờ nằm trong hồ sơ lâu dài.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không duyệt được');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!assessment) return;
    setBusy(true);
    setError(null);
    try {
      await rejectAssessment(assessment.id, comment || undefined);
      setNotice('Đã gửi lại cho người viết.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không từ chối được');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
        <PageHeader
          title={
            assessment
              ? assessment.type === 'SELF'
                ? 'Tự đánh giá hàng tháng'
                : `Đánh giá ${assessment.reviewee.name}`
              : 'Đánh giá'
          }
          subtitle={
            assessment?.cycle
              ? `${assessment.cycle.name} · ${assessment.cycle.period} · thang điểm: ${assessment.template.name}`
              : undefined
          }
          actions={
            <Button component={NextLink} href={backHref} variant="outlined">
              Quay lại
            </Button>
          }
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        ) : null}
        {loading ? (
          <PageSkeleton variant="cards" />
        ) : assessment ? (
          <>
            <Card sx={{ mb: 3 }}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}
              >
                <Chip label={ASSESSMENT_STATUS_LABEL[assessment.status] ?? assessment.status} color="primary" />
                <Chip label={ASSESSMENT_TYPE_LABEL[assessment.type] ?? assessment.type} variant="outlined" />
                {assessment.totalScore !== null ? (
                  <Chip
                    label={`Điểm có trọng số ${assessment.totalScore}/10`}
                    color="success"
                  />
                ) : null}
                <Typography variant="body2">
                  {answeredCount}/{questions.length} tiêu chí đã chấm
                </Typography>
                {assessment.approvedBy ? (
                  <Typography variant="body2">
                    Duyệt bởi {assessment.approvedBy.name}
                  </Typography>
                ) : null}
              </Stack>
            </Card>

            {assessment.type === 'SELF' ? (
              <Card title="Tháng này của bạn thế nào?" sx={{ mb: 3 }}>
                <Stack spacing={2}>
                  <TextField
                    select
                    label="Tâm trạng"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    disabled={!editable}
                    sx={{ maxWidth: 280 }}
                  >
                    {MOODS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Điểm nổi bật"
                    helperText="Tháng này điều gì nổi bật ở bạn?"
                    value={highlights}
                    onChange={(e) => setHighlights(e.target.value)}
                    disabled={!editable}
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Stack>
              </Card>
            ) : null}

            {assessment.template.groups.map((group) => (
              <Card
                key={group.id}
                title={group.name}
                sx={{ mb: 3 }}
                actions={
                  <Chip
                    label={`trọng số ${group.weight}`}
                    size="small"
                    variant="outlined"
                  />
                }
              >
                {group.description ? (
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {group.description}
                  </Typography>
                ) : null}

                <Stack divider={<Divider />} spacing={2.5}>
                  {group.questions.map((question) => (
                    <Box key={question.id} sx={{ pt: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {question.text}
                      </Typography>
                      {question.guidance ? (
                        <Typography
                          variant="body2"
                          sx={{ mt: 0.25, color: colorTokens.secondary }}
                        >
                          {question.guidance}
                        </Typography>
                      ) : null}

                      <Stack
                        direction="row"
                        spacing={2.5}
                        sx={{ alignItems: 'center', mt: 1.5 }}
                      >
                        <Slider
                          value={scores[question.id] ?? 0}
                          onChange={(_, value) =>
                            setScores({
                              ...scores,
                              [question.id]: value as number,
                            })
                          }
                          disabled={!editable}
                          min={0}
                          max={question.maxScore}
                          step={1}
                          marks
                          valueLabelDisplay="auto"
                          sx={{ maxWidth: 420 }}
                        />
                        <Chip
                          label={`${scores[question.id] ?? '–'} / ${question.maxScore}`}
                          size="small"
                        />
                      </Stack>

                      <TextField
                        label="Nhận xét"
                        value={comments[question.id] ?? ''}
                        onChange={(e) =>
                          setComments({
                            ...comments,
                            [question.id]: e.target.value,
                          })
                        }
                        disabled={!editable}
                        fullWidth
                        size="small"
                        sx={{ mt: 1.5 }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Card>
            ))}

            <Card title="Nhận xét chung" sx={{ mb: 3 }}>
              <TextField
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={!editable && !canReview}
                fullWidth
                multiline
                minRows={3}
                helperText={
                  canReview
                    ? 'Nếu gửi lại, nhận xét này sẽ cho người viết biết cần sửa gì.'
                    : undefined
                }
              />
            </Card>

            {busy ? <LinearProgress sx={{ mb: 2 }} /> : null}

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              {editable ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={handleSaveDraft}
                    disabled={busy}
                  >
                    Lưu nháp
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={busy}
                  >
                    Gửi duyệt
                  </Button>
                </>
              ) : null}

              {canReview ? (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleApprove}
                    disabled={busy}
                  >
                    Duyệt
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleReject}
                    disabled={busy}
                  >
                    Gửi lại
                  </Button>
                </>
              ) : null}

              {assessment.status === 'APPROVED' ? (
                <Button
                  variant="outlined"
                  onClick={() =>
                    router.push(
                      isAdmin && !isAuthor
                        ? `/my-companies/${params.id}/employees/${assessment.revieweeId}/passport`
                        : '/profile?tab=passport',
                    )
                  }
                >
                  Xem hộ chiếu nghề nghiệp
                </Button>
              ) : null}
            </Stack>
          </>
        ) : null}
    </PageContainer>
  );
}
