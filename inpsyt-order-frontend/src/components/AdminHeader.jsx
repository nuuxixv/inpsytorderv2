import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Popover, List, ListItem, ListItemText, Divider, Avatar, Menu, MenuItem, alpha } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';

const AdminHeader = () => {
  const { user, logout } = useAuth();
  const { notifications } = useNotification();
  const navigate = useNavigate();

  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  const [userAnchorEl, setUserAnchorEl] = useState(null);

  const handleNotificationClick = (event) => setNotificationAnchorEl(event.currentTarget);
  const handleNotificationClose = () => setNotificationAnchorEl(null);

  const handleUserMenuClick = (event) => setUserAnchorEl(event.currentTarget);
  const handleUserMenuClose = () => setUserAnchorEl(null);

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
    navigate('/login');
  };

  const openNotification = Boolean(notificationAnchorEl);
  const openUserMenu = Boolean(userAnchorEl);

  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        width: '100%',
        height: 64,
        px: 3,
        mb: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        position: 'sticky',
        top: 24,
        zIndex: 100,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
        }
      })}
    >
      {/* 우측: 알림 및 사용자 메뉴 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton 
          onClick={handleNotificationClick} 
          size="small"
          sx={{ 
            color: 'text.secondary',
            '&:hover': { color: 'primary.main', bgcolor: 'primary.light', opacity: 0.1 }
          }}
        >
          <NotificationsIcon />
        </IconButton>
        <Popover
          open={openNotification}
          anchorEl={notificationAnchorEl}
          onClose={handleNotificationClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: 1.5,
              borderRadius: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.05)',
            }
          }}
        >
          <List sx={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
            <ListItem>
              <ListItemText primary="알림" primaryTypographyProps={{ fontWeight: 'bold' }} />
            </ListItem>
            <Divider />
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText secondary="새로운 알림이 없습니다." secondaryTypographyProps={{ textAlign: 'center', py: 2 }} />
              </ListItem>
            ) : (
              notifications.map((notification) => (
                <ListItem key={notification.id} button>
                  <ListItemText
                    primary={notification.message}
                    secondary={format(notification.timestamp, 'yyyy-MM-dd HH:mm', { locale: ko })}
                    primaryTypographyProps={{ fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
              ))
            )}
          </List>
        </Popover>

        <IconButton onClick={handleUserMenuClick} size="small" sx={{ p: 0.5, border: '1px solid transparent', '&:hover': { borderColor: 'primary.light' } }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {user?.email?.[0].toUpperCase()}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={userAnchorEl}
          open={openUserMenu}
          onClose={handleUserMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: 1.5,
              borderRadius: '16px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.05)',
              minWidth: 200,
            }
          }}
        >
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{user?.email}</Typography>
            <Typography variant="caption" color="text.secondary">관리자</Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleLogout} sx={{ mx: 1, borderRadius: 1, fontSize: '0.9rem', color: 'error.main' }}>로그아웃</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default AdminHeader;