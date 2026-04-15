import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Card,
  CardContent,
  alpha,
  useTheme,
  Tooltip,
  Chip,
  Grid,
  Avatar,
  MenuItem,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  VpnKey as VpnKeyIcon,
  People as PeopleIcon,
  AdminPanelSettings as AdminIcon,
  Shield as ShieldIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import EmptyState from './EmptyState';
import { supabase } from '../supabaseClient';
import { getRoleTemplates } from '../api/roleTemplates';

const UserManagementPage = () => {
  const theme = useTheme();
  const { user, accessToken, hasPermission, logout } = useAuth();
  const { addNotification } = useNotification();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openInviteModal, setOpenInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePIN, setInvitePIN] = useState('');
  const [inviteRole, setInviteRole] = useState('onsite');
  const [openMemoModal, setOpenMemoModal] = useState(false);
  const [currentEditingUser, setCurrentEditingUser] = useState(null);
  const [editedMemo, setEditedMemo] = useState('');
  const [openPermissionsModal, setOpenPermissionsModal] = useState(false);
  const [currentRole, setCurrentRole] = useState('');
  const [userFilter, setUserFilter] = useState(null); // null=전체, 'master'=관리자, 'recent'=최근활동
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Permission label mapping for preview chips
  const permissionLabels = {
    'master': '모든 권한',
    'dashboard:view': '대시보드',
    'orders:view': '주문 조회',
    'orders:edit': '주문 편집',
    'fulfillment:view': '출고 현황',
    'events:view': '학회 조회',
    'events:edit': '학회 편집',
    'products:view': '상품 조회',
    'products:edit': '상품 편집',
    'users:manage': '사용자 관리',
    'feedback:view': '피드백',
    'bulletins:manage': '게시판 관리',
  };

  // Fallback hardcoded roles (used only if templates fail to load)
  const fallbackRoles = [
    { key: 'master', label: '마스터' },
    { key: 'onsite', label: '현장 마케팅' },
    { key: 'fulfillment_book', label: '출고 (도서)' },
    { key: 'fulfillment_test', label: '출고 (검사)' }
  ];

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('list-users');

      if (invokeError) {
        throw invokeError;
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
      addNotification(`사용자 목록을 불러오는 데 실패했습니다: ${err.message}`, 'error');
      if (err.message.includes('Unauthorized') || err.message.includes('Forbidden')) {
        addNotification('권한이 없거나 세션이 만료되었습니다. 다시 로그인해주세요.', 'warning');
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, addNotification, logout]);

  useEffect(() => {
    if (user && hasPermission('users:manage')) {
      fetchUsers();
      fetchRoleTemplates();
    }
  }, [user, hasPermission, fetchUsers]);

  const fetchRoleTemplates = async () => {
    try {
      const data = await getRoleTemplates();
      setRoleTemplates(data || []);
      // Auto-select the first template if available
      if (data && data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching role templates:', err);
      // Fallback: templates won't be available, hardcoded roles can be used
    }
  };

  const getSelectedTemplate = () => {
    return roleTemplates.find((t) => t.id === selectedTemplateId) || null;
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!hasPermission('users:manage')) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }
    const isMasterUser = users.find(u => u.id === userId)?.role === 'master';
    if (isMasterUser && userId === user.id && newRole !== 'master') {
      addNotification('자신의 master 권한을 변경할 수 없습니다.', 'warning');
      return;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-user-role', {
        body: { userId, newRole },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      addNotification('사용자 역할이 업데이트되었습니다.', 'success');
      fetchUsers();
    } catch (err) {
      console.error('Error updating role:', err);
      addNotification(`역할 업데이트 실패: ${err.message}`, 'error');
    }
  };

  const handleInviteUser = async () => {
    if (!hasPermission('users:manage')) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }
    if (!inviteName || !invitePIN) {
      addNotification('이름과 PIN(비밀번호)을 모두 입력해주세요.', 'warning');
      return;
    }
    if (invitePIN.length !== 6) {
      addNotification('PIN은 숫자 6자리로 입력해주세요.', 'warning');
      return;
    }

    // Email is mandatory in Supabase Auth, so we generate a unique internal one
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const sanitizedName = inviteName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user';
    const internalEmail = `${sanitizedName}_${randomSuffix}@inpsytorder.com`;

    try {
      // Build invite body: prefer roleTemplateId if templates are available
      const inviteBody = { email: internalEmail, name: inviteName, password: invitePIN };
      if (selectedTemplateId && roleTemplates.length > 0) {
        inviteBody.roleTemplateId = selectedTemplateId;
        // Also pass role as fallback label
        const tmpl = getSelectedTemplate();
        if (tmpl) inviteBody.role = tmpl.name;
      } else {
        inviteBody.role = inviteRole;
      }

      const { data, error: invokeError } = await supabase.functions.invoke('invite-user', {
        body: inviteBody,
      });

      if (invokeError) {
        // FunctionsHttpError often contains the actual error message in the details or response
        const errorMsg = invokeError.context?.statusText || invokeError.message;
        throw new Error(errorMsg);
      }
      if (data?.error) throw new Error(data.error);

      addNotification('사용자가 성공적으로 생성되었습니다.', 'success');
      setOpenInviteModal(false);
      setInviteName('');
      setInvitePIN('');
      fetchUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      addNotification(`사용자 생성 실패: ${err.message}`, 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!hasPermission('users:manage')) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }
    if (userId === user.id) {
      addNotification('자신을 삭제할 수 없습니다.', 'warning');
      return;
    }

    setDeleteTargetUser(userId);
  };

  const handleDeleteUserConfirm = async () => {
    const userId = deleteTargetUser;
    setDeleteTargetUser(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      addNotification('사용자가 성공적으로 삭제되었습니다.', 'success');
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      addNotification(`사용자 삭제 실패: ${err.message}`, 'error');
    }
  };

  const handleOpenMemoModal = (user) => {
    setCurrentEditingUser(user);
    setEditedMemo(user.memo || '');
    setOpenMemoModal(true);
  };

  const handleSaveMemo = async () => {
    if (!hasPermission('users:manage')) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }
    if (!currentEditingUser) return;

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('update-user-memo', {
        body: { userId: currentEditingUser.id, memo: editedMemo },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      addNotification('메모가 성공적으로 업데이트되었습니다.', 'success');
      setOpenMemoModal(false);
      setCurrentEditingUser(null);
      setEditedMemo('');
      fetchUsers();
    } catch (err) {
      console.error('Error updating memo:', err);
      addNotification(`메모 업데이트 실패: ${err.message}`, 'error');
    }
  };

  const handleOpenPermissionsModal = (userToEdit) => {
    setCurrentEditingUser(userToEdit);
    setCurrentRole(userToEdit.role || 'onsite');
    setOpenPermissionsModal(true);
  };

  const handleSavePermissions = async () => {
    if (!currentEditingUser) return;
    await handleRoleChange(currentEditingUser.id, currentRole);
    setOpenPermissionsModal(false);
    setCurrentEditingUser(null);
    setCurrentRole('');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">오류: {error}</Typography>
        <Button onClick={fetchUsers} sx={{ mt: 2 }}>다시 시도</Button>
      </Box>
    );
  }

  if (!hasPermission('users:manage')) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">접근 권한이 없습니다.</Typography>
      </Box>
    );
  }

  const masterUsers = users.filter(u => u.role === 'master').length;
  const recentlyActiveCount = users.filter(u => {
    if (!u.last_sign_in_at) return false;
    const daysSinceLogin = (new Date() - new Date(u.last_sign_in_at)) / (1000 * 60 * 60 * 24);
    return daysSinceLogin < 7;
  }).length;

  const displayedUsers = userFilter === 'master'
    ? users.filter(u => u.role === 'master')
    : userFilter === 'recent'
    ? users.filter(u => {
        if (!u.last_sign_in_at) return false;
        return (new Date() - new Date(u.last_sign_in_at)) / (1000 * 60 * 60 * 24) < 7;
      })
    : users;

  const statCardSx = (active) => ({
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.15s',
    '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
    ...(active ? { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' } : {}),
  });

  return (
    <Box>
      {/* Header with Stats */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PeopleIcon sx={{ color: 'primary.main', fontSize: '1.4rem' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              사용자 관리
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenInviteModal(true)}
          >
            사용자 추가
          </Button>
        </Box>

        {/* Stats Cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Card onClick={() => setUserFilter(null)} sx={{ flex: 1,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, userFilter === null ? 0.6 : 0.2)}`,
            ...statCardSx(userFilter === null),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>전체 사용자</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{users.length}</Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, color: alpha(theme.palette.primary.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
          <Card onClick={() => setUserFilter(f => f === 'master' ? null : 'master')} sx={{ flex: 1,
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.warning.main, userFilter === 'master' ? 0.6 : 0.2)}`,
            ...statCardSx(userFilter === 'master'),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>관리자</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>{masterUsers}</Typography>
                </Box>
                <AdminIcon sx={{ fontSize: 40, color: alpha(theme.palette.warning.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
          <Card onClick={() => setUserFilter(f => f === 'recent' ? null : 'recent')} sx={{ flex: 1,
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, userFilter === 'recent' ? 0.6 : 0.2)}`,
            ...statCardSx(userFilter === 'recent'),
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>최근 활동 (7일)</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>{recentlyActiveCount}</Typography>
                </Box>
                <ScheduleIcon sx={{ fontSize: 40, color: alpha(theme.palette.success.main, 0.5) }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Users Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableCell sx={{ fontWeight: 'bold' }}>사용자</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>역할</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>메모</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>생성일</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>마지막 로그인</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="center">액션</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0, py: 4 }}>
                    <EmptyState
                      message="등록된 사용자가 없습니다"
                      subMessage="새 사용자를 초대하여 시작하세요"
                      icon={<PeopleIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                      action={{
                        label: "사용자 초대",
                        onClick: () => setOpenInviteModal(true)
                      }}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                displayedUsers.map((u) => (
                  <TableRow 
                    key={u.id}
                    sx={{ 
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                          {getInitials(u.name || u.email)}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {u.name || '이름 없음'}
                          </Typography>
                          {u.id === user.id && (
                            <Chip label="나" size="small" color="primary" sx={{ mt: 0.5, ml: 1 }} />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {u.role === 'master' ? (
                        <Chip icon={<ShieldIcon />} label="마스터" size="small" color="warning" />
                      ) : u.role === 'onsite' ? (
                        <Chip label="현장 마케팅" size="small" color="info" />
                      ) : u.role === 'fulfillment_book' ? (
                        <Chip label="출고 (도서)" size="small" color="secondary" />
                      ) : u.role === 'fulfillment_test' ? (
                        <Chip label="출고 (검사)" size="small" color="success" />
                      ) : (
                        <Chip label={u.role || '알 수 없음'} size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.memo || '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(u.created_at), 'yyyy.MM.dd')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(u.created_at), 'HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {u.last_sign_in_at ? (
                        <>
                          <Typography variant="body2">
                            {format(new Date(u.last_sign_in_at), 'yyyy.MM.dd')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(u.last_sign_in_at), 'HH:mm')}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">N/A</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="권한 관리">
                        <span>
                          <IconButton 
                            onClick={() => handleOpenPermissionsModal(u)} 
                            size="small"
                            disabled={u.id === user.id && u.role === 'master'}
                            sx={{ 
                              color: 'primary.main',
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                            }}
                          >
                            <VpnKeyIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="메모 수정">
                        <IconButton 
                          onClick={() => handleOpenMemoModal(u)} 
                          size="small"
                          sx={{ 
                            color: 'info.main',
                            '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.1) }
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="사용자 삭제">
                        <span>
                          <IconButton 
                            onClick={() => handleDeleteUser(u.id)} 
                            size="small"
                            disabled={u.id === user.id}
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={openInviteModal} onClose={() => setOpenInviteModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>새 사용자 추가</DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {roleTemplates.length > 0 ? (
            <>
              <TextField
                select
                fullWidth
                label="역할 템플릿"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                {roleTemplates.map((tmpl) => (
                  <MenuItem key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                    {tmpl.is_system ? ' (기본)' : ''}
                  </MenuItem>
                ))}
              </TextField>
              {/* Permission preview chips */}
              {getSelectedTemplate() && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(getSelectedTemplate().permissions || []).map((perm) => (
                    <Chip
                      key={perm}
                      label={permissionLabels[perm] || perm}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                </Box>
              )}
            </>
          ) : (
            <TextField
              select
              fullWidth
              label="역할"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {fallbackRoles.map((role) => (
                <MenuItem key={role.key} value={role.key}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            autoFocus
            label="이름"
            type="text"
            fullWidth
            required
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="예: 홍길동"
          />
          <TextField
            label="PIN (숫자 6자리)"
            type="password"
            fullWidth
            required
            value={invitePIN}
            onChange={(e) => setInvitePIN(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            placeholder="••••••"
            helperText={`숫자 6자리 고정 (${invitePIN.length}/6)`}
            error={invitePIN.length > 0 && invitePIN.length < 6}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenInviteModal(false)}>취소</Button>
          <Button onClick={handleInviteUser} variant="contained" sx={{ px: 4 }}>생성하기</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Memo Dialog */}
      <Dialog open={openMemoModal} onClose={() => setOpenMemoModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>메모 수정</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            autoFocus
            label="메모"
            type="text"
            fullWidth
            multiline
            rows={4}
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            placeholder="사용자에 대한 메모를 입력하세요"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenMemoModal(false)}>취소</Button>
          <Button onClick={handleSaveMemo} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>

      {/* Permissions/Role Dialog */}
      <Dialog open={openPermissionsModal} onClose={() => setOpenPermissionsModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>사용자 역할 관리</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {currentEditingUser && currentEditingUser.role === 'master' && currentEditingUser.id === user.id ? (
            <Box sx={{ 
              p: 3, 
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`
            }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                🛡️ 본인의 Master 권한은 해제할 수 없습니다.
              </Typography>
            </Box>
          ) : (
            <TextField
              select
              label="역할 선택"
              fullWidth
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
            >
              {availableRoles.map((role) => (
                <MenuItem key={role.key} value={role.key}>
                  {role.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPermissionsModal(false)}>취소</Button>
          <Button 
            onClick={handleSavePermissions} 
            disabled={currentEditingUser && currentEditingUser.role === 'master'}
            variant="contained"
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTargetUser)} onClose={() => setDeleteTargetUser(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>사용자 삭제</DialogTitle>
        <DialogContent>
          <Typography variant="body2">정말로 이 사용자를 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteTargetUser(null)}>취소</Button>
          <Button onClick={handleDeleteUserConfirm} color="error" variant="contained">삭제</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagementPage;