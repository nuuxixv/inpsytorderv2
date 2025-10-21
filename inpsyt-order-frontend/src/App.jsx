import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { useAuth } from './hooks/useAuth';
import { NotificationProvider } from './NotificationContext';
import OrderPage from './components/OrderPage';
import AdminLayout from './components/AdminLayout';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import theme from './theme'; // theme.js 파일 임포트
import {
  CssBaseline,
  CircularProgress,
  Box,
  ThemeProvider
} from '@mui/material';

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
