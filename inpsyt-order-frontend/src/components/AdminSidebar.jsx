
import React, { useState, useEffect } from 'react';
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
  IconButton,
  Tooltip,
  Badge,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import EventIcon from '@mui/icons-material/Event';
import CategoryIcon from '@mui/icons-material/Category';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SettingsIcon from '@mui/icons-material/Settings';
import RateReviewIcon from '@mui/icons-material/RateReview';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import { useAuth } from '../hooks/useAuth';
import { getUnreadCount } from '../api/bulletins';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

const allMenuItems = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/admin/dashboard', permissionKey: 'dashboard:view' },
  { text: '주문 관리', icon: <ShoppingCartIcon />, path: '/admin/orders', permissionKey: 'orders:view' },
  { text: '학회 관리', icon: <EventIcon />, path: '/admin/events', permissionKey: 'events:view' },
  { text: '상품 관리', icon: <CategoryIcon />, path: '/admin/products', permissionKey: 'products:view' },
  { text: '출고 현황', icon: <LocalShippingIcon />, path: '/admin/fulfillment', permissionKey: 'orders:view' },
  { text: '사용자 관리', icon: <PeopleIcon />, path: '/admin/users', permissionKey: 'users:manage' },
  { text: '피드백', icon: <RateReviewIcon />, path: '/admin/feedback', permissionKey: 'master' },
  { text: '게시판', icon: <AnnouncementIcon />, path: '/admin/bulletins', permissionKey: null },
  { text: '설정', icon: <SettingsIcon />, path: '/admin/settings', permissionKey: 'master' },
];

const AdminSidebar = ({ open, onClose, collapsed = false, onToggleCollapse }) => {
  const { user, hasPermission, permissions } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [bulletinUnreadCount, setBulletinUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    getUnreadCount(user.id)
      .then(count => setBulletinUnreadCount(count))
      .catch(() => {});
  }, [user?.id]);

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

  const currentWidth = isDesktop && collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo / Branding */}
      <Box sx={{
        p: collapsed ? 1.5 : 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 1.5,
        height: 80,
      }}>
        <img src="/LOGO.svg" alt="logo" style={{ height: 32 }} />
        {!collapsed && (
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            인싸이트 현장주문
          </Typography>
        )}
      </Box>

      {/* Menu items */}
      <List sx={{ px: collapsed ? 1 : 2, flexGrow: 1 }}>
        {filteredMenuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ my: 0.5 }}>
            <NavLink to={item.path} style={navLinkStyles} onClick={!isDesktop ? onClose : undefined}>
              {({ isActive }) => (
                <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                  <ListItemButton
                    sx={(t) => ({
                      minHeight: 52,
                      borderRadius: '12px',
                      mb: 0.5,
                      py: 2,
                      px: collapsed ? 1.5 : 2,
                      justifyContent: collapsed ? 'center' : 'flex-start',
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
                    <ListItemIcon sx={{
                      minWidth: collapsed ? 0 : 40,
                      color: 'inherit',
                      '& svg': { fontSize: 22 },
                      justifyContent: 'center',
                    }}>
                      {item.path === '/admin/bulletins' && bulletinUnreadCount > 0 ? (
                        <Badge badgeContent={bulletinUnreadCount} color="error" max={99}>
                          {item.icon}
                        </Badge>
                      ) : item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '0.95rem',
                          whiteSpace: 'nowrap',
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              )}
            </NavLink>
          </ListItem>
        ))}
      </List>

      {/* Collapse toggle button (desktop only) */}
      {isDesktop && onToggleCollapse && (
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <IconButton
            onClick={onToggleCollapse}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
              width: 44,
              height: 44,
            }}
          >
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Box>
      )}
    </Box>
  );

  return (
    <Drawer
      variant={isDesktop ? 'permanent' : 'temporary'}
      open={isDesktop ? true : open}
      onClose={onClose}
      sx={{
        width: isDesktop ? currentWidth : 0,
        flexShrink: 0,
        transition: 'width 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
        '& .MuiDrawer-paper': {
          width: isDesktop ? currentWidth : DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          color: theme.palette.text.primary,
          borderRight: 'none',
          boxShadow: '4px 0 24px rgba(0,0,0,0.02)',
          transition: 'width 0.25s cubic-bezier(0.33, 1, 0.68, 1)',
          overflowX: 'hidden',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default AdminSidebar;
