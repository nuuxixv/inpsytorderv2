import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

const ProtectedRoute = ({ children, user, refreshing }) => {
  // 토큰 갱신 재시도 중에는 user가 잠시 null일 수 있다.
  // 이때 즉시 리다이렉트하면 작성 화면이 통째로 언마운트되므로 한 박자 로딩으로 버틴다.
  if (!user && refreshing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    // 사용자가 로그인되어 있지 않으면 로그인 페이지로 리다이렉트
    return <Navigate to="/login" replace />;
  }

  return React.cloneElement(children, { user });
};

export default ProtectedRoute;
