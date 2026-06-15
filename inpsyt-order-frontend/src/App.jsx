import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './AuthContext';
import { useAuth } from './hooks/useAuth';
import { NotificationProvider } from './NotificationContext';
import GoRedirect from './components/GoRedirect';
import OrderPage from './components/OrderPage';
import OrderStatusPage from './components/OrderStatusPage';
import AdminLayout from './components/AdminLayout';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardDesignPreview from './components/DashboardDesignPreview';
import FulfillmentPreview from './components/FulfillmentPreview';
import OrderManagementPreview from './components/OrderManagementPreview';
import OrderManagementPreviewC1 from './components/OrderManagementPreviewC1';
import OrderManagementPreviewC2 from './components/OrderManagementPreviewC2';
import OrderManagementPreviewC3 from './components/OrderManagementPreviewC3';
import OrderManagementPreviewC4 from './components/OrderManagementPreviewC4';
import ProductManagementPreview from './components/ProductManagementPreview';
import EventManagementPreview from './components/EventManagementPreview';
import EventHubListPreview from './components/EventHubListPreview';
import EventDetailPreview from './components/EventDetailPreview';
import PaymentReceiptModalPreview from './components/PaymentReceiptModalPreview';
import UserManagementPreview from './components/UserManagementPreview';
import BulletinBoardPreview from './components/BulletinBoardPreview';
import FeedbackManagementPreview from './components/FeedbackManagementPreview';
import SettingsPreview from './components/SettingsPreview';
import LoginPreview from './components/LoginPreview';
import CustomerOrderPreview from './components/CustomerOrderPreview';
import CustomerOrderStatusPreview from './components/CustomerOrderStatusPreview';
import theme from './theme'; // theme.js 파일 임포트
import {
  CssBaseline,
  CircularProgress,
  Box,
  ThemeProvider
} from '@mui/material';

function AppRoutes() {
  const { user, loading, refreshing } = useAuth();

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
        <Route path="/go" element={<GoRedirect />} />
        <Route path="/order" element={<OrderPage />} />
        <Route path="/order/status/:token" element={<OrderStatusPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* DEV-ONLY: design preview without auth */}
        <Route path="/preview/dashboard" element={<DashboardDesignPreview />} />
        <Route path="/preview/fulfillment" element={<FulfillmentPreview />} />
        <Route path="/preview/products" element={<ProductManagementPreview />} />
        <Route path="/preview/events" element={<EventManagementPreview />} />
        <Route path="/preview/event-hub" element={<EventHubListPreview />} />
        <Route path="/preview/event-detail" element={<EventDetailPreview />} />
        <Route path="/preview/payment-receipt" element={<PaymentReceiptModalPreview />} />
        <Route path="/preview/users" element={<UserManagementPreview />} />
        <Route path="/preview/bulletins" element={<BulletinBoardPreview />} />
        <Route path="/preview/feedback" element={<FeedbackManagementPreview />} />
        <Route path="/preview/settings" element={<SettingsPreview />} />
        <Route path="/preview/login" element={<LoginPreview />} />
        <Route path="/preview/orders" element={<OrderManagementPreview />} />
        <Route path="/preview/orders-c1" element={<OrderManagementPreviewC1 />} />
        <Route path="/preview/orders-c2" element={<OrderManagementPreviewC2 />} />
        <Route path="/preview/orders-c3" element={<OrderManagementPreviewC3 />} />
        <Route path="/preview/orders-c4" element={<OrderManagementPreviewC4 />} />
        <Route path="/preview/order" element={<CustomerOrderPreview />} />
        <Route path="/preview/order-status" element={<CustomerOrderStatusPreview />} />
        {/* Redirect /smartadmin to /admin */}
          <Route path="/smartadmin" element={<Navigate to="/admin" replace />} />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute user={user} refreshing={refreshing}>
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
          <Analytics />
          <SpeedInsights />
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
