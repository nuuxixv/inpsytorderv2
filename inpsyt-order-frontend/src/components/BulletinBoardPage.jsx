import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import {
  Box,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormControl,
  Fab,
  IconButton,
  Divider,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import SimpleMarkdown from './SimpleMarkdown';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PushPinIcon from '@mui/icons-material/PushPin';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import {
  getBulletins,
  createBulletin,
  updateBulletin,
  deleteBulletin,
  markBulletinRead,
  getBulletinReaders,
} from '../api/bulletins';
import { PageHeader, SectionCard, EmptyState, ActionSlot } from './ui';

// 사양 §카테고리 필터 탭: 매뉴얼/패치노트/공지사항 인라인 hex.
// 사양 §핵심 발견 3 + 시안 주석에 따라 D17 후속 토큰화는 별도 사이클 — 게시판 카테고리는 인라인 유지.
const BULLETIN_CATEGORY = {
  manual:     { label: '매뉴얼',   color: '#3B82F6' },
  patch_note: { label: '패치노트', color: '#8B5CF6' },
  notice:     { label: '공지사항', color: '#F59E0B' },
};

// ─── 카테고리 칩 — 시안 CategoryChip 답습 ──────────────────────
const CategoryChip = ({ category }) => {
  const theme = useTheme();
  const meta = BULLETIN_CATEGORY[category];
  if (!meta) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(meta.color, 0.1),
        border: `1px solid ${alpha(meta.color, 0.25)}`,
      }}
    >
      <Typography variant="caption" sx={{ color: meta.color, fontWeight: 700, lineHeight: 1 }}>
        {meta.label}
      </Typography>
    </Box>
  );
};

// 고정 칩 — error 토큰
const PinnedChip = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        px: 0.75,
        py: 0.25,
        borderRadius: `${theme.radii.sm}px`,
        bgcolor: alpha(theme.palette.error.main, 0.1),
        border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
      }}
    >
      <PushPinIcon sx={{ fontSize: 12, color: theme.palette.error.main }} />
      <Typography variant="caption" sx={{ color: theme.palette.error.main, fontWeight: 700, lineHeight: 1 }}>
        고정
      </Typography>
    </Box>
  );
};

// 안 읽음 닷 — info 토큰
const UnreadDot = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: 8, height: 8,
        borderRadius: '50%',
        bgcolor: theme.palette.info.main,
        flexShrink: 0,
      }}
      aria-label="안 읽음"
    />
  );
};

