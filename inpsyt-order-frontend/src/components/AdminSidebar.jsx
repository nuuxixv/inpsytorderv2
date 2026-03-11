
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EventIcon from '@mui/icons-material/Event';
import CategoryIcon from '@mui/icons-material/Category';
import PeopleIcon from '@mui/icons-material/People';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 260;

const allMenuItems = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/admin/dashboard', permissionKey: 'dashboard:view' },
  { text: '주문 관리', icon: <ShoppingCartIcon />, path: '/admin/orders', permissionKey: 'orders:view' },
  { text: '학회 관리', icon: <EventIcon />, path: '/admin/events', permissionKey: 'events:view' },
  { text: '상품 관리', icon: <CategoryIcon />, path: '/admin/products', permissionKey: 'products:view' },
  { text: '사용자 관리', icon: <PeopleIcon />, path: '/admin/users', permissionKey: 'users:manage' },
];

const AdminSidebar = ({ open, onClose }) => {
  const { hasPermission, permissions } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const filteredMenuItems = allMenuItems.filter(item => {
    if (permissions.includes('master')) return true;
    if (item.permissionKey) return hasPermission(item.permissionKey);
    return true;
  });

  const navLinkStyles = {
    textDecoration: 'none',
    color: 'inherit',
    width: '100%',
  };

  const drawerContent = (
    <>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5, height: 80 }}>
        <img src="/LOGO.svg" alt="logo" style={{ height: 32 }} />
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.02em' }}>
          인싸이트 오더
        </Typography>
      </Box>
      <List sx={{ px: 2 }}>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ my: 0.5 }}>
            <NavLink to={item.path} style={navLinkStyles} onClick={!isDesktop ? onClose : undefined}>
              {({ isActive }) => (
                <ListItemButton
                  sx={(t) => ({
                    minHeight: 52,
                    borderRadius: '12px',
                    mb: 0.5,
                    py: 2,
                    px: 2,
                    borderLeft: isActive ? `4px solid ${t.palette.primary.main}` : '4px solid transparent',
                    backgroundColor: isActive ? alpha(t.palette.primary.main, 0.08) : 'transparent',
                    color: isActive ? t.palette.primary.main : t.palette.text.secondary,
                    '&:hover': {
                      backgroundColor: isActive
                        ? alpha(t.palette.primary.main, 0.12)
                        : alpha(t.palette.text.primary, 0.04),
                    },
                    transition: 'all 0.2s ease-in-out',
                  })}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'inherit', '& svg': { fontSize: 22 } }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontWeight: isActive ? 700 : 500, fontSize: '0.95rem' }}
                  />
                </ListItemButton>
              )}
            </NavLink>
          </ListItem>
        ))}
      </List>
    </>
  );

  return (
    <Drawer
      variant={isDesktop ? 'permanent' : 'temporary'}
      open={isDesktop ? true : open}
      onClose={onClose}
      sx={{
        width: isDesktop ? drawerWidth : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          color: theme.palette.text.primary,
          borderRight: 'none',
          boxShadow: '4px 0 24px rgba(0,0,0,0.02)',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default AdminSidebar;
