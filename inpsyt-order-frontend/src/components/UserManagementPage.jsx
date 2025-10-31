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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

const UserManagementPage = () => {
  const { user, accessToken, hasPermission, permissions, logout } = useAuth();
  console.log('User object from useAuth:', user); // Add this line for debugging
  const { addNotification } = useNotification();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openInviteModal, setOpenInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [openMemoModal, setOpenMemoModal] = useState(false);
  const [currentEditingUser, setCurrentEditingUser] = useState(null);
  const [editedMemo, setEditedMemo] = useState('');
  const [openPermissionsModal, setOpenPermissionsModal] = useState(false);
  const [currentPermissions, setCurrentPermissions] = useState([]);

  const allPermissions = [
    { key: 'orders:view', label: '주문내역 보기' },
    { key: 'orders:edit', label: '주문내역 편집' },
    { key: 'products:view', label: '상품목록 보기' },
    { key: 'products:edit', label: '상품목록 편집' },
    { key: 'events:view', label: '학회목록 보기' },
    { key: 'events:edit', label: '학회목록 편집' },
    { key: 'users:manage', label: '사용자 관리' },
  ];

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/list-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorDetails = 'Failed to fetch users';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || errorDetails;
        } catch (jsonError) {
          // If parsing JSON fails, try to get the raw text
          try {
            const rawText = await response.text();
            errorDetails = `Failed to parse error response: ${rawText}`; // Log raw text
          } catch (textError) {
            errorDetails = `Failed to get error response text: ${textError.message}`;
          }
        }
        throw new Error(errorDetails);
      }

      const data = await response.json();
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
  }, [user, addNotification, logout]);

  useEffect(() => {
    if (user && hasPermission('users:manage')) {
      fetchUsers();
    }
  }, [user, hasPermission, fetchUsers]);

  const handlePermissionsChange = async (userId, newPermissions) => {
    if (!hasPermission('users:manage')) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }
    // Master user cannot change their own permissions to remove master status
    const isMasterUser = users.find(u => u.id === userId)?.role === 'master';
    if (isMasterUser && userId === user.id && !newPermissions.includes('master')) {
      addNotification('자신의 master 권한을 변경할 수 없습니다.', 'warning');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/update-user-permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, newPermissions }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update permissions');
      }

      addNotification('사용자 권한이 업데이트되었습니다.', 'success');
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error('Error updating permissions:', err);
      addNotification(`권한 업데이트 실패: ${err.message}`, 'error');
    }
  };

  const handleInviteUser = async () => {
    if (!hasPermission('users:manage')) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }
    if (!inviteEmail) {
      addNotification('이메일을 입력해주세요.', 'warning');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/invite-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to invite user');
      }

      addNotification('초대 이메일이 발송되었습니다.', 'success');
      setOpenInviteModal(false);
      setInviteEmail('');
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error('Error inviting user:', err);
      addNotification(`사용자 초대 실패: ${err.message}`, 'error');
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

    if (!window.confirm('정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/delete-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      addNotification('사용자가 성공적으로 삭제되었습니다.', 'success');
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error('Error deleting user:', err);
      addNotification(`사용자 삭제 실패: ${err.message}`, 'error');
    }
  };

  const handleOpenMemoModal = (user) => {
    setCurrentEditingUser(user);
    setEditedMemo(user.memo);
    setOpenMemoModal(true);
  };

  const handleSaveMemo = async () => {
    if (!hasPermission('users:manage')) {
      addNotification('권한이 없습니다.', 'error');
      return;
    }
    if (!currentEditingUser) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/update-user-memo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentEditingUser.id, memo: editedMemo }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update memo');
      }

      addNotification('메모가 성공적으로 업데이트되었습니다.', 'success');
      setOpenMemoModal(false);
      setCurrentEditingUser(null);
      setEditedMemo('');
      fetchUsers(); // Refresh list
    } catch (err) {
      console.error('Error updating memo:', err);
      addNotification(`메모 업데이트 실패: ${err.message}`, 'error');
    }
  };

  const handleOpenPermissionsModal = (userToEdit) => {
    setCurrentEditingUser(userToEdit);
    // If user is master, show all permissions checked
    if (userToEdit.role === 'master') {
      setCurrentPermissions(allPermissions.map(p => p.key));
    } else {
      setCurrentPermissions(userToEdit.permissions || []);
    }
    setOpenPermissionsModal(true);
  };

  const handleTogglePermission = (permissionKey) => {
    setCurrentPermissions(prev =>
      prev.includes(permissionKey)
        ? prev.filter(p => p !== permissionKey)
        : [...prev, permissionKey]
    );
  };

  const handleSavePermissions = async () => {
    if (!currentEditingUser) return;
    // If the user is master, their permissions should always be ['master']
    const newPermissions = currentEditingUser.role === 'master' ? ['master'] : currentPermissions;
    await handlePermissionsChange(currentEditingUser.id, newPermissions);
    setOpenPermissionsModal(false);
    setCurrentEditingUser(null);
    setCurrentPermissions([]);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">오류: {error}</Typography>
        <Button onClick={fetchUsers}>다시 시도</Button>
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>사용자 관리</Typography>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setOpenInviteModal(true)}
        >
          사용자 초대
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>이메일</TableCell>
              <TableCell>권한</TableCell>
              <TableCell>메모</TableCell>
              <TableCell>생성일</TableCell>
              <TableCell>마지막 로그인</TableCell>
              <TableCell align="right">액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {u.role === 'master' ? (
                    <Typography variant="body2" color="primary">master (모든 권한)</Typography>
                  ) : (
                    <Typography variant="body2">{u.permissions?.join(', ') || '없음'}</Typography>
                  )}
                </TableCell>
                <TableCell>{u.memo}</TableCell>
                <TableCell>{format(new Date(u.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                <TableCell>{u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'yyyy-MM-dd HH:mm') : 'N/A'}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenPermissionsModal(u)} color="primary" disabled={u.id === user.id && u.role === 'master'}> {/* Prevent master from editing own permissions */}
                    <VpnKeyIcon />
                  </IconButton>
                  <IconButton onClick={() => handleOpenMemoModal(u)} color="info">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteUser(u.id)} color="error" disabled={u.id === user.id}> {/* Prevent deleting self */}
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 사용자 초대 모달 */}
      <Dialog open={openInviteModal} onClose={() => setOpenInviteModal(false)}>
        <DialogTitle>사용자 초대</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="이메일 주소"
            type="email"
            fullWidth
            variant="standard"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInviteModal(false)}>취소</Button>
          <Button onClick={handleInviteUser}>초대</Button>
        </DialogActions>
      </Dialog>

      {/* 메모 수정 모달 */}
      <Dialog open={openMemoModal} onClose={() => setOpenMemoModal(false)}>
        <DialogTitle>메모 수정</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="메모"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="standard"
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMemoModal(false)}>취소</Button>
          <Button onClick={handleSaveMemo}>저장</Button>
        </DialogActions>
      </Dialog>

      {/* 권한 관리 모달 */}
      <Dialog open={openPermissionsModal} onClose={() => setOpenPermissionsModal(false)}>
        <DialogTitle>사용자 권한 관리</DialogTitle>
        <DialogContent>
          {currentEditingUser && currentEditingUser.role === 'master' ? (
            <Typography>Master 사용자는 모든 권한을 가집니다. 권한을 변경할 수 없습니다.</Typography>
          ) : (
            <FormGroup>
              {allPermissions.map(p => (
                <FormControlLabel
                  key={p.key}
                  control={
                    <Checkbox
                      checked={currentPermissions.includes(p.key)}
                      onChange={() => handleTogglePermission(p.key)}
                    />
                  }
                  label={p.label}
                />
              ))}
            </FormGroup>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPermissionsModal(false)}>취소</Button>
          <Button onClick={handleSavePermissions} disabled={currentEditingUser && currentEditingUser.role === 'master'}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagementPage;