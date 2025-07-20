import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Popover, List, ListItem, ListItemText, Divider } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNotification } from '../NotificationContext';
import { useAuth } from '../AuthContext';
import LogoutIcon from '@mui/icons-material/Logout';

const AdminHeader = () => {
  const { user, logout } = useAuth();
  const { notifications } = useNotification();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleNotificationClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          INPSYT ADMIN
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            aria-describedby={id}
            color="inherit"
            onClick={handleNotificationClick}
          >
            <NotificationsIcon />
          </IconButton>
          <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={handleNotificationClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <List sx={{ width: 300, maxHeight: 400, overflow: 'auto' }}>
              <ListItem>
                <ListItemText primary="알림" />
              </ListItem>
              <Divider />
              {notifications.length === 0 ? (
                <ListItem>
                  <ListItemText secondary="새로운 알림이 없습니다." />
                </ListItem>
              ) : (
                notifications.map((notification) => (
                  <ListItem key={notification.id} alignItems="flex-start">
                    <ListItemText
                      primary={notification.message}
                      secondary={format(notification.timestamp, 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Popover>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.email}
          </Typography>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={logout}>
            로그아웃
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AdminHeader;