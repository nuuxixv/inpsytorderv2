import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Avatar, Badge, Tooltip, Chip, useTheme, useMediaQuery,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Dashboard as DashboardIcon,
  ShoppingCart as CartIcon,
  Event as EventIcon,
  Category as CategoryIcon,
  LocalShipping as ShippingIcon,
  People as PeopleIcon,
  RateReview as RateReviewIcon,
  Announcement as AnnouncementIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';

/**
 * DEV-ONLY: 프리뷰 전용 admin shell.
 * 실제 AdminLayout + AdminSidebar + AdminHeader 의 시각적 구조를 Supabase/Auth 의존성 없이 재현.
 */

const DRAWER_WIDTH = 264;
const COLLAPSED_WIDTH = 72;

const MENU = [
  { text: '대시보드', icon: <DashboardIcon />, path: '/admin/dashboard' },
  { text: '주문 관리', icon: <CartIcon />, path: '/admin/orders' },
  { text: '학회 관리', icon: <EventIcon />, path: '/admin/events' },
  { text: '상품 관리', icon: <CategoryIcon />, path: '/admin/products' },
  { text: '출고 현황', icon: <ShippingIcon />, path: '/admin/fulfillment' },
  { text: '사용자 관리', icon: <PeopleIcon />, path: '/admin/users' },
  { text: '피드백', icon: <RateReviewIcon />, path: '/admin/feedback' },
  { text: '게시판', icon: <AnnouncementIcon />, path: '/admin/bulletins', badge: 3 },
  { text: '설정', icon: <SettingsIcon />, path: '/admin/settings' },
];

const Sidebar = ({ collapsed, onToggleCollapse, activePath }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
        flexShrink: 0,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        bgcolor: '#ffffff',
        borderRight: `1px solid ${theme.gray[100]}`,
        transition: 'width 0.2s cubic-bezier(0.33, 1, 0.68, 1)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowX: 'hidden',
      }}
    >
      {/* Brand */}
      <Box
        sx={{
          px: collapsed ? 0 : 2.5,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            bgcolor: theme.gray[900],
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8125rem',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          IP
        </Box>
        {!collapsed && (
          <Typography
            sx={{
              fontWeight: 600,
              color: theme.gray[900],
              fontSize: '0.9375rem',
              letterSpacing: '-0.015em',
              whiteSpace: 'nowrap',
            }}
          >
            인싸이트 현장주문
          </Typography>
        )}
      </Box>

      <Box sx={{ height: '1px', bgcolor: theme.gray[100], mx: collapsed ? 1.25 : 2 }} />

      {/* Menu — 태블릿 터치 타겟 44px+ */}
      <List sx={{ px: 1.25, py: 1.5, flexGrow: 1 }}>
        {MENU.map((item) => {
          const active = item.path === activePath;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  disableRipple
                  sx={{
                    minHeight: 44,
                    borderRadius: '8px',
                    px: collapsed ? 1.25 : 1.5,
                    py: 1,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    backgroundColor: active ? theme.gray[100] : 'transparent',
                    color: active ? theme.gray[900] : theme.gray[600],
                    '&:hover': {
                      backgroundColor: active ? theme.gray[100] : theme.gray[50],
                    },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 32,
                      color: active ? theme.gray[900] : theme.gray[500],
                      '& svg': { fontSize: 20 },
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontWeight: active ? 600 : 500,
                          fontSize: '0.9375rem',
                          whiteSpace: 'nowrap',
                          letterSpacing: '-0.01em',
                        }}
                      />
                      {item.badge != null && (
                        <Box
                          sx={{
                            ml: 1,
                            minWidth: 22,
                            height: 22,
                            px: 0.75,
                            borderRadius: '11px',
                            bgcolor: theme.gray[100],
                            color: theme.gray[700],
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {item.badge}
                        </Box>
                      )}
                    </>
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      {/* Collapse toggle */}
      <Box sx={{ p: 1.25, display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <IconButton
          onClick={onToggleCollapse}
          disableRipple
          sx={{
            bgcolor: 'transparent',
            color: theme.gray[500],
            width: 36,
            height: 36,
            borderRadius: '8px',
            '&:hover': { bgcolor: theme.gray[50], color: theme.gray[900] },
          }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  );
};

const Header = ({ onMenuToggle }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: 60,
        px: { xs: 2, md: 3 },
        backgroundColor: '#ffffff',
        borderBottom: `1px solid ${theme.gray[100]}`,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <IconButton
        onClick={onMenuToggle}
        sx={{ display: { md: 'none' }, color: theme.gray[600], width: 40, height: 40 }}
        aria-label="메뉴 열기"
      >
        <MenuIcon />
      </IconButton>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 'auto' }}>
        <Tooltip title="디자인 프리뷰 모드" arrow>
          <Chip
            size="small"
            label="PREVIEW"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.06em',
              fontSize: '0.6875rem',
              height: 24,
              bgcolor: theme.gray[100],
              color: theme.gray[700],
              border: `1px solid ${theme.gray[200]}`,
              mr: 1.25,
              '& .MuiChip-label': { px: 1 },
            }}
          />
        </Tooltip>
        <IconButton
          disableRipple
          sx={{
            color: theme.gray[500],
            width: 40, height: 40,
            borderRadius: '8px',
            '&:hover': { bgcolor: theme.gray[50], color: theme.gray[900] },
          }}
        >
          <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <IconButton
          disableRipple
          sx={{
            color: theme.gray[500],
            width: 40, height: 40,
            borderRadius: '8px',
            '&:hover': { bgcolor: theme.gray[50], color: theme.gray[900] },
          }}
        >
          <NotificationsIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <IconButton disableRipple sx={{ p: 0.5, ml: 0.5, width: 40, height: 40 }}>
          <Avatar
            sx={{
              width: 30, height: 30,
              bgcolor: theme.gray[900],
              color: '#fff',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            I
          </Avatar>
        </IconButton>
      </Box>
    </Box>
  );
};

const PreviewShell = ({ activePath, children, maxWidth = 1200 }) => {
  const theme = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: theme.gray[50] }}>
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} activePath={activePath} />
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
        <Header onMenuToggle={() => {}} />
        <Box sx={{ flexGrow: 1, width: '100%', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 }, pb: 6 }}>
          <Box sx={{ maxWidth, mx: 'auto' }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default PreviewShell;
