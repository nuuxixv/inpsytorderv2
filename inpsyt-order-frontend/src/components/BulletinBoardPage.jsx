import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
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
  Tabs,
  Tab,
  Badge,
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
} from '@mui/material';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import SimpleMarkdown from './SimpleMarkdown';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PushPinIcon from '@mui/icons-material/PushPin';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
  getUnreadCount,
  getBulletinReaders,
} from '../api/bulletins';

const BULLETIN_CATEGORIES = {
  manual: '매뉴얼',
  patch_note: '패치노트',
  notice: '공지사항',
};

const CATEGORY_COLORS = {
  manual: '#3B82F6',
  patch_note: '#8B5CF6',
  notice: '#F59E0B',
};

const BulletinBoardPage = () => {
  const { user, profile, permissions } = useAuth();
  const { addNotification } = useNotification();
  const isMaster = permissions.includes('master');

  const [bulletins, setBulletins] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [selectedBulletin, setSelectedBulletin] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
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

    // Mark as read
    if (user?.id && !readIds.has(bulletin.id)) {
      try {
        await markBulletinRead(bulletin.id, user.id, profile?.name || user.email);
        setReadIds(prev => new Set([...prev, bulletin.id]));
      } catch {
        // silent fail for read marking
      }
    }
  }, [user?.id, readIds]);

  // Filter bulletins by category
  const filteredBulletins = bulletins.filter(b =>
    categoryFilter === 'all' ? true : b.category === categoryFilter
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <AnnouncementIcon sx={{ color: 'primary.main', fontSize: '1.4rem' }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>게시판</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Main two-panel layout */}
      <Box sx={{ display: 'flex', gap: 2, flexGrow: 1, minHeight: 0 }}>
        {/* Left panel: bulletin list */}
        <Box sx={{
          width: { xs: '100%', md: 380 },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(selectedBulletin ? { display: { xs: 'none', md: 'flex' } } : {}),
        }}>
          {/* Category filter tabs */}
          <Tabs
            value={categoryFilter}
            onChange={(_, val) => setCategoryFilter(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 36,
              mb: 1.5,
              '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.85rem', fontWeight: 600 },
            }}
          >
            <Tab label="전체" value="all" />
            <Tab label="매뉴얼" value="manual" />
            <Tab label="패치노트" value="patch_note" />
            <Tab label="공지사항" value="notice" />
          </Tabs>

          {/* Bulletin list */}
          <Paper variant="outlined" sx={{ flexGrow: 1, overflow: 'auto', borderRadius: '12px' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredBulletins.length === 0 ? (
              <Box sx={{ textAlign: 'center', pt: 6, color: 'text.disabled' }}>
                <AnnouncementIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                <Typography variant="body2">게시글이 없습니다</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {filteredBulletins.map((bulletin, idx) => {
                  const isUnread = !readIds.has(bulletin.id);
                  const isSelected = selectedBulletin?.id === bulletin.id;

                  return (
                    <React.Fragment key={bulletin.id}>
                      {idx > 0 && <Divider />}
                      <ListItem disablePadding>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => handleSelect(bulletin)}
                          sx={{
                            px: 2,
                            py: 1.5,
                            '&.Mui-selected': {
                              bgcolor: 'primary.50',
                              borderLeft: '3px solid',
                              borderLeftColor: 'primary.main',
                            },
                          }}
                        >
                          <Box sx={{ width: '100%', minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                              {bulletin.is_pinned && (
                                <Chip
                                  icon={<PushPinIcon sx={{ fontSize: '0.7rem !important' }} />}
                                  label="고정"
                                  size="small"
                                  sx={{
                                    height: 18,
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    bgcolor: '#EF4444',
                                    color: '#fff',
                                    '& .MuiChip-label': { px: 0.5 },
                                    '& .MuiChip-icon': { color: '#fff', ml: 0.25 },
                                  }}
                                />
                              )}
                              <Chip
                                label={BULLETIN_CATEGORIES[bulletin.category] || bulletin.category}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '0.625rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  bgcolor: CATEGORY_COLORS[bulletin.category] || '#9CA3AF',
                                  color: '#fff',
                                  '& .MuiChip-label': { px: 0.75 },
                                }}
                              />
                              {isUnread && (
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: '#3B82F6',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </Box>
                            <Typography
                              sx={{
                                fontWeight: isUnread ? 700 : 500,
                                fontSize: '0.9rem',
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {bulletin.title}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {bulletin.author_name || '관리자'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {format(new Date(bulletin.created_at), 'yyyy.MM.dd', { locale: ko })}
                              </Typography>
                            </Box>
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Paper>
        </Box>

        {/* Right panel: bulletin detail */}
        <Box sx={{
          flexGrow: 1,
          minWidth: 0,
          overflow: 'auto',
          display: { xs: selectedBulletin ? 'block' : 'none', md: 'block' },
        }}>
          {!selectedBulletin ? (
            <Box sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.disabled',
              gap: 1,
            }}>
              <AnnouncementIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              <Typography variant="body2">게시글을 선택하면 내용이 표시됩니다</Typography>
            </Box>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: '12px', p: 3, height: '100%', overflow: 'auto' }}>
              {/* Mobile back button */}
              <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1 }}>
                <Button
                  startIcon={<ArrowBackIcon />}
                  onClick={() => setSelectedBulletin(null)}
                  size="small"
                >
                  목록으로
                </Button>
              </Box>

              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {selectedBulletin.is_pinned && (
                      <Chip
                        icon={<PushPinIcon sx={{ fontSize: '0.75rem !important' }} />}
                        label="고정"
                        size="small"
                        color="error"
                        sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                      />
                    )}
                    <Chip
                      label={BULLETIN_CATEGORIES[selectedBulletin.category] || selectedBulletin.category}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        bgcolor: CATEGORY_COLORS[selectedBulletin.category] || '#9CA3AF',
                        color: '#fff',
                      }}
                    />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    {selectedBulletin.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {selectedBulletin.author_name || '관리자'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {format(new Date(selectedBulletin.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </Typography>
                    {selectedBulletin.updated_at !== selectedBulletin.created_at && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        (수정됨)
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Master-only action buttons */}
                {isMaster && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={handleOpenReaders} title="읽음 현황">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={handleOpenEdit} title="수정">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDeleteConfirm(true)} title="삭제" color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Content (마크다운 지원) */}
              <SimpleMarkdown content={selectedBulletin.content} />
            </Paper>
          )}
        </Box>
      </Box>

      {/* FAB: Create new bulletin (master only) */}
      {isMaster && (
        <Fab
          color="primary"
          onClick={handleOpenCreate}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              카테고리
            </Typography>
            <Select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              fullWidth
              size="small"
            >
              {Object.entries(BULLETIN_CATEGORIES).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </Box>
          <TextField
            label="내용"
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
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>게시글 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm(false)}>취소</Button>
          <Button onClick={handleDelete} variant="contained" color="error">삭제</Button>
        </DialogActions>
      </Dialog>

      {/* Readers Dialog (master only) */}
      <Dialog open={openReaders} onClose={() => setOpenReaders(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>읽음 현황</DialogTitle>
        <DialogContent>
          {readersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : readers.length === 0 ? (
            <Typography sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
              아직 읽은 사용자가 없습니다.
            </Typography>
          ) : (
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
                    <TableCell>{reader._userName || reader.user_name || reader.user_id}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {reader.first_read_at ? format(new Date(reader.first_read_at), 'MM.dd HH:mm', { locale: ko }) : '-'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {reader.last_read_at ? format(new Date(reader.last_read_at), 'MM.dd HH:mm', { locale: ko }) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenReaders(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulletinBoardPage;
