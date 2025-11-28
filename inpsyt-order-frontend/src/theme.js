import { createTheme, alpha } from '@mui/material/styles';

// Brand Colors
const PRIMARY_MAIN = '#2B398F'; // Existing brand color
const SECONDARY_MAIN = '#6C5CE7'; // Trendy purple-blue for accents

// Modern & Trendy Theme
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
      light: '#a29bfe',
      dark: '#4834d4',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F3F6F9', // Cool grey background for dashboard
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1E27', // Almost black, softer than #000
      secondary: '#6E7C87', // Cool grey text
      disabled: '#A0AAB4',
    },
    success: {
      main: '#00B894', // Minty green
      light: '#55efc4',
      dark: '#00a884',
    },
    warning: {
      main: '#FDCB6E', // Warm yellow
      light: '#ffeaa7',
      dark: '#e17055',
    },
    error: {
      main: '#FF7675', // Soft red
      light: '#fab1a0',
      dark: '#d63031',
    },
    info: {
      main: '#74B9FF', // Sky blue
      light: '#81ecec',
      dark: '#0984e3',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.01em' },
    h3: { fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontWeight: 700, letterSpacing: '-0.01em', fontSize: '1.75rem' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle2: { fontWeight: 600, letterSpacing: '-0.01em' },
    body1: { letterSpacing: '-0.01em', lineHeight: 1.6 },
    body2: { letterSpacing: '-0.01em', lineHeight: 1.6 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: '-0.01em' },
  },
  shape: {
    borderRadius: 16, // More rounded corners for a modern feel
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.02), 0px 1px 2px rgba(0, 0, 0, 0.03)', // 1: Subtle card shadow
    '0px 4px 8px rgba(0, 0, 0, 0.04), 0px 2px 4px rgba(0, 0, 0, 0.03)', // 2: Hover state
    '0px 8px 16px rgba(0, 0, 0, 0.06), 0px 4px 8px rgba(0, 0, 0, 0.04)', // 3: Dropdown/Modal
    '0px 12px 24px rgba(0, 0, 0, 0.08), 0px 6px 12px rgba(0, 0, 0, 0.06)', // 4
    ...Array(20).fill('none'), // Fill the rest to avoid errors, customize if needed
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F3F6F9',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove default gradient in dark mode if switched
        },
        elevation1: {
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.03)', // Very soft shadow for cards
          border: '1px solid rgba(0, 0, 0, 0.03)', // Subtle border
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.03)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(43, 57, 143, 0.2)', // Colored shadow on hover
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${PRIMARY_MAIN} 0%, ${alpha(PRIMARY_MAIN, 0.8)} 100%)`,
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#ffffff',
            '& fieldset': {
              borderColor: '#E2E8F0',
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
        },
        filled: {
          border: 'none',
        },
        outlined: {
          border: '1px solid #E2E8F0',
          backgroundColor: 'transparent',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          boxShadow: '0px 20px 40px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

export default theme;