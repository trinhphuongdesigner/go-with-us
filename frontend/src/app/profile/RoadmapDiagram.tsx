'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import { colorTokens, radiusTokens } from '@/theme/theme';
import type { DevelopmentMilestone } from '@/lib/api/developmentPlansApi';

interface Props {
  milestones: DevelopmentMilestone[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  currentIndex?: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * "Sơ đồ" view — a horizontal row of milestone cards (no task tree), linked
 * by the same dashed→solid-purple connector styling as RoadmapStaircase.
 * Tasks for the selected milestone are shown by RoadmapDetailPanel, reused
 * as-is by the caller — this component only renders the milestone row.
 */
export default function RoadmapDiagram({ milestones, selectedIndex, onSelect, currentIndex = -1 }: Props) {
  const sorted = React.useMemo(() => [...milestones].sort((a, b) => a.order - b.order), [milestones]);

  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [points, setPoints] = React.useState<Point[]>([]);

  const recomputePoints = React.useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const next = cardRefs.current.slice(0, sorted.length).map((el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - trackRect.left, y: r.top + r.height / 2 - trackRect.top };
    });
    if (next.every((p): p is Point => p !== null)) setPoints(next);
  }, [sorted.length]);

  React.useLayoutEffect(() => {
    recomputePoints();
  }, [recomputePoints]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recomputePoints());
    ro.observe(track);
    return () => ro.disconnect();
  }, [recomputePoints]);

  if (sorted.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: colorTokens.secondary }}>
        Chưa có cột mốc để hiển thị sơ đồ.
      </Box>
    );
  }

  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Box
        ref={trackRef}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sorted.length > 1 ? 'space-between' : 'flex-start',
          gap: 2,
          minWidth: sorted.length * 150,
          py: 2,
        }}
      >
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
          {points.slice(0, -1).map((p, idx) => {
            const next = points[idx + 1];
            if (!next) return null;
            const completed = sorted[idx]?.status === 'DONE';
            return completed ? (
              <line
                key={`conn-${idx}`}
                x1={p.x}
                y1={p.y}
                x2={next.x}
                y2={next.y}
                stroke="#7B58D7"
                strokeWidth={3}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 2px 3px rgba(123,88,215,0.45))' }}
              />
            ) : (
              <line
                key={`conn-${idx}`}
                x1={p.x}
                y1={p.y}
                x2={next.x}
                y2={next.y}
                stroke={colorTokens.selectedBorder}
                strokeWidth={2}
                strokeDasharray="6 6"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {sorted.map((m, idx) => {
          const isDone = m.status === 'DONE';
          const isCurrent = idx === currentIndex;
          const isLast = idx === sorted.length - 1;
          const isSelected = idx === selectedIndex;

          return (
            <Box
              key={m.id}
              ref={(el: HTMLDivElement | null) => { cardRefs.current[idx] = el; }}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(idx);
              }}
              sx={{
                position: 'relative',
                zIndex: 2,
                flex: '0 0 auto',
                width: 132,
                cursor: 'pointer',
                p: 1.25,
                borderRadius: `${radiusTokens.sm}px`,
                bgcolor: isDone ? '#F4F0FE' : isCurrent ? colorTokens.primarySubtle : colorTokens.surface,
                border: `1.5px solid ${isSelected ? colorTokens.primary : isDone ? '#C9B8F5' : colorTokens.border}`,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  mx: 'auto',
                  mb: 0.75,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isDone ? '#7B58D7' : isLast ? colorTokens.sand : colorTokens.muted,
                  color: isDone ? '#fff' : colorTokens.body,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {isDone ? (
                  <CheckRoundedIcon fontSize="small" />
                ) : isLast ? (
                  <FlagRoundedIcon fontSize="small" />
                ) : (
                  String(idx + 1).padStart(2, '0')
                )}
              </Box>
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colorTokens.heading,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {m.title}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
