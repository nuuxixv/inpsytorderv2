import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Popover, List, ListItem, ListItemText, Divider, Avatar, Menu, MenuItem } from '@mui/material';
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
        p: 2,
        mb: 3,
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)', // 테마와 일치하는 그림자
      })}
    >
      {/* 우측: 알림 및 사용자 메뉴 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={handleNotificationClick} color="inherit" size="small">
          <NotificationsIcon />
        </IconButton>
        <Popover
          open={openNotification}
          anchorEl={notificationAnchorEl}
          onClose={handleNotificationClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <List sx={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
            <ListItem>
              <ListItemText primary="알림" primaryTypographyProps={{ fontWeight: 'bold' }} />
            </ListItem>
            <Divider />
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText secondary="새로운 알림이 없습니다." />
              </ListItem>
            ) : (
              notifications.map((notification) => (
                <ListItem key={notification.id}>
                  <ListItemText
                    primary={notification.message}
                    secondary={format(notification.timestamp, 'yyyy-MM-dd HH:mm', { locale: ko })}
                  />
                </ListItem>
              ))
            )}
          </List>
        </Popover>

        <IconButton onClick={handleUserMenuClick} size="small">
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            {user?.email?.[0].toUpperCase()}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={userAnchorEl}
          open={openUserMenu}
          onClose={handleUserMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{user?.email}</Typography>
            <Typography variant="body2" color="text.secondary">관리자</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleLogout}>로그아웃</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default AdminHeader;