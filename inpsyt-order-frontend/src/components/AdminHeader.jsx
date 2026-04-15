import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, IconButton, Popover, List, ListItem, ListItemText,
  Divider, Avatar, Menu, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Button, Chip, CircularProgress,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MenuIcon from '@mui/icons-material/Menu';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../supabaseClient';

const ROUTE_LABELS = {
  '/admin/dashboard':   '대시보드',
  '/admin/orders':      '주문 관리',
  '/admin/events':      '학회 관리',
  '/admin/products':    '상품 관리',
  '/admin/fulfillment': '출고 현황',
  '/admin/users':       '사용자 관리',
  '/admin/feedback':    '피드백 관리',
  '/admin/bulletins':   '게시판',
  '/admin/settings':    '설정',
};

const FEEDBACK_TYPES = [
  { value: 'bug',        label: '오류' },
  { value: 'ux',         label: 'UI/UX 불편' },
  { value: 'suggestion', label: '개선 제안' },
];

const AdminHeader = ({ onMenuToggle }) => {
  const { user, logout, profile } = useAuth();
  const { addNotification, notifications } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
  const [userAnchorEl, setUserAnchorEl] = useState(null);

  // Password change
  const [openPasswordModal, setOpenPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Feedback
  const [openFeedback, setOpenFeedback] = useState(false);
  const [feedbackLocation, setFeedbackLocation] = useState('');
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);

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
      addNotification(`비밀번호 변경 실패: ${err.message}`, 'error');
    }
  };

  const handleOpenFeedback = () => {
    const autoLabel = ROUTE_LABELS[location.pathname] || '';
    setFeedbackLocation(autoLabel);
    setFeedbackType('');
    setFeedbackContent('');
    setOpenFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackType) {
      addNotification('유형을 선택해주세요.', 'warning');
      return;
    }
    if (!feedbackContent.trim()) {
      addNotification('내용을 입력해주세요.', 'warning');
      return;
    }
    setFeedbackSaving(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        user_email: user.email,
        location: feedbackLocation || '(미지정)',
        type: feedbackType,
        content: feedbackContent.trim(),
      });
      if (error) throw error;
      addNotification('피드백이 전달됐습니다. 감사합니다!', 'success');
      setOpenFeedback(false);
    } catch (err) {
      addNotification(`전송 실패: ${err.message}`, 'error');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const openNotification = Boolean(notificationAnchorEl);
  const openUserMenu = Boolean(userAnchorEl);

  return (
    <Box
      sx={{
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
        '&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.04)' },
      }}
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

      {/* 우측 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>

        {/* 피드백 아이콘 */}
        <IconButton
          onClick={handleOpenFeedback}
          sx={{ color: 'text.secondary', minWidth: 44, minHeight: 44 }}
          aria-label="피드백 보내기"
        >
          <ChatBubbleOutlineIcon />
        </IconButton>

        {/* 알림 */}
        <IconButton
          onClick={handleNotificationClick}
          sx={{ color: 'text.secondary', minWidth: 44, minHeight: 44 }}
        >
          <NotificationsIcon />
        </IconButton>
        <Popover
          open={openNotification}
          anchorEl={notificationAnchorEl}
          onClose={handleNotificationClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { mt: 1.5, borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)' } }}
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
                <ListItem key={notification.id}>
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

        {/* 사용자 아바타 */}
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
          PaperProps={{ sx: { mt: 1.5, borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', minWidth: 200 } }}
        >
          <Box sx={{ px: 2.5, py: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {profile?.name || user?.email?.split('@')[0] || '사용자'}
            </Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleOpenPasswordModal} sx={{ mx: 1, borderRadius: 1, fontSize: '0.9rem' }}>비밀번호 변경</MenuItem>
          <MenuItem onClick={handleLogout} sx={{ mx: 1, borderRadius: 1, fontSize: '0.9rem', color: 'error.main' }}>로그아웃</MenuItem>
        </Menu>
      </Box>

      {/* 비밀번호 변경 다이얼로그 */}
      <Dialog open={openPasswordModal} onClose={() => setOpenPasswordModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>비밀번호(PIN) 변경</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField autoFocus label="새 비밀번호 (최소 6자리 숫자/영문)" type="password" fullWidth value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <TextField label="새 비밀번호 확인" type="password" fullWidth value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPasswordModal(false)}>취소</Button>
          <Button onClick={handlePasswordChange} variant="contained">변경하기</Button>
        </DialogActions>
      </Dialog>

      {/* 피드백 다이얼로그 */}
      <Dialog open={openFeedback} onClose={() => setOpenFeedback(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          기능 개선 제안하기
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.5 }}>
            불편하셨나요? 더 나은 서비스를 위해 알려주세요.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>

          {/* 위치 */}
          <TextField
            label="위치"
            fullWidth
            size="small"
            value={feedbackLocation}
            onChange={(e) => setFeedbackLocation(e.target.value)}
            helperText="현재 페이지가 자동 입력됩니다. 직접 수정할 수 있어요."
          />

          {/* 유형 */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>유형 *</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {FEEDBACK_TYPES.map(t => (
                <Chip
                  key={t.value}
                  label={t.label}
                  onClick={() => setFeedbackType(t.value)}
                  variant={feedbackType === t.value ? 'filled' : 'outlined'}
                  color={feedbackType === t.value ? 'primary' : 'default'}
                  sx={{ fontWeight: feedbackType === t.value ? 700 : 400, cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>

          {/* 내용 */}
          <TextField
            label="내용 *"
            fullWidth
            multiline
            rows={4}
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            placeholder="구체적으로 적어주실수록 빠르게 개선할 수 있어요."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenFeedback(false)} disabled={feedbackSaving}>취소</Button>
          <Button
            onClick={handleSubmitFeedback}
            variant="contained"
            disabled={feedbackSaving}
            startIcon={feedbackSaving ? <CircularProgress size={14} /> : null}
          >
            {feedbackSaving ? '전송 중...' : '보내기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminHeader;
