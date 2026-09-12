'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { colorTokens } from '@/theme/theme';
import type { DevelopmentMilestone } from '@/lib/api/developmentPlansApi';
import type { RoadmapCharacter } from './roadmapCharacters';
import { findCharacter } from './roadmapCharacters';

interface Props {
  milestones: DevelopmentMilestone[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Mascot only renders on the milestone the user is currently working on. */
  currentIndex?: number;
  character?: RoadmapCharacter | 'none';
  /** Smaller, label-less rendering used in the summary card / customize preview. */
  compact?: boolean;
  /** Roadmap start date (plan.createdAt) — used to compute the "Tuần N" label under each title. */
  startDate?: string;
}

type StepState = 'completed' | 'current' | 'upcoming' | 'goal';

/** Inline (not an <img>) so every completed step gets its own non-colliding gradient ids. */
function CheckBadge({ uid, size, height }: { uid: string; size: number; height: number }) {
  const radialId = `roadmap-check-radial-${uid}`;
  const linearId = `roadmap-check-linear-${uid}`;
  return (
    <svg width={size} height={height} viewBox="0 0 57 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M28.38 57.3513C42.4211 57.3513 53.8037 54.1747 53.8037 50.2563C53.8037 46.3378 42.4211 43.1613 28.38 43.1613C14.3388 43.1613 2.95624 46.3378 2.95624 50.2563C2.95624 54.1747 14.3388 57.3513 28.38 57.3513Z"
        fill={`url(#${radialId})`}
      />
      <path
        d="M28.38 48.4825C40.1354 48.4825 49.665 38.9529 49.665 27.1975C49.665 15.4421 40.1354 5.91248 28.38 5.91248C16.6246 5.91248 7.095 15.4421 7.095 27.1975C7.095 38.9529 16.6246 48.4825 28.38 48.4825Z"
        fill={`url(#${linearId})`}
      />
      <path
        d="M12.4163 21.285C14.19 14.19 20.6938 8.86878 28.38 8.27753"
        stroke="#B8F1CC"
        strokeOpacity="0.32"
        strokeWidth="1.47812"
        strokeLinecap="round"
      />
      <path
        d="M19.5113 27.7887L26.015 34.2925L38.4313 20.1025"
        stroke="white"
        strokeWidth="3.5475"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <radialGradient id={radialId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(28.38 50.2563) scale(25.4237 7.095)">
          <stop stopColor="#276C3E" stopOpacity="0.27" />
          <stop offset="1" stopColor="#276C3E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={linearId} x1="7.095" y1="5.91248" x2="49.665" y2="48.4825" gradientUnits="userSpaceOnUse">
          <stop stopColor="#45B27C" />
          <stop offset="0.6" stopColor="#249966" />
          <stop offset="1" stopColor="#187746" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CharacterOverlay({ src, alt, height, top }: { src: string; alt: string; height: number; top: number }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top,
        left: '50%',
        transform: 'translateX(-50%)',
        height,
        width: 'auto',
        zIndex: 3,
      }}
    >
      <img src={src} alt={alt} style={{ height: '100%', width: 'auto', objectFit: 'contain', display: 'block' }} />
    </Box>
  );
}

function StepArt({
  state,
  showCharacter,
  character,
  isDone,
  uid,
  compact,
}: {
  state: StepState;
  showCharacter: boolean;
  character?: RoadmapCharacter | 'none';
  isDone: boolean;
  uid: string;
  compact: boolean;
}) {
  const charOpt = showCharacter && character && character !== 'none' ? findCharacter(character) : null;
  const isBig = state === 'current' || state === 'goal';
  // Non-compact: fixed 132px platform width (matches step-*.svg native 132×78); current/goal
  // keeps the original 104:92 ratio bump, height derived from each SVG's own native aspect ratio.
  const platformW = compact ? Math.round((isBig ? 104 : 92) * 0.72) : isBig ? Math.round(132 * (104 / 92)) : 132;
  const platformH = compact
    ? Math.round((isBig ? 61 : 54) * 0.72)
    : isBig
      ? Math.round(platformW * (87 / 148))
      : Math.round(platformW * (78 / 132));
  const charHeight = compact ? 44 : 180;
  // Feet-into-platform overlap, scaled to charHeight using the compact ratio (14/44) that
  // already looks grounded — a fixed pixel overlap left the mascot floating at full size.
  const charOverlap = Math.round(charHeight * (14 / 44));
  const badgeSize = compact ? 24 : 42;
  const badgeHeightPx = compact ? Math.round((badgeSize * 60) / 57) : 42;

  if (state === 'goal') {
    const flagCropH = Math.round(platformH * 0.78);
    const flagW = Math.round(platformW * (47 / 148));
    const platformOverlap = Math.round(platformH * (6 / 44));
    // Not reached yet → gray podium (same as upcoming); only turns purple once actually done.
    const goalPlatformSrc = isDone ? '/roadmap/step-current.svg' : '/roadmap/step-upcoming.svg';
    return (
      <Box sx={{ position: 'relative', width: platformW, height: platformH + flagCropH - platformOverlap }}>
        <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: flagW, height: flagCropH, overflow: 'hidden' }}>
          <img src="/roadmap/step-goal.svg" alt="" width={flagW} height={Math.round(flagW * (79 / 47))} style={{ display: 'block' }} />
        </Box>
        <Box sx={{ position: 'absolute', bottom: 0, left: 0 }}>
          <img src={goalPlatformSrc} alt="mục tiêu" width={platformW} height={platformH} style={{ display: 'block' }} />
        </Box>
        {charOpt && <CharacterOverlay src={charOpt.src} alt={charOpt.label} height={charHeight} top={-(charHeight - charOverlap)} />}
      </Box>
    );
  }

  const stepSrc = `/roadmap/step-${state}.svg`;

  return (
    <Box sx={{ position: 'relative', width: platformW, height: platformH }}>
      <img src={stepSrc} alt={state} width={platformW} height={platformH} style={{ display: 'block' }} />
      {charOpt && <CharacterOverlay src={charOpt.src} alt={charOpt.label} height={charHeight} top={-(charHeight - charOverlap)} />}
      {isDone && (
        <Box sx={{ position: 'absolute', top: -(badgeHeightPx - 6), left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
          <CheckBadge uid={uid} size={badgeSize} height={badgeHeightPx} />
        </Box>
      )}
    </Box>
  );
}

interface Point {
  x: number;
  y: number;
}

/**
 * Purely visual staircase — one platform per milestone, evenly spaced across
 * the container width, with connector lines measured directly between each
 * pair of platforms so they always line up regardless of viewport size.
 * Clicking a step only reports the selection outward — its own appearance
 * never changes; the detail panel elsewhere reflects the selection.
 */
export default function RoadmapStaircase({
  milestones,
  selectedIndex,
  onSelect,
  currentIndex = -1,
  character,
  compact = false,
  startDate,
}: Props) {
  const sorted = React.useMemo(() => [...milestones].sort((a, b) => a.order - b.order), [milestones]);

  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const stepRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [points, setPoints] = React.useState<Point[]>([]);

  const recomputePoints = React.useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const next = stepRefs.current.slice(0, sorted.length).map((el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - trackRect.left, y: r.top + r.height / 2 - trackRect.top };
    });
    if (next.every((p): p is Point => p !== null)) setPoints(next);
  }, [sorted.length]);

  React.useLayoutEffect(() => {
    recomputePoints();
  }, [recomputePoints, compact]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recomputePoints());
    ro.observe(track);
    return () => ro.disconnect();
  }, [recomputePoints]);

  if (sorted.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: colorTokens.secondary, border: `1px dashed ${colorTokens.border}`, borderRadius: 2 }}>
        Chưa có cột mốc. Hãy dùng ô nhập bên dưới hoặc trợ lý AI để tạo lộ trình.
      </Box>
    );
  }

  const RISE = compact ? 24 : 46;
  const topPad = compact ? 30 : 190; // non-compact: room for 180px-tall character overlay above the platform
  const rowHeight = RISE * (sorted.length - 1) + (compact ? 44 : 61) + topPad;

  return (
    <Box sx={{ overflowX: 'auto', pb: compact ? 0.5 : 1 }}>
      <Box
        ref={trackRef}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: compact ? 1 : 2,
          minWidth: sorted.length * (compact ? 70 : 100),
          height: rowHeight,
          pt: `${topPad}px`,
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
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

          let state: StepState;
          if (isLast && !isCurrent) state = 'goal';
          else if (isDone) state = 'completed';
          else if (isCurrent) state = 'current';
          else state = 'upcoming';

          const weekLabel =
            m.dueDate && startDate
              ? `Tuần ${Math.max(
                  1,
                  Math.ceil((new Date(m.dueDate).getTime() - new Date(startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)),
                )}`
              : null;

          return (
            <Box
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(idx);
              }}
              sx={{
                position: 'relative',
                zIndex: 2,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: '0 0 auto',
                mb: `${idx * RISE}px`,
              }}
            >
              <Box ref={(el: HTMLDivElement | null) => { stepRefs.current[idx] = el; }} sx={{ position: 'relative' }}>
                <StepArt state={state} showCharacter={isCurrent} character={character} isDone={isDone} uid={m.id} compact={compact} />
                <Typography
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 8,
                    textAlign: 'center',
                    pointerEvents: 'none',
                    fontSize: compact ? 10 : 12,
                    fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.25)',
                  }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </Typography>
              </Box>
              {!compact && (
                <>
                  <Typography
                    sx={{
                      mt: 0.75,
                      fontSize: 11,
                      fontWeight: 500,
                      textAlign: 'center',
                      color: colorTokens.body,
                      maxWidth: 130,
                      whiteSpace: 'normal',
                    }}
                  >
                    {m.title}
                  </Typography>
                  {weekLabel && (
                    <Typography sx={{ fontSize: 10, color: colorTokens.secondary, textAlign: 'center' }}>
                      {weekLabel}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