// 행 액션 아이콘 — 시안/PR #14 RowIconButton 패턴 (36×36)
const RowIconButton = ({ tooltip, icon, onClick, danger = false, disabled = false }) => {
  const theme = useTheme();
  return (
    <Tooltip title={tooltip} placement="top" arrow>
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

const BulletinBoardPage = () => {
  const theme = useTheme();
  const { user, profile, permissions } = useAuth();
  const { addNotification } = useNotification();
  const isMaster = permissions.includes('master');

  const [bulletins, setBulletins] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [selectedBulletin, setSelectedBulletin] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create / Edit dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'notice',
    is_pinned: false,
  });
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Readers dialog
  const [openReaders, setOpenReaders] = useState(false);
  const [readers, setReaders] = useState([]);
  const [readersLoading, setReadersLoading] = useState(false);

  const loadBulletins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBulletins();
      setBulletins(data || []);

      // Load read status for current user
      if (user?.id) {
        const { data: readData } = await supabase
          .from('bulletin_reads')
          .select('bulletin_id')
          .eq('user_id', user.id);
        setReadIds(new Set((readData || []).map(r => r.bulletin_id)));
      }
    } catch (err) {
      setError(err.message || '게시글을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadBulletins();
  }, [loadBulletins]);

  const handleSelect = useCallback(async (bulletin) => {
    setSelectedBulletin(bulletin);

    // 사양 §액션 §게시글 선택: 안 읽은 글이면 markBulletinRead 호출. 실패 silent.
    if (user?.id && !readIds.has(bulletin.id)) {
      try {
        await markBulletinRead(bulletin.id, user.id, profile?.name || user.email);
        setReadIds(prev => new Set([...prev, bulletin.id]));
      } catch {
        // silent fail for read marking
      }
    }
  }, [user?.id, user?.email, profile?.name, readIds]);

  // 카테고리 필터 + 검색 필터링 — 시안 패턴 답습 (검색은 신규 — 시안에서 추가됨)
  const filteredBulletins = useMemo(() => {
    let list = bulletins;
    if (categoryFilter !== 'all') {
      list = list.filter(b => b.category === categoryFilter);
    }
    if (searchTerm.trim()) {
      const s = searchTerm.trim().toLowerCase();
      list = list.filter(b =>
        (b.title || '').toLowerCase().includes(s) ||
        (b.content || '').toLowerCase().includes(s),
      );
    }
    return list;
  }, [bulletins, categoryFilter, searchTerm]);

  const unreadCount = useMemo(
    () => bulletins.filter(b => !readIds.has(b.id)).length,
    [bulletins, readIds],
  );

  // Create / Edit handlers
  const handleOpenCreate = () => {
    setEditMode(false);
    setFormData({ title: '', content: '', category: 'notice', is_pinned: false });
    setOpenDialog(true);
  };

  const handleOpenEdit = () => {
    if (!selectedBulletin) return;
    setEditMode(true);
    setFormData({
      title: selectedBulletin.title,
      content: selectedBulletin.content,
      category: selectedBulletin.category,
      is_pinned: selectedBulletin.is_pinned,
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      addNotification('제목을 입력해주세요.', 'warning');
      return;
    }
    if (!formData.content.trim()) {
      addNotification('내용을 입력해주세요.', 'warning');
      return;
    }

    setSaving(true);
    try {
      if (editMode && selectedBulletin) {
        const updated = await updateBulletin(selectedBulletin.id, formData);
        setSelectedBulletin(updated);
        addNotification('게시글이 수정되었습니다.', 'success');
      } else {
        await createBulletin({
          ...formData,
          author_id: user.id,
          author_name: profile?.name || user?.email?.split('@')[0] || '관리자',
        });
        addNotification('게시글이 작성되었습니다.', 'success');
      }
      setOpenDialog(false);
      loadBulletins();
    } catch (err) {
      addNotification(`저장 실패: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBulletin) return;
    try {
      await deleteBulletin(selectedBulletin.id);
      addNotification('게시글이 삭제되었습니다.', 'success');
      setSelectedBulletin(null);
      setDeleteConfirm(false);
      loadBulletins();
    } catch (err) {
      addNotification(`삭제 실패: ${err.message}`, 'error');
    }
  };

  const handleOpenReaders = async () => {
    if (!selectedBulletin) return;
    setReadersLoading(true);
    setOpenReaders(true);
    try {
      const data = await getBulletinReaders(selectedBulletin.id);
      setReaders(data || []);
    } catch (err) {
      addNotification(`읽음 현황 로딩 실패: ${err.message}`, 'error');
    } finally {
      setReadersLoading(false);
    }
  };

  // 헤더 subtitle — 시안 정합 (안 읽음은 본인 기준)
  const headerSubtitle = `총 ${bulletins.length}개 · 안 읽음 ${unreadCount}개 (본인 기준)`;

  // 헤더 우측 액션 — master만
  const headerAction = isMaster && (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={handleOpenCreate}
    >
      새 글 작성
    </Button>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="게시판"
        subtitle={headerSubtitle}
        icon={AnnouncementIcon}
        action={headerAction}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${theme.radii.sm}px` }}>
          {error}
        </Alert>
      )}

      {/* 카테고리 필터 + 검색 — 시안 SectionCard 답습 */}
      <SectionCard sx={{ mb: 3 }} padding={20}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label="전체"
              size="small"
              onClick={() => setCategoryFilter('all')}
              sx={{
                cursor: 'pointer',
                fontWeight: categoryFilter === 'all' ? 700 : 500,
                bgcolor: categoryFilter === 'all' ? theme.palette.primary.main : 'transparent',
                color: categoryFilter === 'all' ? theme.palette.primary.contrastText : 'text.secondary',
                border: `1px solid ${categoryFilter === 'all' ? theme.palette.primary.main : theme.gray[200]}`,
                '&:hover': {
                  bgcolor: categoryFilter === 'all'
                    ? theme.palette.primary.dark
                    : alpha(theme.palette.primary.main, 0.04),
                },
              }}
            />
            {Object.entries(BULLETIN_CATEGORY).map(([key, meta]) => {
              const active = categoryFilter === key;
              return (
                <Chip
                  key={key}
                  label={meta.label}
                  size="small"
                  onClick={() => setCategoryFilter(key)}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: active ? 700 : 500,
                    bgcolor: active ? alpha(meta.color, 0.15) : 'transparent',
                    border: `1px solid ${active ? alpha(meta.color, 0.4) : theme.gray[200]}`,
                    color: active ? meta.color : 'text.secondary',
                    '&:hover': {
                      bgcolor: active ? alpha(meta.color, 0.2) : alpha(meta.color, 0.04),
                    },
                  }}
                />
              );
            })}
          </Box>
          <TextField
            size="small"
            placeholder="제목·본문 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', mr: 0.75 }} />,
            }}
            sx={{ flex: '1 1 200px', minWidth: 200, ml: { sm: 'auto' } }}
          />
        </Box>
      </SectionCard>

      {/* 좌(380) + 우(flex) 동시 패널 — 사양 §모바일·데스크탑 분기 */}
      <Box sx={{ display: 'flex', gap: 2, flexGrow: 1, minHeight: 0, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        {/* 좌측 — 게시글 목록 */}
        <SectionCard
          padding={0}
          sx={{
            width: { xs: '100%', md: 380 },
            display: { xs: selectedBulletin ? 'none' : 'block', md: 'block' },
            flexShrink: 0,
            maxHeight: { md: '75vh' },
            overflow: 'auto',
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filteredBulletins.length === 0 ? (
            <EmptyState
              icon={AnnouncementIcon}
              title="게시글이 없습니다"
              description={searchTerm.trim() || categoryFilter !== 'all' ? '필터를 조정해 주세요' : undefined}
            />
          ) : (
            <Box>
              {filteredBulletins.map((bulletin, idx) => {
                const isUnread = !readIds.has(bulletin.id);
                const isSelected = selectedBulletin?.id === bulletin.id;
                return (
                  <React.Fragment key={bulletin.id}>
                    <Box
                      onClick={() => handleSelect(bulletin)}
                      sx={{
                        px: 2.5, py: 1.75,
                        cursor: 'pointer',
                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                        borderLeft: isSelected
                          ? `3px solid ${theme.palette.primary.main}`
                          : '3px solid transparent',
                        transition: `background-color 0.15s ${theme.easing.toss}`,
                        '&:hover': {
                          bgcolor: isSelected
                            ? alpha(theme.palette.primary.main, 0.08)
                            : theme.gray[50],
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
                        {bulletin.is_pinned && <PinnedChip />}
                        <CategoryChip category={bulletin.category} />
                        {isUnread && <UnreadDot />}
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isUnread ? 700 : 500,
                          color: 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          mb: 0.5,
                        }}
                      >
                        {bulletin.title}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {bulletin.author_name || '관리자'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontFeatureSettings: '"tnum" 1' }}>
                          {format(new Date(bulletin.created_at), 'yyyy.MM.dd', { locale: ko })}
                        </Typography>
                      </Box>
                    </Box>
                    {idx < filteredBulletins.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </Box>
          )}
        </SectionCard>

        {/* 우측 — 게시글 상세 */}
        <Box
          sx={{
            flex: 1,
            display: { xs: selectedBulletin ? 'block' : 'none', md: 'block' },
            minWidth: 0,
            width: '100%',
          }}
        >
          {!selectedBulletin ? (
            <SectionCard padding={0}>
              <EmptyState
                icon={AnnouncementIcon}
                title="게시글을 선택해 주세요"
                description="좌측 목록에서 게시글을 선택하면 내용이 표시됩니다."
              />
            </SectionCard>
          ) : (
            <SectionCard padding={24}>
              {/* 모바일 한정 뒤로가기 */}
              <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                  onClick={() => setSelectedBulletin(null)}
                  sx={{ color: 'text.secondary' }}
                >
                  목록으로
                </Button>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
                {selectedBulletin.is_pinned && <PinnedChip />}
                <CategoryChip category={selectedBulletin.category} />
              </Box>
              <Typography variant="h3" sx={{ color: 'text.primary', lineHeight: 1.3, mb: 1 }}>
                {selectedBulletin.title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {selectedBulletin.author_name || '관리자'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>·</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                  {format(new Date(selectedBulletin.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                </Typography>
                {selectedBulletin.updated_at !== selectedBulletin.created_at && (
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    (수정됨)
                  </Typography>
                )}
                {/* master 전용 우측 액션 (사양 §우측 패널 line 448-460) */}
                {isMaster && (
                  <ActionSlot justify="flex-end" sx={{ ml: 'auto', gap: 0.5 }}>
                    <RowIconButton
                      tooltip="읽음 현황"
                      icon={<VisibilityIcon sx={{ fontSize: 18 }} />}
                      onClick={handleOpenReaders}
                    />
                    <RowIconButton
                      tooltip="수정"
                      icon={<EditIcon sx={{ fontSize: 18 }} />}
                      onClick={handleOpenEdit}
                    />
                    <RowIconButton
                      tooltip="삭제"
                      icon={<DeleteIcon sx={{ fontSize: 18 }} />}
                      onClick={() => setDeleteConfirm(true)}
                      danger
                    />
                  </ActionSlot>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              {/* 본문 — SimpleMarkdown 마크다운 렌더 (사양 §본문) */}
              <SimpleMarkdown content={selectedBulletin.content} />
            </SectionCard>
          )}
        </Box>
      </Box>

      {/* FAB — master only. 모바일에서 PageHeader 액션 대체 (사양 §FAB) */}
      {isMaster && (
        <Fab
          color="primary"
          aria-label="새 글 작성"
          onClick={handleOpenCreate}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            display: { xs: 'flex', md: 'none' },
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px` } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editMode ? '게시글 수정' : '새 글 작성'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <TextField
            label="제목"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            autoFocus
          />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, fontWeight: 600 }}>
              카테고리
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              >
                {Object.entries(BULLETIN_CATEGORY).map(([key, meta]) => (
                  <MenuItem key={key} value={key}>{meta.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <TextField
            label="내용 (마크다운)"
            fullWidth
            multiline
            rows={10}
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.is_pinned}
                onChange={(e) => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
              />
            }
            label="상단 고정"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDialog(false)} disabled={saving}>취소</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : null}
          >
            {saving ? '저장 중...' : editMode ? '수정하기' : '작성하기'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px` } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 700 }}>
          <Box
            sx={{
              width: 36, height: 36,
              borderRadius: `${theme.radii.sm}px`,
              bgcolor: alpha(theme.palette.error.main, 0.1),
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <WarningAmberRoundedIcon sx={{ fontSize: 20, color: theme.palette.error.main }} />
          </Box>
          게시글 삭제
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm(false)}>취소</Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* Readers Dialog (master only) */}
      <Dialog
        open={openReaders}
        onClose={() => setOpenReaders(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: `${theme.radii.lg}px` } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          읽음 현황
          {selectedBulletin && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, mt: 0.25 }}>
              {selectedBulletin.title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {readersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : readers.length === 0 ? (
            <Typography variant="body2" sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
              아직 읽은 사용자가 없습니다.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>이름</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>최초 확인</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>최종 확인</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {readers.map((reader) => (
                    <TableRow key={reader.user_id}>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {reader._userName || reader.user_name || reader.user_id}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                          {reader.first_read_at
                            ? format(new Date(reader.first_read_at), 'MM.dd HH:mm', { locale: ko })
                            : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontFeatureSettings: '"tnum" 1' }}>
                          {reader.last_read_at
                            ? format(new Date(reader.last_read_at), 'MM.dd HH:mm', { locale: ko })
                            : '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenReaders(false)} variant="contained">닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulletinBoardPage;
