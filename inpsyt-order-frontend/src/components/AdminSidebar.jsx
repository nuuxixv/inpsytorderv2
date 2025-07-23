import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupIcon from '@mui/icons-material/Group';
import CategoryIcon from '@mui/icons-material/Category';
import { useAuth } from '../AuthContext';

const drawerWidth = 240;

const allMenuItems = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/admin/dashboard' },
  { text: '주문 관리', icon: <ShoppingCartIcon />, path: '/admin/orders' },
  { text: '학회 관리', icon: <GroupIcon />, path: '/admin/events', role: 'master' },
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

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
      }}
    >
      <Toolbar />
      <List>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton component={RouterLink} to={item.path}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default AdminSidebar;