import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Popover, List, ListItem, ListItemText, Divider, Avatar, Menu, MenuItem, alpha, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';

const AdminHeader = ({ onMenuToggle }) => {
  const { user, logout, profile } = useAuth();
  const { addNotification, notifications } = useNotification();
  const navigate = useNavigate();

  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  const [userAnchorEl, setUserAnchorEl] = useState(null);
  
  // Password change modal states
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleNotificationClick = (event) => setNotificationAnchorEl(event.currentTarget);
  const handleNotificationClose = () => setNotificationAnchorEl(null);

  const handleUserMenuClick = (event) => setUserAnchorEl(event.currentTarget);
  const handleUserMenuClose = () => setUserAnchorEl(null);

  const handleLogout = async () => {
    handleUserMenuClose();
    await logout();
    navigate('/login');
  };

  const handleOpenPasswordModal = () => {
    handleUserMenuClose();
    setNewPassword('');
    setConfirmPassword('');
    setOpenPasswordModal(true);
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      addNotification('비밀번호(PIN)는 최소 6자리 이상이어야 합니다.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      addNotification('비밀번호가 일치하지 않습니다.', 'warning');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      addNotification('비밀번호가 성공적으로 변경되었습니다.', 'success');
      setOpenPasswordModal(false);
    } catch (err) {
      console.error('Password change error:', err);
      addNotification(`비밀번호 변경 실패: ${err.message}`, 'error');
    }
  };

  const openNotification = Boolean(notificationAnchorEl);
  const openUserMenu = Boolean(userAnchorEl);

  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: 64,
        px: { xs: 2, md: 3 },
        mb: 3,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
        }
      })}
    >
      {/* 좌측: 모바일 햄버거 메뉴 */}
      <IconButton
        onClick={onMenuToggle}
        size="medium"
        sx={{ display: { md: 'none' }, color: 'text.secondary' }}
        aria-label="메뉴 열기"
      >
        <MenuIcon />
      </IconButton>

      {/* 우측: 알림 및 사용자 메뉴 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
        <IconButton
          onClick={handleNotificationClick}
          sx={{
            color: 'text.secondary',
            minWidth: 44,
            minHeight: 44,
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

        <IconButton onClick={handleUserMenuClick} sx={{ p: 0.5, minWidth: 44, minHeight: 44, border: '1px solid transparent', '&:hover': { borderColor: 'primary.light' } }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {(profile?.name || user?.email)?.[0]?.toUpperCase()}
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
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {profile?.name || user?.email?.split('@')[0] || '사용자'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleOpenPasswordModal} sx={{ mx: 1, borderRadius: 1, fontSize: '0.9rem' }}>비밀번호 변경</MenuItem>
          <MenuItem onClick={handleLogout} sx={{ mx: 1, borderRadius: 1, fontSize: '0.9rem', color: 'error.main' }}>로그아웃</MenuItem>
        </Menu>
      </Box>

      {/* Password Change Dialog */}
      <Dialog open={openPasswordModal} onClose={() => setOpenPasswordModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>비밀번호(PIN) 변경</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            autoFocus
            label="새 비밀번호 (최소 6자리 숫자/영문)"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            label="새 비밀번호 확인"
            type="password"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPasswordModal(false)}>취소</Button>
          <Button onClick={handlePasswordChange} variant="contained">변경하기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminHeader;