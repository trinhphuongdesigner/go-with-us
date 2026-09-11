'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { colorTokens } from '@/theme/theme';
import { loadingSizes, type LoadingSizeToken } from '@/theme/tokens';

export type LoadingSize = LoadingSizeToken | number;

export type LoadingVariant = 'inline' | 'fill' | 'fullscreen';

export interface LoadingProps {
  /** Preset (`sm` 32 / `md` 48 / `lg` 64) or a pixel number. */
  size?: LoadingSize;
  /**
   * `inline` — book only.
   * `fill` — centered in the parent / remaining page (default).
   * `fullscreen` — centered on the viewport.
   */
  variant?: LoadingVariant;
  /** Optional caption under the book. */
  label?: React.ReactNode;
  /** Override `fill` min-height when a card or short region should stay compact. */
  minHeight?: number | string;
}

function resolveSize(size: LoadingSize): number {
  return typeof size === 'number' ? size : loadingSizes[size];
}

function BookIcon({ size }: { size: number }) {
  const pageTop = size * 0.125;
  const pageWidth = size * 0.4375;
  const pageHeight = size * 0.6;
  const inset = size * 0.0625;
  const pageRadius = '1px 2px 2px 1px';

  const sheetSx = {
    position: 'absolute',
    top: pageTop,
    width: pageWidth,
    height: pageHeight,
    borderRadius: pageRadius,
    border: '1px solid #a0a0a0',
    boxSizing: 'border-box',
  } as const;

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
        perspective: size * 5.5,
        transformStyle: 'preserve-3d',
        '@keyframes bookPageTurn': {
          '0%': { transform: 'rotateY(0deg)' },
          '8%': { transform: 'rotateY(0deg)' },
          '42%': { transform: 'rotateY(-180deg)' },
          '50%': { transform: 'rotateY(-180deg)' },
          '58%': { transform: 'rotateY(-180deg)' },
          '92%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          top: pageTop,
          width: pageWidth,
          height: pageHeight,
          bgcolor: colorTokens.neutral400,
          borderRadius: '2px',
        },
        '&::before': {
          left: inset,
          transform: 'skewY(8deg)',
        },
        '&::after': {
          right: inset,
          transform: 'skewY(-8deg)',
        },
      }}
    >
      <Box
        sx={{
          ...sheetSx,
          left: inset,
          zIndex: 1,
          bgcolor: '#e8e8e8',
          transform: 'skewY(8deg)',
        }}
      />
      <Box
        sx={{
          ...sheetSx,
          left: '50%',
          zIndex: 2,
          bgcolor: '#f4f4f4',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          zIndex: 10,
          left: 'calc(50% - 1px)',
          top: pageTop,
          width: 2,
          height: pageHeight,
          bgcolor: '#707070',
          borderRadius: '2px',
        }}
      />
      <Box
        sx={{
          ...sheetSx,
          left: '50%',
          zIndex: 5,
          border: 'none',
          transformOrigin: 'left center',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          animation: 'bookPageTurn 2.2s cubic-bezier(0.45, 0.02, 0.2, 1) infinite',
          '@media (prefers-reduced-motion: reduce)': {
            animationDuration: '3.6s',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: colorTokens.surface,
            border: '1px solid #a0a0a0',
            borderRadius: pageRadius,
            backfaceVisibility: 'hidden',
            boxShadow: '2px 0 6px rgba(28, 40, 54, 0.12)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: '#ececec',
            border: '1px solid #a0a0a0',
            borderRadius: '2px 1px 1px 2px',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        />
      </Box>
    </Box>
  );
}

/**
 * Shared book-page loader. Use `fill` for page/tab fetches, `fullscreen`
 * for auth / route transitions, `inline` or a smaller `size` inside a card.
 */
export default function Loading({
  size = 'md',
  variant = 'fill',
  label,
  minHeight,
}: LoadingProps) {
  const px = resolveSize(size);
  const accessibleLabel = typeof label === 'string' && label.trim() ? label : 'Loading';

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <BookIcon size={px} />
      {label ? (
        <Typography variant="body2" sx={{ color: colorTokens.neutral400 }}>
          {label}
        </Typography>
      ) : null}
    </Box>
  );

  if (variant === 'inline') {
    return (
      <Box role="status" aria-live="polite" aria-label={accessibleLabel} sx={{ display: 'inline-flex' }}>
        {content}
      </Box>
    );
  }

  const isFullscreen = variant === 'fullscreen';

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={accessibleLabel}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: isFullscreen ? '100dvh' : (minHeight ?? 'calc(100dvh - 220px)'),
        ...(isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
              bgcolor: colorTokens.bg,
            }
          : null),
      }}
    >
      {content}
    </Box>
  );
}
