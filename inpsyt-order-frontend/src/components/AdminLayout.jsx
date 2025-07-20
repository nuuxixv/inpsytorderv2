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

const AdminLayout = () => {
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
          <Route path="/events" element={<EventManagementPage />} />
          <Route path="/products" element={<ProductManagementPage />} />
        </Routes>
        <NotificationsDisplay />
      </Box>
    </Box>
  );
};

export default AdminLayout;