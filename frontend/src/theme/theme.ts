import { createTheme } from '@mui/material/styles';
import { buttonSizes, iconSizes, loadingSizes } from './tokens';

/**
 * DEFAULT theme — always used for the Admin side (Super Admin + Company
 * Admin), regardless of any Employee "concept" switcher built later (see
 * ThemeConcept in the backend Prisma schema: DEFAULT/ANIME/FILM/
 * GATHER_TOWN — only ANIME/FILM/GATHER_TOWN reskin the Employee UI).
 *
 * Radius/shadow scale and component shape still follow
 * docs/style-concept.md; the color tokens below are CareerMate's steel-blue
 * / seafoam / cream palette. `#3368A0` is dark enough for text on white
 * (~5.9:1), so `accentInk` aliases it — still prefer `accentInk` over
 * `accent` whenever the color is a `color:`/icon foreground, not a fill.
 */

export const colorTokens = {
  bg: '#F2EFE7',
  canvas: '#F2EFE7',
  surface: '#ffffff',
  text: '#1c2836',
  neutral400: '#5a6f80',
  neutral500: '#6d8190',
  divider: '#C8DFDB',
  accent: '#3368A0',
  accent300: '#285480',
  accent700: '#66A3BF',
  accent900: '#C8DFDB',
  accentInk: '#3368A0',
  // White (or near-white) sitting on an `accent` fill — avatars, logo mark.
  accentContrast: '#ffffff',
  warning: '#c47d1a',
  success: '#2d8a6e',
  danger: '#c44b4b',
  tint: '#66A3BF',
} as const;

export const radiusTokens = {
  sm: 8,
  md: 14,
  lg: 22,
} as const;

export const shadowTokens = {
  card: '0 1px 2px rgba(28,40,54,.04), 0 8px 22px rgba(28,40,54,.07)',
  md: '0 4px 16px rgba(28,40,54,.14)',
  lg: '0 24px 60px rgba(28,40,54,.18)',
} as const;

export { buttonSizes, iconSizes, loadingSizes };

// One sans family for title, body, button, caption — see agent.md §6.
const fontFamily = 'var(--font-sans), system-ui, sans-serif';

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
      fontFamily,
      fontSize: 32,
      fontWeight: 500,
      letterSpacing: '-0.01em',
    },
    h2: {
      fontFamily,
      fontSize: 22,
      fontWeight: 500,
    },
    h3: {
      fontFamily,
      fontSize: 19,
      fontWeight: 500,
    },
    body1: {
      fontFamily,
      fontSize: 15,
      lineHeight: 1.55,
    },
    body2: {
      fontFamily,
      fontSize: 14,
      color: colorTokens.neutral400,
    },
    caption: {
      fontFamily,
      fontSize: 12,
      color: colorTokens.neutral400,
    },
    button: {
      fontFamily,
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colorTokens.canvas,
          fontFamily,
        },
        '*::-webkit-scrollbar': {
          width: 9,
          height: 9,
        },
        '*::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '*::-webkit-scrollbar-thumb': {
          background: colorTokens.accent700,
          borderRadius: 8,
        },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
        },
      },
      styleOverrides: {
        root: {
          fontFamily,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: 'medium',
      },
      styleOverrides: {
        root: {
          borderRadius: radiusTokens.md,
          fontWeight: 500,
          textTransform: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeMedium: {
          minHeight: buttonSizes.md.minHeight,
          padding: buttonSizes.md.padding,
          fontSize: buttonSizes.md.fontSize,
        },
        sizeSmall: {
          minHeight: buttonSizes.sm.minHeight,
          padding: buttonSizes.sm.padding,
          fontSize: buttonSizes.sm.fontSize,
          '& .MuiButton-startIcon > *:nth-of-type(1), & .MuiButton-endIcon > *:nth-of-type(1)': {
            fontSize: iconSizes.sm,
          },
        },
        startIcon: {
          '& > *:nth-of-type(1)': { fontSize: iconSizes.md },
        },
        endIcon: {
          '& > *:nth-of-type(1)': { fontSize: iconSizes.md },
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        sizeSmall: {
          width: 36,
          height: 36,
        },
        sizeMedium: {
          width: 40,
          height: 40,
        },
      },
    },
    MuiSvgIcon: {
      defaultProps: {
        fontSize: 'small',
      },
      styleOverrides: {
        fontSizeSmall: { fontSize: iconSizes.md },
        fontSizeMedium: { fontSize: iconSizes.md },
        fontSizeLarge: { fontSize: iconSizes.lg },
        fontSizeInherit: { fontSize: 'inherit' },
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
            borderColor: colorTokens.accent700,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colorTokens.accent,
            boxShadow: '0 0 0 3px rgba(51,104,160,.18)',
          },
        },
        input: {
          fontFamily,
          fontSize: 14,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily,
          fontSize: 12,
          fontWeight: 500,
          color: 'rgba(28,40,54,.65)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
          fontSize: 12,
          fontFamily,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontFamily,
        },
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
          fontFamily,
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
          fontFamily,
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
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily,
          fontSize: 22,
          fontWeight: 500,
          padding: '24px 24px 8px',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily,
          textTransform: 'none',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        },
      },
    },
  },
});

export default theme;
