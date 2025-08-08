import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Toolbar, Container } from '@mui/material';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import DashboardPage from './DashboardPage';
import OrderManagementPage from './OrderManagementPage';
import EventManagementPage from './EventManagementPage';
import ProductManagementPage from './ProductManagementPage';
import NotificationsDisplay from './NotificationsDisplay';
import { useAuth } from '../AuthContext';
import { useNotification } from '../NotificationContext';
import { supabase } from '../supabaseClient';

const AdminLayout = () => {
  const { isMaster } = useAuth();
  const { addNotification } = useNotification();

  useEffect(() => {
    const channel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('New order received:', payload);
          addNotification('새로운 주문이 도착했습니다!', 'success');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification]);

  return (
    <Box sx={{ display: 'flex' }}>
      <AdminHeader />
      <AdminSidebar />
      <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: '#f4f6f8' }}>
        <Toolbar />
        <Container maxWidth="xl">
          <Routes>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/orders" element={<OrderManagementPage />} />

            {/* 학회 관리 (마스터 권한 필요) */}
            <Route
              path="/events/:slug?"
              element={isMaster ? <EventManagementPage /> : <Navigate to="/admin/dashboard" replace />}
            />

            {/* 상품 관리 (마스터 권한 필요) */}
            <Route
              path="/products"
              element={isMaster ? <ProductManagementPage /> : <Navigate to="/admin/dashboard" replace />}
            />
          </Routes>
        </Container>
        <NotificationsDisplay />
      </Box>
    </Box>
  );
};

export default AdminLayout;