import { createTheme } from '@mui/material/styles';

/**
 * DEFAULT theme — always used for the Admin side (Super Admin + Company
 * Admin), regardless of any Employee "concept" switcher built later (see
 * ThemeConcept in the backend Prisma schema: DEFAULT/ANIME/FILM/
 * GATHER_TOWN — only ANIME/FILM/GATHER_TOWN reskin the Employee UI).
 *
 * Radius/shadow scale and component shape still follow
 * D:\Coding\AI_Tool\docs\style-concept.md; the color tokens below are this
 * project's own earthy green/brown palette (swapped in from the original
 * purple reference) — see `accentInk` note for why text/icon color on the
 * accent family isn't just `accent`/`accent300` everywhere.
 */

export const colorTokens = {
  bg: '#d4dcc8',
  canvas: '#d4dcc8',
  surface: '#ffffff',
  text: '#1a1a1a',
  neutral400: '#75765f',
  neutral500: '#75765f',
  divider: '#d4dcc8',
  accent: '#9bce2d',
  accent300: '#8fb73c',
  accent700: '#abc385',
  accent900: '#d4dcc8',
  // None of the greens above are dark/saturated enough to read as text or a
  // small icon glyph against a white/accent900 background (fails contrast).
  // Use this instead of `accent`/`accent300` wherever the color is applied
  // as `color:`/text/icon foreground rather than a fill or border.
  accentInk: '#a8603a',
  warning: '#d5871e',
  success: '#8fb73c',
  danger: '#a8603a',
  // Unused elsewhere in the given swatch set — kept for future status/tint work.
  tint: '#f8c885',
} as const;

export const radiusTokens = {
  sm: 8,
  md: 14,
  lg: 22,
} as const;

export const shadowTokens = {
  card: '0 1px 2px rgba(28,27,46,.04), 0 8px 22px rgba(28,27,46,.07)',
  md: '0 4px 16px rgba(28,27,46,.14)',
  lg: '0 24px 60px rgba(28,27,46,.18)',
} as const;

// Body copy default; `h1`/`h2`/`h3`/`button` below override to the heading/UI
// fonts — see `--font-*` tokens in globals.css.
const fontFamily = 'var(--font-body), system-ui, sans-serif';
const headingFontFamily = 'var(--font-heading), system-ui, sans-serif';
const uiFontFamily = 'var(--font-ui), system-ui, sans-serif';

export const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: colorTokens.bg,
      paper: colorTokens.surface,
    },
    text: {
      primary: colorTokens.text,
      secondary: colorTokens.neutral400,
    },
    divider: colorTokens.divider,
    primary: {
      main: colorTokens.accent,
      dark: colorTokens.accent300,
      light: colorTokens.accent700,
      contrastText: '#ffffff',
    },
    success: {
      main: colorTokens.success,
    },
    error: {
      main: colorTokens.danger,
    },
  },
  shape: {
    borderRadius: radiusTokens.md,
  },
  typography: {
    fontFamily,
    h1: {
      fontFamily: headingFontFamily,
      fontSize: 32,
      fontWeight: 500,
      letterSpacing: '-0.01em',
    },
    h2: {
      fontFamily: headingFontFamily,
      fontSize: 22,
      fontWeight: 500,
    },
    h3: {
      fontFamily: headingFontFamily,
      fontSize: 19,
      fontWeight: 500,
    },
    body1: {
      fontSize: 15,
      lineHeight: 1.55,
    },
    body2: {
      fontSize: 14,
      color: colorTokens.neutral400,
    },
    button: {
      fontFamily: uiFontFamily,
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colorTokens.canvas,
        },
        '*::-webkit-scrollbar': {
          width: 9,
          height: 9,
        },
        '*::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '*::-webkit-scrollbar-thumb': {
          background: '#c9c8d6',
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
          minHeight: 44,
          padding: '10px 18px',
          fontSize: 14.5,
          fontWeight: 500,
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
          border: `1px solid ${colorTokens.divider}`,
          boxShadow: shadowTokens.card,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
          backgroundColor: colorTokens.surface,
          boxShadow: 'none',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: colorTokens.divider,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#a8a6ba',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colorTokens.accent,
            boxShadow: '0 0 0 3px rgba(109,91,208,.14)',
          },
        },
        input: {
          fontSize: 14,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(28,27,46,.65)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
          fontSize: 12,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          color: colorTokens.neutral500,
          borderTop: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          border: `1px solid ${colorTokens.divider}`,
          boxShadow: shadowTokens.md,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          marginLeft: 6,
          marginRight: 6,
          fontSize: 13.5,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
        enterDelay: 300,
      },
      styleOverrides: {
        tooltip: {
          backgroundColor: colorTokens.text,
          color: '#ffffff',
          borderRadius: 8,
        },
        arrow: {
          color: colorTokens.text,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: radiusTokens.lg,
          boxShadow: shadowTokens.lg,
        },
      },
    },
  },
});

export default theme;
