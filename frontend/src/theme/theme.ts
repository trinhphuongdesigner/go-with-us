import { createTheme } from '@mui/material/styles';
import { buttonSizes, iconSizes, loadingSizes } from './tokens';

/**
 * DEFAULT theme — always used for the Admin side (Super Admin + Company
 * Admin), regardless of any Employee "concept" switcher built later (see
 * ThemeConcept in the backend Prisma schema: DEFAULT/ANIME/FILM/
 * GATHER_TOWN — only ANIME/FILM/GATHER_TOWN reskin the Employee UI).
 *
 * Radius/shadow scale and component shape still follow
 * docs/style-concept.md. Color tokens follow the Milo × Sage palette.
 */

export const colorTokens = {
  canvas: '#F7F8F5',
  surface: '#FFFFFF',
  primary: '#3E7868',
  primarySubtle: '#E4EFE7',
  selectedBorder: '#91B3A1',
  sand: '#F3E9D7',
  heading: '#243F36',
  body: '#303B36',
  secondary: '#626C65',
  border: '#E2E8E4',
  muted: '#EFF2EF',
  danger: '#AD442E',
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
      default: colorTokens.canvas,
      paper: colorTokens.surface,
    },
    text: {
      primary: colorTokens.heading,
      secondary: colorTokens.secondary,
    },
    divider: colorTokens.border,
    primary: {
      main: colorTokens.primary,
      dark: colorTokens.primary,
      light: colorTokens.selectedBorder,
      contrastText: '#ffffff',
    },
    success: {
      main: colorTokens.primary,
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
      color: colorTokens.secondary,
    },
    caption: {
      fontFamily,
      fontSize: 12,
      color: colorTokens.secondary,
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
          background: colorTokens.primary,
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
          border: `1px solid ${colorTokens.border}`,
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
            borderColor: colorTokens.border,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: colorTokens.selectedBorder,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: colorTokens.primary,
            boxShadow: `0 0 0 3px ${colorTokens.primary}2E`,
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
          color: colorTokens.secondary,
          borderTop: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
          border: `1px solid ${colorTokens.border}`,
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
          backgroundColor: colorTokens.heading,
          color: '#ffffff',
          borderRadius: 8,
          fontFamily,
        },
        arrow: {
          color: colorTokens.heading,
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
