
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EventIcon from '@mui/icons-material/Event';
import CategoryIcon from '@mui/icons-material/Category';
import PeopleIcon from '@mui/icons-material/People'; // PeopleIcon 추가
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 260;

const allMenuItems = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/admin/dashboard', permissionKey: 'dashboard:view' },
  { text: '주문 관리', icon: <ShoppingCartIcon />, path: '/admin/orders', permissionKey: 'orders:view' },
  { text: '학회 관리', icon: <EventIcon />, path: '/admin/events', permissionKey: 'events:view' },
  { text: '상품 관리', icon: <CategoryIcon />, path: '/admin/products', permissionKey: 'products:view' },
  { text: '사용자 관리', icon: <PeopleIcon />, path: '/admin/users', permissionKey: 'users:manage' },
];

const AdminSidebar = () => {
  const { hasPermission, permissions } = useAuth();

  const filteredMenuItems = allMenuItems.filter(item => {
    // master 역할은 모든 권한을 가집니다.
    if (permissions.includes('master')) {
      return true;
    }
    // 특정 권한이 필요한 메뉴는 hasPermission으로 확인
    if (item.permissionKey) {
      return hasPermission(item.permissionKey);
    }
    // permissionKey가 없는 일반 메뉴는 기본적으로 표시
    return true;
  });

  const navLinkStyles = {
    textDecoration: 'none',
    color: 'inherit',
    width: '100%',
  };

  return (
    <Drawer
      variant="permanent"
      sx={(theme) => ({
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderRight: `1px solid ${theme.palette.divider}`,
        },
      })}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64 }}>
        <img src="/LOGO.svg" alt="logo" style={{ height: 32 }} />
        <Typography variant="h6" sx={{ ml: 1.5, fontWeight: 'bold', color: 'text.primary' }}>
          인싸이트 오더
        </Typography>
      </Box>
      <List sx={{ p: 1 }}>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ my: 0.5 }}>
            <NavLink to={item.path} style={navLinkStyles}>
              {({ isActive }) => (
                <ListItemButton
                  sx={(theme) => ({
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: isActive ? theme.palette.secondary.main : 'transparent',
                    color: isActive ? theme.palette.primary.main : 'inherit',
                    '&:hover': {
                      backgroundColor: theme.palette.secondary.main,
                    },
                  })}
                >
                  <ListItemIcon sx={{ 
                    minWidth: 40,
                    color: 'inherit' 
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    primaryTypographyProps={{ fontWeight: isActive ? 'bold' : '500' }} 
                  />
                </ListItemButton>
              )}
            </NavLink>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default AdminSidebar;
