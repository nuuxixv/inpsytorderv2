import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Tooltip, Snackbar, Avatar, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Checkbox,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Search as SearchIcon,
  VpnKey as VpnKeyIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Shield as ShieldIcon,
  Store as StoreIcon,
  LocalShipping as ShippingIcon,
  Add as AddIcon,
  Lock as LockIcon,
  Close as CloseIcon,
  WarningAmberRounded as WarningIcon,
  AdminPanelSettings as AdminIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { PageHeader, SectionCard, StatCard, ActionSlot, EmptyState } from './ui';
import PreviewShell from './preview/PreviewShell';

/**
 * DEV-ONLY keystone: /preview/users.
 * 어드민 사용자 관리 디자인 시안 — 실 UserManagementPage.jsx 사양 1:1 반영.
 * 사양 시트: design-system/specs/A7_UserManagementPage.md
 *
 * 핵심 발견 반영(사양 시트 §핵심 발견):
 *  - 역할 슬러그 4종 박힘 + 신규 슬러그 fallback 칩
 *  - master 본인 보호 3곳 분산(권한 아이콘 / 삭제 아이콘 / 변경 모달 warning)
 *  - 사용자 추가 폼에 이메일 필드 없음(자동 생성)
 *  - 역할 템플릿 권한 매트릭스 11종
 */

// ─── Mock 데이터 ───────────────────────────────────────────────

const PERMISSION_COLUMNS = [
  { key: 'dashboard:view',   label: '대시보드' },
  { key: 'orders:view',      label: '주문 조회' },
  { key: 'orders:edit',      label: '주문 편집' },
  { key: 'fulfillment:view', label: '출고 현황' },
  { key: 'events:view',      label: '학회 조회' },
  { key: 'events:edit',      label: '학회 편집' },
  { key: 'products:view',    label: '상품 조회' },
  { key: 'products:edit',    label: '상품 편집' },
  { key: 'users:manage',     label: '사용자 관리' },
  { key: 'feedback:view',    label: '피드백' },
  { key: 'bulletins:manage', label: '게시판 관리' },
];

const ROLE_CHIP_META = {
  master:            { label: '마스터',       color: 'warning',   icon: ShieldIcon },
  onsite:            { label: '현장 마케팅',  color: 'info',      icon: StoreIcon },
  fulfillment_book:  { label: '출고 (도서)',  color: 'secondary', icon: ShippingIcon },
  fulfillment_test:  { label: '출고 (검사)',  color: 'success',   icon: ShippingIcon },
};

// 자기 자신은 me_id로 표시 — master 본인 보호 분기 시뮬레이션
const ME_ID = 'u-001';

const MOCK_USERS = [
  { id: 'u-001', name: '김건우',  role: 'master',           memo: '운영 총괄',                created_at: '2026-01-10T09:12:00', last_sign_in_at: '2026-05-28T08:14:00' },
  { id: 'u-002', name: '이수정',  role: 'master',           memo: '백오피스 보조',            created_at: '2026-02-04T15:20:00', last_sign_in_at: '2026-05-27T17:42:00' },
  { id: 'u-003', name: '박지훈',  role: 'onsite',           memo: '5월 학회 부스 담당',       created_at: '2026-03-18T11:05:00', last_sign_in_at: '2026-05-26T09:30:00' },
  { id: 'u-004', name: '최서연',  role: 'onsite',           memo: '봄 학회 / 가을 학회',     created_at: '2026-03-18T11:10:00', last_sign_in_at: '2026-05-25T18:12:00' },
  { id: 'u-005', name: '정다은',  role: 'onsite',           memo: '',                          created_at: '2026-04-02T10:00:00', last_sign_in_at: null },
  { id: 'u-006', name: '강민호',  role: 'fulfillment_book', memo: '도서 출고 전담 (외주)',   created_at: '2026-04-08T13:45:00', last_sign_in_at: '2026-05-28T07:55:00' },
  { id: 'u-007', name: '윤지우',  role: 'fulfillment_book', memo: '',                          created_at: '2026-04-15T16:22:00', last_sign_in_at: '2026-05-27T16:18:00' },
  { id: 'u-008', name: '한지훈',  role: 'fulfillment_test', memo: '검사 출고 / 재고 확인',   created_at: '2026-04-22T09:00:00', last_sign_in_at: '2026-05-28T06:40:00' },
  // 신규 슬러그 — 칩 fallback 시뮬레이션(사양 §핵심 발견 1)
  { id: 'u-009', name: '조혜린',  role: 'external_partner', memo: '외부 파트너 (가을 학회)', created_at: '2026-05-15T11:30:00', last_sign_in_at: null },
];

const MOCK_ROLE_TEMPLATES = [
  {
    id: 't-001', slug: 'master', name: '마스터', is_system: true,
    description: '모든 권한 보유. 본인의 master 권한은 해제 불가.',
    permissions: PERMISSION_COLUMNS.map(p => p.key),
  },
  {
    id: 't-002', slug: 'onsite', name: '현장 마케팅', is_system: true,
    description: '학회 부스 운영 — 주문 접수 및 조회.',
    permissions: ['dashboard:view', 'orders:view', 'orders:edit', 'events:view', 'products:view'],
  },
  {
    id: 't-003', slug: 'fulfillment_book', name: '출고 (도서)', is_system: true,
    description: '도서 출고 담당.',
    permissions: ['fulfillment:view', 'orders:view', 'products:view'],
  },
  {
    id: 't-004', slug: 'fulfillment_test', name: '출고 (검사)', is_system: true,
    description: '검사 출고 담당.',
    permissions: ['fulfillment:view', 'orders:view', 'products:view'],
  },
  {
    id: 't-005', slug: 'external_partner', name: '외부 파트너', is_system: false,
    description: '학회 시즌 임시 외주. 주문 조회만.',
    permissions: ['orders:view'],
  },
];

// ─── 헬퍼 ──────────────────────────────────────────────────────

const formatDateLine = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

const RoleChip = ({ role }) => {
  const theme = useTheme();
  const meta = ROLE_CHIP_META[role];
  if (!meta) {
    // 신규 슬러그 fallback — outlined, 슬러그 그대로(사양 §표시 §역할 셀)
    return (
      <Chip
        label={role}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 600, color: 'text.secondary' }}
      />
    );
  }
  const Icon = meta.icon;
  const palette = (() => {
    if (meta.color === 'warning') return theme.palette.warning.main;
    if (meta.color === 'info') return theme.palette.info.main;
    if (meta.color === 'secondary') return theme.palette.secondary.main;
    if (meta.color === 'success') return theme.palette.success.main;
    return theme.gray[600];
  })();
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
            width: 36, height: 36,
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

// ─── 사용자 추가 모달 ───────────────────────────────────────────

const InviteUserDialog = ({ open, onClose, onInvite, roleTemplates }) => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [roleTemplateId, setRoleTemplateId] = useState(roleTemplates[0]?.id || '');

  const handleClose = () => {
    setName(''); setPin(''); setRoleTemplateId(roleTemplates[0]?.id || '');
    onClose();
  };

  const pinValid = /^\d{6}$/.test(pin);
  const selectedTemplate = roleTemplates.find(t => t.id === roleTemplateId);

  const handleSubmit = () => {
    if (!name.trim() || !pinValid) return;
    onInvite({ name: name.trim(), pin, role: selectedTemplate?.slug || '' });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 440, width: '100%' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <PersonAddIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        </Box>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>
          새 사용자 추가
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        {/* 사양 §모달 1: 이메일 필드 없음 — 자동 생성 안내 */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: theme.gray[50],
            border: `1px solid ${theme.gray[200]}`,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6 }}>
            이메일은 시스템이 자동으로 생성합니다.
            <Box component="span" sx={{ display: 'block', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', mt: 0.25, color: 'text.disabled' }}>
              {name.trim() ? `${name.trim().toLowerCase()}_xxxxx@inpsytorder.com` : '예: hongildong_a1b2c@inpsytorder.com'}
            </Box>
          </Typography>
        </Box>

        <FormControl size="small" fullWidth>
          <InputLabel>역할 템플릿</InputLabel>
          <Select
            value={roleTemplateId}
            label="역할 템플릿"
            onChange={(e) => setRoleTemplateId(e.target.value)}
          >
            {roleTemplates.map(t => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}{t.is_system && ' (기본)'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 선택 템플릿 권한 미리보기 — 사양 §모달 1 */}
        {selectedTemplate && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selectedTemplate.permissions.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>권한 없음</Typography>
            ) : (
              selectedTemplate.permissions.map(p => {
                const label = PERMISSION_COLUMNS.find(c => c.key === p)?.label || p;
                return (
                  <Chip
                    key={p}
                    label={label}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                );
              })
            )}
          </Box>
        )}

        <TextField
          size="small" fullWidth autoFocus
          label="이름"
          placeholder="예: 홍길동"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <TextField
          size="small" fullWidth
          label="PIN (숫자 6자리)"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputProps={{ inputMode: 'numeric', maxLength: 6 }}
          helperText={`숫자 6자리 고정 (${pin.length}/6)`}
          error={pin.length > 0 && !pinValid}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name.trim() || !pinValid}
          sx={{ minHeight: 40 }}
        >
          생성하기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 권한 변경 모달 ─────────────────────────────────────────────

