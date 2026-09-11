import { createTheme } from '@mui/material/styles';

/**
 * DEFAULT theme — always used for the Admin side (Super Admin + Company
 * Admin), regardless of any Employee "concept" switcher built later (see
 * ThemeConcept in the backend Prisma schema: DEFAULT/ANIME/FILM/
 * GATHER_TOWN — only ANIME/FILM/GATHER_TOWN reskin the Employee UI).
 *
 * Implements D:\Coding\AI_Tool\docs\style-concept.md exactly — tokens,
 * typography, radius/shadow scale, and the MUI component override table.
 */

export const colorTokens = {
  bg: '#fafafc',
  canvas: '#e9e7f2',
  surface: '#ffffff',
  text: '#1c1b2e',
  neutral400: '#6e6c87',
  neutral500: '#8b899f',
  divider: '#e8e7f0',
  accent: '#6d5bd0',
  accent300: '#5847be',
  accent700: '#8577de',
  accent900: '#efebfa',
  success: '#1c9c6b',
  danger: '#d34848',
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

const fontFamily = 'var(--font-google-sans), system-ui, sans-serif';

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
      fontSize: 32,
      fontWeight: 500,
      letterSpacing: '-0.01em',
    },
    h2: {
      fontSize: 22,
      fontWeight: 500,
    },
    h3: {
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
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colorTokens.accent,
            boxShadow: '0 0 0 3px rgba(109,91,208,.14)',
          },
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
