import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { NotificationProvider } from './NotificationContext';
import OrderPage from './components/OrderPage';
import AdminLayout from './components/AdminLayout'; // 새로 만들 컴포넌트
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import {
  CssBaseline,
  CircularProgress,
  Box
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2B398F',
    },
    background: {
      default: '#f4f6f8',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Toss Product Sans", sans-serif',
    h4: { fontWeight: 700, fontSize: '1.8rem' },
    h5: { fontWeight: 600, fontSize: '1.4rem' },
  },
  components: {
    MuiCard: { styleOverrides: { root: { borderRadius: 16, boxShadow: 'none', padding: '24px' } } },
    MuiTextField: { defaultProps: { variant: 'filled', fullWidth: true } },
    MuiButton: { styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } } },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<OrderPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Redirect /smartadmin to /admin */}
          <Route path="/smartadmin" element={<Navigate to="/admin" replace />} />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute user={user}>
                <AdminLayout />
              </ProtectedRoute>
            }
          />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