const RoleChangeDialog = ({ open, user, onClose, onSave, roleTemplates }) => {
  const theme = useTheme();
  const isSelfMaster = user?.id === ME_ID && user?.role === 'master';
  const [roleSlug, setRoleSlug] = useState(user?.role || '');

  React.useEffect(() => {
    if (user) setRoleSlug(user.role);
  }, [user]);

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 440, width: '100%' } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>
          사용자 역할 관리
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
          {user.name} 님의 역할
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        {/* 사양 §모달 3: 본인 master일 때 warning 박스 — 본인 보호 3곳 중 1곳 */}
        {isSelfMaster && (
          <Box
            sx={{
              p: 1.75,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.palette.warning.main, 0.08),
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
        )}

        <FormControl size="small" fullWidth disabled={isSelfMaster}>
          <InputLabel>역할 선택</InputLabel>
          <Select value={roleSlug} label="역할 선택" onChange={(e) => setRoleSlug(e.target.value)}>
            {roleTemplates.map(t => (
              <MenuItem key={t.id} value={t.slug}>
                {t.name}{t.is_system && ' (기본)'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained"
          onClick={() => { onSave(roleSlug); onClose(); }}
          disabled={isSelfMaster || roleSlug === user.role}
          sx={{ minHeight: 40 }}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메모 편집 모달 ─────────────────────────────────────────────

const MemoDialog = ({ open, user, onClose, onSave }) => {
  const theme = useTheme();
  const [memo, setMemo] = useState(user?.memo || '');

  React.useEffect(() => {
    if (user) setMemo(user.memo || '');
  }, [user]);

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 440, width: '100%' } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>메모 수정</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
          {user.name} 님
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="메모"
          placeholder="사용자에 대한 메모를 입력하세요"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={() => { onSave(memo); onClose(); }} sx={{ minHeight: 40 }}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 사용자 삭제 모달 ───────────────────────────────────────────

const DeleteUserDialog = ({ open, user, onClose, onConfirm }) => {
  const theme = useTheme();
  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 420, width: '100%' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
        <Box
          sx={{
            width: 36, height: 36,
            borderRadius: `${theme.radii.sm}px`,
            bgcolor: alpha(theme.palette.error.main, 0.1),
            border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <WarningIcon sx={{ fontSize: 20, color: theme.palette.error.main }} />
        </Box>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>사용자 삭제</Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.primary', mb: 0.5 }}>
          <strong>{user.name}</strong> 님을 정말 삭제하시겠습니까?
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          이 작업은 되돌릴 수 없습니다.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
          onClick={onConfirm}
          sx={{ minHeight: 40 }}
        >
          삭제
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 역할 템플릿 편집 모달 ──────────────────────────────────────

const RoleTemplateDialog = ({ open, template, onClose, onSave }) => {
  const theme = useTheme();
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [permissions, setPermissions] = useState(template?.permissions || []);

  React.useEffect(() => {
    setName(template?.name || '');
    setDescription(template?.description || '');
    setPermissions(template?.permissions || []);
  }, [template]);

  const togglePermission = (key) => {
    setPermissions(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 560, width: '100%' } }}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>
          {template ? '역할 템플릿 편집' : '새 역할 추가'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        <TextField
          size="small" fullWidth autoFocus
          label="역할 이름"
          placeholder="예: 외부 파트너"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          fullWidth multiline rows={2}
          label="설명"
          placeholder="이 역할의 용도를 설명합니다."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontWeight: 600 }}>
            권한 ({permissions.length}/{PERMISSION_COLUMNS.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {PERMISSION_COLUMNS.map(p => {
              const checked = permissions.includes(p.key);
              return (
                <Chip
                  key={p.key}
                  label={p.label}
                  size="small"
                  onClick={() => togglePermission(p.key)}
                  variant={checked ? 'filled' : 'outlined'}
                  color={checked ? 'primary' : 'default'}
                  sx={{ fontWeight: checked ? 700 : 500, cursor: 'pointer' }}
                />
              );
            })}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ minHeight: 40, color: 'text.secondary' }}>취소</Button>
        <Button
          variant="contained"
          onClick={() => { onSave({ name, description, permissions }); onClose(); }}
          disabled={!name.trim()}
          sx={{ minHeight: 40 }}
        >
          {template ? '업데이트' : '생성하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── 메인 ──────────────────────────────────────────────────────

const UserManagementPreview = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [userFilter, setUserFilter] = useState(null); // null | 'master' | 'onsite' | 'fulfillment'
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleDialog, setRoleDialog] = useState({ open: false, user: null });
  const [memoDialog, setMemoDialog] = useState({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [templateDialog, setTemplateDialog] = useState({ open: false, template: null });
  const [deleteTemplateDialog, setDeleteTemplateDialog] = useState({ open: false, template: null });

  const counts = useMemo(() => {
    const masterCount = MOCK_USERS.filter(u => u.role === 'master').length;
    const onsiteCount = MOCK_USERS.filter(u => u.role === 'onsite').length;
    const fulfillmentCount = MOCK_USERS.filter(
      u => u.role === 'fulfillment_book' || u.role === 'fulfillment_test',
    ).length;
    return {
      total: MOCK_USERS.length,
      master: masterCount,
      onsite: onsiteCount,
      fulfillment: fulfillmentCount,
    };
  }, []);

  const filteredUsers = useMemo(() => {
    let list = MOCK_USERS;
    if (userFilter === 'master') list = list.filter(u => u.role === 'master');
    if (userFilter === 'onsite') list = list.filter(u => u.role === 'onsite');
    if (userFilter === 'fulfillment') {
      list = list.filter(u => u.role === 'fulfillment_book' || u.role === 'fulfillment_test');
    }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(s) || (u.memo || '').toLowerCase().includes(s));
    }
    return list;
  }, [userFilter, searchTerm]);

  const toggleFilter = (key) => setUserFilter(prev => prev === key ? null : key);

  const toast = (msg) => setSnackbar({ open: true, message: msg });

  return (
    <PreviewShell activePath="/admin/users">
      <PageHeader
        title="사용자 관리"
        subtitle={`총 ${counts.total}명 · 마스터 ${counts.master} · 현장 ${counts.onsite} · 출고 ${counts.fulfillment}`}
        icon={PeopleIcon}
        action={
          activeTab === 0 ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<PersonAddIcon sx={{ fontSize: 16 }} />}
              onClick={() => setInviteOpen(true)}
              sx={{ minHeight: 36 }}
            >
              사용자 추가
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => setTemplateDialog({ open: true, template: null })}
              sx={{ minHeight: 36 }}
            >
              새 역할 추가
            </Button>
          )
        }
      />

      {/* 탭 */}
      <Box sx={{ mb: 3, borderBottom: `1px solid ${theme.gray[200]}` }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="사용자 목록" />
          <Tab label="역할 템플릿" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <>
          {/* 통계 카드 4장 — 클릭 시 필터 토글 */}
          <SectionCard sx={{ mb: 3 }} padding={20}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box
                onClick={() => setUserFilter(null)}
                sx={{
                  flex: '1 1 180px',
                  cursor: 'pointer',
                  p: 1.5,
                  borderRadius: `${theme.radii.md}px`,
                  border: `1px solid ${userFilter === null ? theme.palette.primary.main : theme.gray[200]}`,
                  bgcolor: userFilter === null ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                  transition: `all 0.15s ${theme.easing.toss}`,
                }}
              >
                <StatCard label="전체 사용자" value={counts.total} unit="명" icon={PeopleIcon} color={theme.palette.primary.main} />
              </Box>
              <Box
                onClick={() => toggleFilter('master')}
                sx={{
                  flex: '1 1 180px',
                  cursor: 'pointer',
                  p: 1.5,
                  borderRadius: `${theme.radii.md}px`,
                  border: `1px solid ${userFilter === 'master' ? theme.palette.warning.main : theme.gray[200]}`,
                  bgcolor: userFilter === 'master' ? alpha(theme.palette.warning.main, 0.04) : 'background.paper',
                  transition: `all 0.15s ${theme.easing.toss}`,
                }}
              >
                <StatCard label="마스터" value={counts.master} unit="명" icon={AdminIcon} color={theme.palette.warning.main} />
              </Box>
              <Box
                onClick={() => toggleFilter('onsite')}
                sx={{
                  flex: '1 1 180px',
                  cursor: 'pointer',
                  p: 1.5,
                  borderRadius: `${theme.radii.md}px`,
                  border: `1px solid ${userFilter === 'onsite' ? theme.palette.info.main : theme.gray[200]}`,
                  bgcolor: userFilter === 'onsite' ? alpha(theme.palette.info.main, 0.04) : 'background.paper',
                  transition: `all 0.15s ${theme.easing.toss}`,
                }}
              >
                <StatCard label="현장 마케팅" value={counts.onsite} unit="명" icon={StoreIcon} color={theme.palette.info.main} />
              </Box>
              <Box
                onClick={() => toggleFilter('fulfillment')}
                sx={{
                  flex: '1 1 180px',
                  cursor: 'pointer',
                  p: 1.5,
                  borderRadius: `${theme.radii.md}px`,
                  border: `1px solid ${userFilter === 'fulfillment' ? theme.palette.success.main : theme.gray[200]}`,
                  bgcolor: userFilter === 'fulfillment' ? alpha(theme.palette.success.main, 0.04) : 'background.paper',
                  transition: `all 0.15s ${theme.easing.toss}`,
                }}
              >
                <StatCard label="출고 (도서+검사)" value={counts.fulfillment} unit="명" icon={ScheduleIcon} color={theme.palette.success.main} />
              </Box>
            </Box>
          </SectionCard>

          {/* 검색 + 필터 표시 */}
          <SectionCard sx={{ mb: 3 }} padding={20}>
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
                {filteredUsers.length}명 표시
              </Typography>
            </Box>
          </SectionCard>

          {/* 사용자 표 */}
          <SectionCard padding={0}>
            {filteredUsers.length === 0 ? (
              <EmptyState
                icon={PeopleIcon}
                title="등록된 사용자가 없습니다"
                description="새 사용자를 초대하여 시작하세요"
                action={{
                  label: '사용자 초대',
                  onClick: () => setInviteOpen(true),
                  startIcon: <PersonAddIcon sx={{ fontSize: 16 }} />,
                }}
              />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>사용자</TableCell>
                      <TableCell>역할</TableCell>
                      <TableCell>메모</TableCell>
                      <TableCell>생성일</TableCell>
                      <TableCell>마지막 로그인</TableCell>
                      <TableCell align="center">액션</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map(u => {
                      const isMe = u.id === ME_ID;
                      const isSelfMaster = isMe && u.role === 'master';
                      const created = formatDateLine(u.created_at);
                      const lastLogin = formatDateLine(u.last_sign_in_at);
                      return (
                        <TableRow key={u.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                              <Avatar
                                sx={{
                                  width: 32, height: 32,
                                  bgcolor: theme.palette.primary.main,
                                  color: theme.palette.primary.contrastText,
                                }}
                              >
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'inherit' }}>
                                  {u.name.charAt(0)}
                                </Typography>
                              </Avatar>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                    {u.name}
                                  </Typography>
                                  {isMe && (
                                    <Chip
                                      label="나"
                                      size="small"
                                      sx={{
                                        height: 18,
                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        color: theme.palette.primary.main,
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                                        '& .MuiChip-label': { px: 0.75, ...theme.typography.caption, fontWeight: 700 },
                                      }}
                                    />
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <RoleChip role={u.role} />
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                color: u.memo ? 'text.secondary' : 'text.disabled',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {u.memo || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFeatureSettings: '"tnum" 1' }}>
                              {created.date}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
                              {created.time}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {lastLogin ? (
                              <>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontFeatureSettings: '"tnum" 1' }}>
                                  {lastLogin.date}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
                                  {lastLogin.time}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>N/A</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <ActionSlot justify="center" sx={{ gap: 0.75 }}>
                              {/* 사양 §본인 보호 분기 1: 권한 관리 — 본인 master면 비활성 */}
                              <RowIconButton
                                tooltip="권한 관리"
                                icon={<VpnKeyIcon sx={{ fontSize: 16 }} />}
                                onClick={() => setRoleDialog({ open: true, user: u })}
                                disabled={isSelfMaster}
                              />
                              <RowIconButton
                                tooltip="메모 수정"
                                icon={<EditIcon sx={{ fontSize: 16 }} />}
                                onClick={() => setMemoDialog({ open: true, user: u })}
                              />
                              {/* 사양 §본인 보호 분기 2: 삭제 — 본인이면 비활성 */}
                              <RowIconButton
                                tooltip="사용자 삭제"
                                icon={<DeleteIcon sx={{ fontSize: 16 }} />}
                                onClick={() => setDeleteDialog({ open: true, user: u })}
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
        <SectionCard
          title="역할 템플릿 관리"
          subtitle="사용자에게 부여할 역할별 권한을 관리합니다. 시스템 기본 역할은 삭제할 수 없습니다."
          padding={20}
        >
          <TableContainer sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: 'sticky', left: 0, bgcolor: theme.gray[50], zIndex: 1 }}>역할</TableCell>
                  {PERMISSION_COLUMNS.map(p => (
                    <TableCell key={p.key} align="center" sx={{ minWidth: 88 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{p.label}</Typography>
                    </TableCell>
                  ))}
                  <TableCell align="center">액션</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {MOCK_ROLE_TEMPLATES.map(t => {
                  const isMaster = t.slug === 'master';
                  return (
                    <TableRow key={t.id} hover>
                      <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, minWidth: 220 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{t.name}</Typography>
                          {t.is_system && (
                            <Chip
                              icon={<LockIcon sx={{ fontSize: 12 }} />}
                              label="기본"
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, '& .MuiChip-label': { px: 0.5, ...theme.typography.caption } }}
                            />
                          )}
                        </Box>
                        {t.description && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {t.description}
                          </Typography>
                        )}
                      </TableCell>
                      {PERMISSION_COLUMNS.map(p => (
                        <TableCell key={p.key} align="center">
                          <Checkbox
                            size="small"
                            checked={t.permissions.includes(p.key) || isMaster}
                            disabled={isMaster}
                            sx={{ p: 0 }}
                            onChange={() => toast(`${t.name} · ${p.label} 토글 (mock)`)}
                          />
                        </TableCell>
                      ))}
                      <TableCell align="center">
                        {t.is_system ? (
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>-</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <RowIconButton
                              tooltip="역할 편집"
                              icon={<EditIcon sx={{ fontSize: 16 }} />}
                              onClick={() => setTemplateDialog({ open: true, template: t })}
                            />
                            <RowIconButton
                              tooltip="역할 삭제"
                              icon={<DeleteIcon sx={{ fontSize: 16 }} />}
                              onClick={() => setDeleteTemplateDialog({ open: true, template: t })}
                              danger
                            />
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}

      {/* 모달들 */}
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={({ name }) => toast(`${name} 님을 추가했습니다 (mock)`)}
        roleTemplates={MOCK_ROLE_TEMPLATES}
      />
      <RoleChangeDialog
        open={roleDialog.open}
        user={roleDialog.user}
        roleTemplates={MOCK_ROLE_TEMPLATES}
        onClose={() => setRoleDialog({ open: false, user: null })}
        onSave={(slug) => toast(`${roleDialog.user?.name} 역할을 ${slug}로 변경 (mock)`)}
      />
      <MemoDialog
        open={memoDialog.open}
        user={memoDialog.user}
        onClose={() => setMemoDialog({ open: false, user: null })}
        onSave={() => toast(`${memoDialog.user?.name} 메모 저장 (mock)`)}
      />
      <DeleteUserDialog
        open={deleteDialog.open}
        user={deleteDialog.user}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        onConfirm={() => {
          toast(`${deleteDialog.user?.name} 사용자 삭제 (mock)`);
          setDeleteDialog({ open: false, user: null });
        }}
      />
      <RoleTemplateDialog
        open={templateDialog.open}
        template={templateDialog.template}
        onClose={() => setTemplateDialog({ open: false, template: null })}
        onSave={({ name }) => toast(`역할 템플릿 "${name}" 저장 (mock)`)}
      />
      <Dialog
        open={deleteTemplateDialog.open}
        onClose={() => setDeleteTemplateDialog({ open: false, template: null })}
        PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px`, maxWidth: 420, width: '100%' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1.5 }}>
          <Box
            sx={{
              width: 36, height: 36,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.palette.error.main, 0.1),
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <WarningIcon sx={{ fontSize: 20, color: theme.palette.error.main }} />
          </Box>
          <Typography variant="h4" sx={{ letterSpacing: '-0.02em' }}>역할 템플릿 삭제</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            이 역할 템플릿을 삭제하시겠습니까? 이미 이 역할이 할당된 사용자에게는 영향이 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteTemplateDialog({ open: false, template: null })} sx={{ minHeight: 40, color: 'text.secondary' }}>
            취소
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              toast(`역할 "${deleteTemplateDialog.template?.name}" 삭제 (mock)`);
              setDeleteTemplateDialog({ open: false, template: null });
            }}
            sx={{ minHeight: 40 }}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbar.message}
        action={
          <IconButton size="small" color="inherit" onClick={() => setSnackbar({ open: false, message: '' })}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        }
      />
    </PreviewShell>
  );
};

export default UserManagementPreview;
