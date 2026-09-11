'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import Card from '@/components/ui/Card';
import { ApiError } from '@/lib/api/client';
import {
  approveOffboardingSummary,
  listPendingOffboardingSummaries,
  triggerOffboardingSummary,
  updateOffboardingSummary,
  type PendingOffboardingSummary,
} from '@/lib/api/careerPassportApi';
import { colorTokens } from '@/theme/theme';

const DIMENSION_LABEL: Record<string, string> = {
  attendance: 'Chuyên cần',
  proactiveness: 'Chủ động',
  knowledge: 'Kiến thức',
  skill: 'Kỹ năng',
  activityParticipation: 'Tham gia hoạt động',
};

/**
 * Admin-side queue for org-verified offboarding summaries: trigger the AI
 * (redacted narrative + locked evaluation), edit ONLY the narrative, then
 * approve — the evaluation/dimensionScores never go through this UI's edit
 * path because the API itself only accepts `content` on update.
 */
export default function OffboardingQueue() {
  const [items, setItems] = React.useState<PendingOffboardingSummary[] | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    try {
      const list = await listPendingOffboardingSummaries();
      setItems(list);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const item of list) {
          if (next[item.id] === undefined) next[item.id] = item.content;
        }
        return next;
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không tải được hàng chờ nghỉ việc',
      );
    }
  }, []);

  React.useEffect(() => {
    // Wrapped so the initial fetch's setState lands after the effect.
    void (async () => {
      await load();
    })();
  }, [load]);

  const handleTrigger = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await triggerOffboardingSummary(id);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không tạo được tóm tắt',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveNarrative = async (id: string) => {
    const content = drafts[id];
    if (!content?.trim()) return;
    setBusyId(id);
    setError(null);
    try {
      await updateOffboardingSummary(id, content);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được chỉnh sửa');
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await approveOffboardingSummary(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không duyệt được');
    } finally {
      setBusyId(null);
    }
  };

  if (!items) {
    return (
      <Card title="Yêu cầu nghỉ việc">
        <PageSkeleton variant="list" rows={3} embedded />
      </Card>
    );
  }

  return (
    <Card title={`Yêu cầu nghỉ việc (${items.length})`} sx={{ mb: 3 }}>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <Typography variant="body2">Hiện không có yêu cầu nào chờ bạn.</Typography>
      ) : (
        <Stack divider={<Divider />} spacing={3}>
          {items.map((item) => (
            <Box key={item.id} sx={{ pt: 1 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                sx={{ justifyContent: 'space-between', gap: 1, mb: 1.5 }}
              >
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {item.user.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                    {item.employment
                      ? `${item.employment.jobTitle} @ ${item.employment.company.name}`
                      : 'Chưa có kỳ làm việc'}
                  </Typography>
                </Box>
                <Chip
                  label={item.generatedAt ? 'Sẵn sàng xem' : 'Đã yêu cầu'}
                  size="small"
                  color={item.generatedAt ? 'warning' : 'default'}
                />
              </Stack>

              {!item.generatedAt ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AutoAwesomeOutlinedIcon />}
                  onClick={() => handleTrigger(item.id)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? 'Đang viết...' : 'Kích hoạt tóm tắt AI'}
                </Button>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 1.5 }}>
                    Bạn có thể sửa phần tường thuật bên dưới (tên dự án/khách hàng
                    đã được ẩn). Phần đánh giá và điểm lấy từ bài đã duyệt, không
                    sửa được ở đây.
                  </Alert>

                  <TextField
                    label="Tường thuật (có thể sửa)"
                    value={drafts[item.id] ?? ''}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    fullWidth
                    multiline
                    minRows={4}
                    sx={{ mb: 1.5 }}
                  />

                  {item.evaluation ? (
                    <Box
                      sx={{
                        p: 1.5,
                        mb: 1.5,
                        borderRadius: 1,
                        backgroundColor: colorTokens.bg,
                        border: `1px solid ${colorTokens.divider}`,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Đánh giá (khóa)
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {item.evaluation}
                      </Typography>
                    </Box>
                  ) : null}

                  {item.dimensionScores ? (
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}
                    >
                      {Object.entries(item.dimensionScores).map(([key, value]) => (
                        <Chip
                          key={key}
                          label={`${DIMENSION_LABEL[key] ?? key}: ${value}/10`}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  ) : null}

                  <Stack direction="row" spacing={1.5}>
                    <Button
                      size="small"
                      onClick={() => handleSaveNarrative(item.id)}
                      disabled={busyId === item.id}
                    >
                      Lưu chỉnh sửa tường thuật
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => handleApprove(item.id)}
                      disabled={busyId === item.id}
                    >
                      Duyệt
                    </Button>
                  </Stack>
                </>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Card>
  );
}
