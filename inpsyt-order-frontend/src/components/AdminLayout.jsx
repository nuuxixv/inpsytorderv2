
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material'; // Container 제거
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import DashboardPage from './DashboardPage';
import OrderManagementPage from './OrderManagementPage';
import EventManagementPage from './EventManagementPage';
import ProductManagementPage from './ProductManagementPage';
import UserManagementPage from './UserManagementPage'; // UserManagementPage 임포트
import NotificationsDisplay from './NotificationsDisplay';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../supabaseClient';

const AdminLayout = () => {
  const { hasPermission, permissions } = useAuth();
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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AdminSidebar />
      <Box 
        component="main" 
        sx={{
          flexGrow: 1, 
          p: 3, // 전체 콘텐츠 영역의 패딩
          display: 'flex',
          flexDirection: 'column',
          width: '100%', // 메인 콘텐츠 박스가 사용 가능한 너비를 모두 차지하도록
        }}
      >
        <AdminHeader /> {/* 헤더를 Container 밖으로 이동 */}
        <Box sx={{ flexGrow: 1, width: '100%' }}> {/* Routes를 감싸는 Box 추가 */}
          <Routes>
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/dashboard" element={hasPermission('dashboard:view') ? <DashboardPage /> : <Navigate to="/admin" replace />} />
            <Route path="/orders" element={hasPermission('orders:view') ? <OrderManagementPage /> : <Navigate to="/admin" replace />} />

            {/* 학회 관리 (권한 필요) */}
            <Route
              path="/events/:slug?"
              element={hasPermission('events:view') ? <EventManagementPage /> : <Navigate to="/admin" replace />}
            />

            {/* 상품 관리 (권한 필요) */}
            <Route
              path="/products"
              element={hasPermission('products:view') ? <ProductManagementPage /> : <Navigate to="/admin" replace />}
            />

            {/* 사용자 관리 (권한 필요) */}
            <Route
              path="/users"
              element={hasPermission('users:manage') ? <UserManagementPage /> : <Navigate to="/admin" replace />}
            />
          </Routes>
        </Box>
        <NotificationsDisplay />
      </Box>
    </Box>
  );
};

export default AdminLayout;
