import { createTheme, alpha } from '@mui/material/styles';

// Brand Colors
const PRIMARY_MAIN = '#2B398F';
const SECONDARY_MAIN = '#3d4db0';

// Toss-inspired Modern Theme
const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_MAIN,
      light: alpha(PRIMARY_MAIN, 0.8),
      dark: '#1a237e',
      contrastText: '#ffffff',
    },
    secondary: {
      main: SECONDARY_MAIN,
      light: '#6677cc',
      dark: '#2B398F',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F5F6F8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#191F28',
      secondary: '#8B95A1',
      disabled: '#B0B8C1',
    },
    success: {
      main: '#00B894',
      light: '#55efc4',
      dark: '#00a884',
    },
    warning: {
      main: '#FDCB6E',
      light: '#ffeaa7',
      dark: '#e17055',
    },
    error: {
      main: '#FF6B6B',
      light: '#fab1a0',
      dark: '#d63031',
    },
    info: {
      main: '#74B9FF',
      light: '#81ecec',
      dark: '#0984e3',
    },
    divider: '#E5E8EB',
  },
  typography: {
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
    // Mobile-first typography scale
    h1: { fontWeight: 800, fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
    h2: { fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.3, letterSpacing: '-0.01em' },
    h4: { fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.35, letterSpacing: '-0.01em' },
    h5: { fontWeight: 700, fontSize: '1rem', lineHeight: 1.4, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.4, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.5, letterSpacing: '-0.01em' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6, letterSpacing: '-0.01em' },
    body2: { fontSize: '0.8125rem', lineHeight: 1.6, letterSpacing: '-0.01em' },
    caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: '-0.005em' },
    overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
    button: { fontWeight: 600, textTransform: 'none', fontSize: '0.9375rem', letterSpacing: '-0.01em' },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.02), 0px 1px 2px rgba(0, 0, 0, 0.03)',
    '0px 4px 8px rgba(0, 0, 0, 0.04), 0px 2px 4px rgba(0, 0, 0, 0.03)',
    '0px 8px 16px rgba(0, 0, 0, 0.06), 0px 4px 8px rgba(0, 0, 0, 0.04)',
    '0px 12px 24px rgba(0, 0, 0, 0.08), 0px 6px 12px rgba(0, 0, 0, 0.06)',
    ...Array(20).fill('none'),
  ],
  transitions: {
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
      tossEaseOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F5F6F8',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.03)',
          border: '1px solid rgba(0, 0, 0, 0.03)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: 'none',
          border: '1px solid #E5E8EB',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 20px',
          minHeight: 44,
          boxShadow: 'none',
          transition: 'all 0.2s cubic-bezier(0.33, 1, 0.68, 1)',
          '&:hover': {
            boxShadow: 'none',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${PRIMARY_MAIN} 0%, #3d4db0 100%)`,
          '&:hover': {
            background: `linear-gradient(135deg, #1a237e 0%, ${PRIMARY_MAIN} 100%)`,
          },
        },
        sizeLarge: {
          padding: '14px 28px',
          fontSize: '1.0625rem',
          fontWeight: 700,
          minHeight: 52,
          borderRadius: 14,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#F8F9FA',
            minHeight: 48,
            fontSize: '16px', // Prevents iOS zoom on focus
            '& fieldset': {
              borderColor: '#E5E8EB',
            },
            '&:hover fieldset': {
              borderColor: '#CBD5E1',
            },
            '&.Mui-focused fieldset': {
              borderColor: PRIMARY_MAIN,
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          borderBottom: '1px solid #F1F5F9',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#F8FAFC',
          color: '#64748B',
          borderBottom: '1px solid #E2E8F0',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          height: 32,
        },
        filled: {
          border: 'none',
        },
        outlined: {
          border: '1px solid #E5E8EB',
          backgroundColor: 'transparent',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: '0px 20px 40px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiSwipeableDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: '16px 16px 0 0',
        },
      },
    },
  },
});

export default theme;
