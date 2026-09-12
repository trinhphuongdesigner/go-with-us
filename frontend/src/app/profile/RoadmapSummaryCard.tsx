'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Button from '@/components/ui/Button';
import { colorTokens, radiusTokens } from '@/theme/theme';
import type { DevelopmentMilestone } from '@/lib/api/developmentPlansApi';
import type { RoadmapCharacter } from './roadmapCharacters';
import RoadmapStaircase from './RoadmapStaircase';

interface Props {
  goalTitle: string | null;
  milestones: DevelopmentMilestone[];
  currentIndex: number;
  durationWeeks?: number | null;
  hoursPerWeek?: number | null;
  character?: RoadmapCharacter | 'none';
  isDraft?: boolean;
  /** Whether the caller's detail view (staircase/diagram) is currently expanded — only used to flip the "Xem toàn bộ lộ trình" label; RoadmapSection owns the actual expand/collapse state. */
  expanded?: boolean;
  /** Forwarded to RoadmapStaircase — false renders the full-size staircase (character art + milestone titles) instead of the tiny compact preview. Default true. */
  compact?: boolean;
  onContinue?: () => void;
  onViewAll?: () => void;
}

/**
 * Header card for the "Lộ trình phát triển" tab once a roadmap has real
 * saved milestones — replaces the old RoadmapBanner text bar with a
 * compact staircase preview (same visual language as the full staircase).
 */
export default function RoadmapSummaryCard({
  goalTitle,
  milestones,
  currentIndex,
  durationWeeks,
  hoursPerWeek,
  character,
  isDraft = false,
  expanded,
  compact = true,
  onContinue,
  onViewAll,
}: Props) {
  const done = milestones.filter((m) => m.status === 'DONE').length;
  const total = milestones.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentTitle = milestones[activeIndex]?.title ?? null;
  const paceText =
    durationWeeks || hoursPerWeek
      ? [durationWeeks ? `${durationWeeks} tuần` : null, hoursPerWeek ? `${hoursPerWeek} giờ mỗi tuần` : null]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: `${radiusTokens.md}px`,
        bgcolor: isDraft ? colorTokens.sand : colorTokens.primarySubtle,
        border: `1px solid ${isDraft ? colorTokens.sand : colorTokens.selectedBorder}`,
      }}
    >
      {isDraft && (
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: colorTokens.danger, mb: 0.5 }}>
          ĐỀ XUẤT AI · CHƯA LƯU
        </Typography>
      )}
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: colorTokens.primary, letterSpacing: '0.08em', mb: 0.5 }}>
        LỘ TRÌNH CỦA BẠN
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 20, color: colorTokens.heading, mb: 0.5 }}>
        {goalTitle ?? 'Mục tiêu của bạn'}
      </Typography>
      {currentTitle && (
        <Typography variant="body2" sx={{ color: colorTokens.body, mb: 2 }}>
          Bạn đang ở bước {activeIndex + 1}: {currentTitle}.
        </Typography>
      )}

      <Box sx={{ mb: 2 }}>
        <RoadmapStaircase
          milestones={milestones}
          selectedIndex={-1}
          onSelect={() => undefined}
          currentIndex={activeIndex}
          character={character}
          compact={compact}
        />
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 3 }} sx={{ alignItems: { sm: 'center' }, mb: 2 }}>
        <Box sx={{ minWidth: 200, flex: 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption">{done}/{total} cột mốc hoàn thành</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{pct}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
        </Box>
        {paceText && (
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap', color: colorTokens.body }}>
            {paceText}
          </Typography>
        )}
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        {onContinue && (
          <Button variant="contained" size="sm" onClick={onContinue}>
            Tiếp tục bước {activeIndex + 1}
          </Button>
        )}
        {onViewAll && (
          <Button variant="text" size="sm" endIcon={<ArrowForwardRoundedIcon fontSize="small" />} onClick={onViewAll}>
            {expanded ? 'Thu gọn lộ trình' : 'Xem toàn bộ lộ trình'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
