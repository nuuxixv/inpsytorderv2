import { createTheme, alpha } from '@mui/material/styles';

// ─────────────────────────────────────────────
// Brand
// ─────────────────────────────────────────────
const PRIMARY_MAIN = '#2B398F';
const PRIMARY_DARK = '#1A237E';

// ─────────────────────────────────────────────
// Neutral Scale (Toss-inspired cool gray)
// ─────────────────────────────────────────────
const GRAY = {
  50:  '#F9FAFB',
  100: '#F2F4F6',
  200: '#E5E8EB',
  300: '#D1D6DB',
  400: '#B0B8C1',
  500: '#8B95A1',
  600: '#6B7684',
  700: '#4E5968',
  800: '#333D4B',
  900: '#191F28',
};

// ─────────────────────────────────────────────
// Semantic Accent Palette (dashboard categories)
// Use via theme.accent.* — NOT hardcoded hex in pages
// ─────────────────────────────────────────────
const ACCENT = {
  revenue:   '#00B894', // 매출/성장 - Toss 그린
  books:     '#3D4DB0', // 도서 - 브랜드 서브
  tests:     '#2B398F', // 검사 - 브랜드 프라이머리
  shipping:  '#0984E3', // 배송
  attention: '#F59E0B', // 주의/대기
  danger:    '#FF6B6B',
};

// ─────────────────────────────────────────────
// Status Palette (주문 상태) - single source
// constants/orderStatus.js 와 동기화됨
// ─────────────────────────────────────────────
const STATUS = {
  pending:   '#F59E0B',
  paid:      '#10B981',
  completed: '#6366F1',
  cancelled: '#EF4444',
  refunded:  '#F43F5E',
};

// ─────────────────────────────────────────────
// Radius Scale
// ─────────────────────────────────────────────
const RADII = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// ─────────────────────────────────────────────
// Elevation — 주로 hover/focus에만 사용. 기본은 border.
// ─────────────────────────────────────────────
const CUSTOM_SHADOWS = {
  none: 'none',
  xs:   '0px 1px 2px rgba(17, 24, 39, 0.04)',
  sm:   '0px 2px 6px rgba(17, 24, 39, 0.04), 0px 1px 2px rgba(17, 24, 39, 0.03)',
  md:   '0px 6px 16px rgba(17, 24, 39, 0.06), 0px 2px 4px rgba(17, 24, 39, 0.03)',
  lg:   '0px 12px 32px rgba(17, 24, 39, 0.08)',
  focus: `0 0 0 3px ${alpha(PRIMARY_MAIN, 0.16)}`,
};

// ─────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────
const EASING_TOSS = 'cubic-bezier(0.33, 1, 0.68, 1)';

// ─────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────
const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_MAIN,
      light: alpha(PRIMARY_MAIN, 0.8),
      dark: PRIMARY_DARK,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#3D4DB0',
      light: '#6677CC',
      dark: PRIMARY_MAIN,
      contrastText: '#ffffff',
    },
    background: {
      default: GRAY[100],
      paper: '#FFFFFF',
    },
    text: {
      primary: GRAY[900],
      secondary: GRAY[500],
      disabled: GRAY[400],
    },
    success: { main: ACCENT.revenue, light: '#55EFC4', dark: '#00A884' },
    warning: { main: ACCENT.attention, light: '#FDE68A', dark: '#D97706' },
    error:   { main: ACCENT.danger,    light: '#FAB1A0', dark: '#D63031' },
    info:    { main: ACCENT.shipping,  light: '#81ECEC', dark: '#0764C7' },
    divider: GRAY[200],
    grey: GRAY,
  },

  // Custom token groups (accessed via useTheme())
  gray: GRAY,
  accent: ACCENT,
  status: STATUS,
  radii: RADII,
  customShadows: CUSTOM_SHADOWS,
  easing: { toss: EASING_TOSS },

  typography: {
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
    h1: { fontWeight: 800, fontSize: '2rem',    lineHeight: 1.2,  letterSpacing: '-0.03em' },
    h2: { fontWeight: 800, fontSize: '1.625rem', lineHeight: 1.25, letterSpacing: '-0.025em' },
    h3: { fontWeight: 700, fontSize: '1.375rem', lineHeight: 1.3,  letterSpacing: '-0.02em' },
    h4: { fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.35, letterSpacing: '-0.015em' },
    h5: { fontWeight: 700, fontSize: '1rem',     lineHeight: 1.4,  letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, fontSize: '0.9375rem',lineHeight: 1.4,  letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 700, fontSize: '1rem',     lineHeight: 1.5, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.5, letterSpacing: '-0.01em' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6, letterSpacing: '-0.01em' },
    body2: { fontSize: '0.8125rem', lineHeight: 1.6, letterSpacing: '-0.005em' },
    caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: 0 },
    overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
    button: { fontWeight: 700, textTransform: 'none', fontSize: '0.9375rem', letterSpacing: '-0.01em' },
  },

  shape: { borderRadius: RADII.sm },

  shadows: [
    CUSTOM_SHADOWS.none,
    CUSTOM_SHADOWS.xs,
    CUSTOM_SHADOWS.sm,
    CUSTOM_SHADOWS.md,
    CUSTOM_SHADOWS.lg,
    ...Array(20).fill(CUSTOM_SHADOWS.lg),
  ],

  transitions: {
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      tossEaseOut: EASING_TOSS,
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: GRAY[100],
          fontFeatureSettings: '"tnum" 1, "ss01" 1',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: RADII.lg,
          boxShadow: 'none',
          border: `1px solid ${GRAY[200]}`,
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 24,
          '&:last-child': { paddingBottom: 24 },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: RADII.md,
          padding: '10px 18px',
          minHeight: 44,
          boxShadow: 'none',
          transition: `all 0.2s ${EASING_TOSS}`,
          '&:hover': { boxShadow: 'none' },
          '&:active': { transform: 'scale(0.98)' },
        },
        containedPrimary: {
          background: PRIMARY_MAIN,
          '&:hover': { background: PRIMARY_DARK },
        },
        outlined: {
          borderColor: GRAY[300],
          color: GRAY[800],
          '&:hover': {
            borderColor: GRAY[400],
            backgroundColor: GRAY[50],
          },
        },
        text: {
          color: GRAY[700],
          '&:hover': { backgroundColor: GRAY[100] },
        },
        sizeSmall: {
          minHeight: 34,
          padding: '6px 12px',
          fontSize: '0.8125rem',
          borderRadius: RADII.sm,
        },
        sizeLarge: {
          padding: '14px 24px',
          fontSize: '1rem',
          fontWeight: 700,
          minHeight: 52,
          borderRadius: RADII.md,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: RADII.md,
          transition: `all 0.2s ${EASING_TOSS}`,
          '&:active': { transform: 'scale(0.94)' },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: RADII.md,
            backgroundColor: GRAY[50],
            minHeight: 48,
            fontSize: '15px',
            transition: `all 0.15s ${EASING_TOSS}`,
            '& fieldset': { borderColor: GRAY[200] },
            '&:hover fieldset': { borderColor: GRAY[300] },
            '&.Mui-focused': {
              backgroundColor: '#FFFFFF',
              '& fieldset': { borderColor: PRIMARY_MAIN, borderWidth: 2 },
            },
          },
          '& .MuiInputLabel-root': { color: GRAY[500] },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADII.md,
          backgroundColor: GRAY[50],
          '& fieldset': { borderColor: GRAY[200] },
          '&:hover fieldset': { borderColor: GRAY[300] },
          '&.Mui-focused': {
            backgroundColor: '#FFFFFF',
            '& fieldset': { borderColor: PRIMARY_MAIN, borderWidth: 2 },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '14px 20px',
          borderBottom: `1px solid ${GRAY[100]}`,
        },
        head: {
          fontWeight: 700,
          backgroundColor: GRAY[50],
          color: GRAY[600],
          fontSize: '0.8125rem',
          borderBottom: `1px solid ${GRAY[200]}`,
          letterSpacing: '-0.01em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: RADII.sm,
          fontWeight: 600,
          height: 28,
          letterSpacing: '-0.01em',
        },
        sizeSmall: { height: 22, fontSize: '0.75rem' },
        filled: { border: 'none' },
        outlined: { border: `1px solid ${GRAY[200]}`, backgroundColor: 'transparent' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: RADII.lg,
          boxShadow: CUSTOM_SHADOWS.lg,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: GRAY[800],
          color: '#FFFFFF',
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: RADII.sm,
          padding: '6px 10px',
        },
        arrow: { color: GRAY[800] },
      },
    },
    MuiSwipeableDrawer: {
      styleOverrides: {
        paper: { borderRadius: `${RADII.lg}px ${RADII.lg}px 0 0` },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: GRAY[100],
          borderRadius: RADII.sm,
        },
      },
    },
  },
});

export default theme;
