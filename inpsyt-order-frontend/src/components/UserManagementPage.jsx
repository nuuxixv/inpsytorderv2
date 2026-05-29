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
  alpha,
  useTheme,
  Tooltip,
  Chip,
  Avatar,
  MenuItem,
  Tabs,
  Tab,
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
  Lock as LockIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { supabase } from '../supabaseClient';
import {
  getRoleTemplates,
  createRoleTemplate,
  updateRoleTemplate,
  deleteRoleTemplate,
} from '../api/roleTemplates';
import { PageHeader, SectionCard, EmptyState, ActionSlot } from './ui';

// Permission definitions for the matrix
const PERMISSION_COLUMNS = [
  { key: 'dashboard:view', label: '대시보드' },
  { key: 'orders:view', label: '주문 조회' },
  { key: 'orders:edit', label: '주문 편집' },
  { key: 'fulfillment:view', label: '출고 현황' },
  { key: 'events:view', label: '학회 조회' },
  { key: 'events:edit', label: '학회 편집' },
  { key: 'products:view', label: '상품 조회' },
  { key: 'products:edit', label: '상품 편집' },
  { key: 'users:manage', label: '사용자 관리' },
  { key: 'feedback:view', label: '피드백' },
  { key: 'bulletins:manage', label: '게시판 관리' },
];

// 역할 슬러그 4종 + fallback (사양 §핵심 발견 1)
const ROLE_CHIP_META = {
  master:           { label: '마스터',      colorKey: 'warning',   icon: ShieldIcon },
  onsite:           { label: '현장 마케팅', colorKey: 'info',      icon: null },
  fulfillment_book: { label: '출고 (도서)', colorKey: 'secondary', icon: null },
  fulfillment_test: { label: '출고 (검사)', colorKey: 'success',   icon: null },
};

// 사양 §역할 셀: 4종 매핑 + 신규 슬러그 outlined fallback.
const RoleChip = ({ role }) => {
  const theme = useTheme();
  const meta = ROLE_CHIP_META[role];
  if (!meta) {
    return (
      <Chip
        label={role || '알 수 없음'}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 600, color: 'text.secondary' }}
      />
    );
  }
  const palette = theme.palette[meta.colorKey]?.main || theme.gray[600];
  const Icon = meta.icon;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(palette, 0.1),
        border: `1px solid ${alpha(palette, 0.2)}`,
        color: palette,
      }}
    >
      {Icon && <Icon sx={{ fontSize: 14 }} />}
      <Typography variant="caption" sx={{ fontWeight: 700, color: palette, lineHeight: 1 }}>
        {meta.label}
      </Typography>
    </Box>
  );
};

