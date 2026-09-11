'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Button from '@/components/ui/Button';
import { colorTokens, radiusTokens } from '@/theme/theme';
import type { DevelopmentMilestone } from '@/lib/api/developmentPlansApi';

interface Props {
  milestone: DevelopmentMilestone | undefined;
  index: number;
  onToggleTask?: (taskId: string, done: boolean) => void;
  onViewDiagram?: () => void;
  readOnly?: boolean;
}

/** Right-hand detail panel for the Bậc thang view — one milestone's checklist. */
export default function RoadmapDetailPanel({ milestone, index, onToggleTask, onViewDiagram, readOnly = false }: Props) {
  if (!milestone) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: colorTokens.secondary }}>
        Chọn một cột mốc trên bậc thang để xem chi tiết.
      </Box>
    );
  }

  const done = milestone.tasks.filter((t) => t.done).length;
  const total = milestone.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dateLabel = milestone.dueDate
    ? `Hạn: ${new Date(milestone.dueDate).toLocaleDateString('vi-VN')}`
    : null;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: `${radiusTokens.md}px`,
        border: `1px solid ${colorTokens.border}`,
        bgcolor: colorTokens.surface,
        height: '100%',
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: colorTokens.primary, letterSpacing: '0.06em' }}>
        CỘT MỐC {String(index + 1).padStart(2, '0')}
      </Typography>
      <Typography sx={{ fontWeight: 600, fontSize: 16, mt: 0.5, mb: dateLabel ? 0.25 : 1 }}>
        {milestone.title}
      </Typography>
      {dateLabel && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>{dateLabel}</Typography>
      )}

      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption">{done}/{total} nhiệm vụ</Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>{pct}%</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3, mb: 1.5 }} />

      <Stack spacing={0.75} sx={{ mb: 2 }}>
        {milestone.tasks.map((t) => (
          <Stack key={t.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={t.done}
              disabled={readOnly || !onToggleTask}
              onChange={(e) => onToggleTask?.(t.id, e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: 13,
                textDecoration: t.done ? 'line-through' : 'none',
                color: t.done ? colorTokens.secondary : colorTokens.heading,
              }}
            >
              {t.title}
            </Typography>
          </Stack>
        ))}
        {total === 0 && (
          <Typography variant="body2" sx={{ color: colorTokens.secondary }}>
            Chưa có nhiệm vụ nào cho cột mốc này.
          </Typography>
        )}
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        {!readOnly && (
          <Button variant="contained" size="sm">
            Tiếp tục bước {index + 1}
          </Button>
        )}
        {onViewDiagram && (
          <Button variant="text" size="sm" endIcon={<ArrowForwardRoundedIcon fontSize="small" />} onClick={onViewDiagram}>
            Xem sơ đồ chi tiết
          </Button>
        )}
      </Stack>
    </Box>
  );
}
