import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import DashboardPage from './DashboardPage';
import OrderManagementPage from './OrderManagementPage';
import EventManagementPage from './EventManagementPage';
import ProductManagementPage from './ProductManagementPage';
import NotificationsDisplay from './NotificationsDisplay';
import { useAuth } from '../AuthContext'; // useAuth 훅 임포트

const AdminLayout = () => {
  const { isMaster } = useAuth(); // isMaster 상태 가져오기

  return (
    <Box sx={{ display: 'flex' }}>
      <AdminHeader />
      <AdminSidebar />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
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
        <NotificationsDisplay />
      </Box>
    </Box>
  );
};

export default AdminLayout;