// 행 액션 아이콘 — 시안 RowIconButton 패턴 (44 미만 touch 피함 — size small 32px 한계 vs 시안 36)
const RowIconButton = ({ tooltip, icon, onClick, danger = false, disabled = false }) => {
  const theme = useTheme();
  return (
    <Tooltip title={disabled ? `${tooltip} · 본인 보호` : tooltip} placement="top" arrow>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 36,
            height: 36,
            borderRadius: `${theme.radii.sm}px`,
            color: danger ? theme.palette.error.main : theme.gray[600],
            border: `1px solid ${theme.gray[200]}`,
            bgcolor: 'background.paper',
            transition: `all 0.15s ${theme.easing.toss}`,
            '&:hover': danger
              ? {
                  bgcolor: alpha(theme.palette.error.main, 0.06),
                  borderColor: alpha(theme.palette.error.main, 0.3),
                  color: theme.palette.error.dark,
                }
              : {
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  color: theme.palette.primary.main,
                },
            '&.Mui-disabled': { opacity: 0.4 },
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

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
  const [userFilter, setUserFilter] = useState(null); // null / 'master' / 'onsite' / 'fulfillment'
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  // Role template management state
  const [roleTemplatesLoading, setRoleTemplatesLoading] = useState(true);
  const [roleTemplateSaving, setRoleTemplateSaving] = useState(false);
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', permissions: [] });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Permission label mapping for preview chips
  const permissionLabels = {
    master: '모든 권한',
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
    { key: 'fulfillment_test', label: '출고 (검사)' },
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
      setRoleTemplatesLoading(true);
      const data = await getRoleTemplates();
      setRoleTemplates(data || []);
      // Auto-select the first template if available
      if (data && data.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching role templates:', err);
      // Fallback: templates won't be available, hardcoded roles can be used
    } finally {
      setRoleTemplatesLoading(false);
    }
  };

  const isMasterTemplate = (template) => template.is_system && template.name === '마스터';

  const handleTogglePermission = async (template, permissionKey) => {
    if (isMasterTemplate(template)) return;
    const currentPerms = template.permissions || [];
    const newPerms = currentPerms.includes(permissionKey)
      ? currentPerms.filter((p) => p !== permissionKey)
      : [...currentPerms, permissionKey];

    try {
      setRoleTemplateSaving(true);
      await updateRoleTemplate(template.id, {
        name: template.name,
        description: template.description,
        permissions: newPerms,
      });
      setRoleTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, permissions: newPerms } : t))
      );
      addNotification('권한이 업데이트되었습니다.', 'success');
    } catch (error) {
      console.error('Error updating permission:', error);
      addNotification(`권한 업데이트 실패: ${error.message}`, 'error');
    } finally {
      setRoleTemplateSaving(false);
    }
  };

  const handleOpenNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', permissions: [] });
    setOpenTemplateDialog(true);
  };

  const handleOpenEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      permissions: template.permissions || [],
    });
    setOpenTemplateDialog(true);
  };

  const handleTemplateFormPermissionToggle = (permKey) => {
    setTemplateForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter((p) => p !== permKey)
        : [...prev.permissions, permKey],
    }));
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      addNotification('역할 이름을 입력해주세요.', 'warning');
      return;
    }
    try {
      setRoleTemplateSaving(true);
      if (editingTemplate) {
        await updateRoleTemplate(editingTemplate.id, templateForm);
        addNotification('역할 템플릿이 업데이트되었습니다.', 'success');
      } else {
        await createRoleTemplate(templateForm);
        addNotification('역할 템플릿이 생성되었습니다.', 'success');
      }
      setOpenTemplateDialog(false);
      fetchRoleTemplates();
    } catch (error) {
      console.error('Error saving role template:', error);
      addNotification(`역할 템플릿 저장 실패: ${error.message}`, 'error');
    } finally {
      setRoleTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      setRoleTemplateSaving(true);
      await deleteRoleTemplate(id);
      addNotification('역할 템플릿이 삭제되었습니다.', 'success');
      setDeleteConfirmId(null);
      fetchRoleTemplates();
    } catch (error) {
      console.error('Error deleting role template:', error);
      addNotification(`역할 템플릿 삭제 실패: ${error.message}`, 'error');
    } finally {
      setRoleTemplateSaving(false);
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
    const isMasterUser = users.find((u) => u.id === userId)?.role === 'master';
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
        // slug를 role로 전달 (LoginPage에서 slug로 필터링)
        const tmpl = getSelectedTemplate();
        if (tmpl) inviteBody.role = tmpl.slug || tmpl.name;
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

  const handleOpenMemoModal = (u) => {
    setCurrentEditingUser(u);
    setEditedMemo(u.memo || '');
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

  const masterUsers = users.filter((u) => u.role === 'master').length;
  const onsiteUsers = users.filter((u) => u.role === 'onsite').length;
  const fulfillmentUsers = users.filter(
    (u) => u.role === 'fulfillment_book' || u.role === 'fulfillment_test',
  ).length;

  const filterApplied = userFilter === 'master'
    ? users.filter((u) => u.role === 'master')
    : userFilter === 'onsite'
    ? users.filter((u) => u.role === 'onsite')
    : userFilter === 'fulfillment'
    ? users.filter((u) => u.role === 'fulfillment_book' || u.role === 'fulfillment_test')
    : users;

  const displayedUsers = searchTerm.trim()
    ? filterApplied.filter((u) => {
        const s = searchTerm.trim().toLowerCase();
        return (u.name || '').toLowerCase().includes(s) || (u.memo || '').toLowerCase().includes(s);
      })
    : filterApplied;

  // 빠른 필터 카드 — 시안 QuickFilterCard 정합 (border 기반, 그라데이션 제거 — 02 §색 E항)
  const renderQuickFilterCard = (opts) => {
    const { key, label, value, Icon, baseColor } = opts;
    const active = userFilter === key;
    return (
      <Box
        key={String(key)}
        onClick={() => setUserFilter((prev) => (prev === key ? null : key))}
        sx={{
          flex: '1 1 160px',
          minWidth: 140,
          cursor: 'pointer',
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(baseColor, active ? 0.55 : 0.18)}`,
          borderRadius: `${theme.radii.md}px`,
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          transition: `all 0.15s ${theme.easing.toss}`,
          minHeight: 64,
          '&:hover': {
            borderColor: alpha(baseColor, 0.4),
            bgcolor: alpha(baseColor, 0.04),
          },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              display: 'block',
            }}
          >
            {label}
          </Typography>
          <Typography
            variant="h3"
            sx={{
              color: active ? baseColor : 'text.primary',
              lineHeight: 1.1,
              fontFeatureSettings: '"tnum" 1',
            }}
          >
            {value}
          </Typography>
        </Box>
        {Icon && (
          <Box
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(baseColor, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ fontSize: 20, color: baseColor }} />
          </Box>
        )}
      </Box>
    );
  };

  // 헤더 subtitle — 시안 정합. 통계 4장 압축본.
  const headerSubtitle = `총 ${users.length}명 · 마스터 ${masterUsers} · 현장 ${onsiteUsers} · 출고 ${fulfillmentUsers}`;

  const headerAction = activeTab === 0
    ? (
      <Button
        variant="contained"
        startIcon={<PersonAddIcon />}
        onClick={() => setOpenInviteModal(true)}
      >
        사용자 추가
      </Button>
    )
    : (
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleOpenNewTemplate}
      >
        새 역할 추가
      </Button>
    );

  return (
    <Box>
      <PageHeader
        title="사용자 관리"
        subtitle={headerSubtitle}
        icon={PeopleIcon}
        action={headerAction}
      />

      <Box sx={{ mb: 3, borderBottom: `1px solid ${theme.gray[200]}` }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="사용자 목록" />
          <Tab label="역할 템플릿" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          {/* Stats / Quick Filter Cards — 클릭 시 userFilter 토글 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {renderQuickFilterCard({
              key: null,
              label: '전체 사용자',
              value: users.length,
              Icon: PeopleIcon,
              baseColor: theme.palette.primary.main,
            })}
            {renderQuickFilterCard({
              key: 'master',
              label: '마스터',
              value: masterUsers,
              Icon: AdminIcon,
              baseColor: theme.palette.warning.main,
            })}
            {renderQuickFilterCard({
              key: 'onsite',
              label: '현장 마케팅',
              value: onsiteUsers,
              Icon: PeopleIcon,
              baseColor: theme.palette.info.main,
            })}
            {renderQuickFilterCard({
              key: 'fulfillment',
              label: '출고',
              value: fulfillmentUsers,
              Icon: ScheduleIcon,
              baseColor: theme.palette.success.main,
            })}
          </Box>

          {/* 검색 + 필터 표시 */}
          <SectionCard sx={{ mb: 3 }} padding={16}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="이름·메모 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
                }}
                sx={{ flex: '1 1 240px', minWidth: 240 }}
              />
              {userFilter && (
                <Chip
                  label={`필터: ${
                    userFilter === 'master' ? '마스터'
                      : userFilter === 'onsite' ? '현장 마케팅'
                      : '출고'
                  }`}
                  size="small"
                  onDelete={() => setUserFilter(null)}
                  deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    fontWeight: 600,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  }}
                />
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                {displayedUsers.length}명 표시
              </Typography>
            </Box>
          </SectionCard>

          {/* Users Table */}
          <SectionCard padding={0}>
            {displayedUsers.length === 0 ? (
              <EmptyState
                icon={PeopleIcon}
                title="등록된 사용자가 없습니다"
                description="새 사용자를 초대하여 시작하세요"
                action={{
                  label: '사용자 초대',
                  onClick: () => setOpenInviteModal(true),
                  startIcon: <PersonAddIcon sx={{ fontSize: 16 }} />,
                }}
              />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <TableCell sx={{ fontWeight: 700 }}>사용자</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>역할</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>메모</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>생성일</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>마지막 로그인</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">액션</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedUsers.map((u) => {
                      const isMe = u.id === user.id;
                      const isSelfMaster = isMe && u.role === 'master';
                      return (
                        <TableRow
                          key={u.id}
                          sx={{
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                            transition: `background-color 0.2s ${theme.easing.toss}`,
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar
                                sx={{
                                  bgcolor: theme.palette.primary.main,
                                  width: 36,
                                  height: 36,
                                  fontWeight: 700,
                                }}
                              >
                                {getInitials(u.name || u.email)}
                              </Avatar>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {u.name || '이름 없음'}
                                </Typography>
                                {isMe && (
                                  <Chip
                                    label="나"
                                    size="small"
                                    sx={{
                                      height: 20,
                                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                                      color: theme.palette.primary.main,
                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                                      '& .MuiChip-label': { px: 0.75, fontWeight: 700 },
                                    }}
                                  />
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <RoleChip role={u.role} />
                          </TableCell>
                          <TableCell sx={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            <Typography
                              variant="body2"
                              sx={{ color: u.memo ? 'text.secondary' : 'text.disabled' }}
                            >
                              {u.memo || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1' }}>
                              {format(new Date(u.created_at), 'yyyy.MM.dd')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                              {format(new Date(u.created_at), 'HH:mm')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {u.last_sign_in_at ? (
                              <>
                                <Typography variant="body2" sx={{ fontFeatureSettings: '"tnum" 1' }}>
                                  {format(new Date(u.last_sign_in_at), 'yyyy.MM.dd')}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                                  {format(new Date(u.last_sign_in_at), 'HH:mm')}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body2" sx={{ color: 'text.disabled' }}>N/A</Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <ActionSlot justify="center" sx={{ gap: 0.75 }}>
                              {/* 사양 §본인 보호 1: 권한 관리 — 본인 master면 비활성 */}
                              <RowIconButton
                                tooltip="권한 관리"
                                icon={<VpnKeyIcon sx={{ fontSize: 16 }} />}
                                onClick={() => handleOpenPermissionsModal(u)}
                                disabled={isSelfMaster}
                              />
                              <RowIconButton
                                tooltip="메모 수정"
                                icon={<EditIcon sx={{ fontSize: 16 }} />}
                                onClick={() => handleOpenMemoModal(u)}
                              />
                              {/* 사양 §본인 보호 2: 삭제 — 본인이면 비활성 */}
                              <RowIconButton
                                tooltip="사용자 삭제"
                                icon={<DeleteIcon sx={{ fontSize: 16 }} />}
                                onClick={() => handleDeleteUser(u.id)}
                                danger
                                disabled={isMe}
                              />
                            </ActionSlot>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>
        </>
      )}

      {activeTab === 1 && (
        <>
          <SectionCard
            title="역할 템플릿 관리"
            subtitle="사용자에게 부여할 역할별 권한을 관리합니다. 시스템 기본 역할은 삭제할 수 없습니다."
            padding={20}
          >
            {roleTemplatesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, minWidth: 140, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                        역할
                      </TableCell>
                      {PERMISSION_COLUMNS.map((col) => (
                        <TableCell
                          key={col.key}
                          align="center"
                          sx={{ fontWeight: 600, minWidth: 72, whiteSpace: 'nowrap' }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>{col.label}</Typography>
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 700, minWidth: 80 }}>액션</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roleTemplates.map((template) => {
                      const isMaster = isMasterTemplate(template);
                      return (
                        <TableRow key={template.id} hover>
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {template.name}
                              </Typography>
                              {template.is_system && (
                                <Chip
                                  label="기본"
                                  size="small"
                                  icon={<LockIcon sx={{ fontSize: 12 }} />}
                                  variant="outlined"
                                  sx={{ height: 20, '& .MuiChip-label': { px: 0.5, ...theme.typography.caption, fontWeight: 700 } }}
                                />
                              )}
                            </Box>
                            {template.description && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                {template.description}
                              </Typography>
                            )}
                          </TableCell>
                          {PERMISSION_COLUMNS.map((col) => {
                            const hasPerm = isMaster || (template.permissions || []).includes(col.key);
                            return (
                              <TableCell key={col.key} align="center" sx={{ p: 0.5 }}>
                                <Checkbox
                                  size="small"
                                  checked={hasPerm}
                                  disabled={isMaster || roleTemplateSaving}
                                  onChange={() => handleTogglePermission(template, col.key)}
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell align="center">
                            {!template.is_system ? (
                              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                                <RowIconButton
                                  tooltip="편집"
                                  icon={<EditIcon sx={{ fontSize: 16 }} />}
                                  onClick={() => handleOpenEditTemplate(template)}
                                />
                                <RowIconButton
                                  tooltip="삭제"
                                  icon={<DeleteIcon sx={{ fontSize: 16 }} />}
                                  onClick={() => setDeleteConfirmId(template.id)}
                                  danger
                                />
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>-</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </SectionCard>

          {/* New / Edit Role Template Dialog */}
          <Dialog open={openTemplateDialog} onClose={() => setOpenTemplateDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>
              {editingTemplate ? '역할 템플릿 편집' : '새 역할 추가'}
            </DialogTitle>
            <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                autoFocus
                label="역할 이름"
                fullWidth
                required
                value={templateForm.name}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="예: 외부 파트너"
                sx={{ mt: 1 }}
              />
              <TextField
                label="설명"
                fullWidth
                multiline
                rows={2}
                value={templateForm.description}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="이 역할의 용도를 설명합니다."
              />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  권한 선택
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {PERMISSION_COLUMNS.map((col) => (
                    <FormControlLabel
                      key={col.key}
                      control={
                        <Checkbox
                          size="small"
                          checked={templateForm.permissions.includes(col.key)}
                          onChange={() => handleTemplateFormPermissionToggle(col.key)}
                        />
                      }
                      label={<Typography variant="body2">{col.label}</Typography>}
                      sx={{ minWidth: 140 }}
                    />
                  ))}
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2.5 }}>
              <Button onClick={() => setOpenTemplateDialog(false)}>취소</Button>
              <Button
                variant="contained"
                onClick={handleSaveTemplate}
                disabled={roleTemplateSaving}
                sx={{ px: 4 }}
              >
                {roleTemplateSaving ? <CircularProgress size={22} /> : editingTemplate ? '업데이트' : '생성하기'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Template Confirmation Dialog */}
          <Dialog open={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)} maxWidth="xs">
            <DialogTitle sx={{ fontWeight: 700 }}>역할 템플릿 삭제</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                이 역할 템플릿을 삭제하시겠습니까? 이미 이 역할이 할당된 사용자에게는 영향이 없습니다.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDeleteConfirmId(null)}>취소</Button>
              <Button
                onClick={() => handleDeleteTemplate(deleteConfirmId)}
                color="error"
                variant="contained"
                disabled={roleTemplateSaving}
              >
                삭제
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {/* Add User Dialog */}
      <Dialog open={openInviteModal} onClose={() => setOpenInviteModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>새 사용자 추가</DialogTitle>
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
        <DialogTitle sx={{ fontWeight: 700 }}>메모 수정</DialogTitle>
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
        <DialogTitle sx={{ fontWeight: 700 }}>사용자 역할 관리</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {currentEditingUser && currentEditingUser.role === 'master' && currentEditingUser.id === user.id ? (
            /* 사양 §본인 보호 3: 본인 master일 때 warning 박스 — 본인 보호 3곳 중 1곳 */
            <Box
              sx={{
                p: 1.75,
                bgcolor: alpha(theme.palette.warning.main, 0.08),
                borderRadius: `${theme.radii.sm}px`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              <ShieldIcon sx={{ fontSize: 18, color: theme.palette.warning.main, mt: 0.25 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ color: theme.palette.warning.dark, mb: 0.25 }}>
                  본인의 마스터 권한은 해제할 수 없습니다
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                  다른 마스터 사용자가 변경하거나, 새 마스터를 먼저 지정한 뒤 시도하세요.
                </Typography>
              </Box>
            </Box>
          ) : (
            <TextField
              select
              label="역할 선택"
              fullWidth
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
            >
              {(roleTemplates.length > 0
                ? roleTemplates.map((t) => ({ key: t.name, label: t.name }))
                : fallbackRoles
              ).map((role) => (
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
            disabled={currentEditingUser && currentEditingUser.role === 'master' && currentEditingUser.id === user.id}
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
          <Typography variant="body2">
            정말로 이 사용자를 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
          </Typography>
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
