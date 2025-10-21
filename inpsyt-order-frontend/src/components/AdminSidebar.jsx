
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EventIcon from '@mui/icons-material/Event';
import CategoryIcon from '@mui/icons-material/Category';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 260;

const allMenuItems = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/admin/dashboard' },
  { text: '주문 관리', icon: <ShoppingCartIcon />, path: '/admin/orders' },
  { text: '학회 관리', icon: <EventIcon />, path: '/admin/events', role: 'master' },
  { text: '상품 관리', icon: <CategoryIcon />, path: '/admin/products', role: 'master' },
];

const AdminSidebar = () => {
  const { isMaster } = useAuth();

  const filteredMenuItems = allMenuItems.filter(item => {
    if (item.role === 'master') {
      return isMaster;
    }
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
