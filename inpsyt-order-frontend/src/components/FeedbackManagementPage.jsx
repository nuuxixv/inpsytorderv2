import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Card, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, FormControl, InputLabel, Select,
  MenuItem, CircularProgress, alpha, useTheme,
} from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReview';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getFeedback, updateFeedbackStatus } from '../api/feedback';
import { useNotification } from '../hooks/useNotification';
import EmptyState from './EmptyState';
import TableSkeleton from './TableSkeleton';

const TYPE_LABELS = {
  bug: '버그',
  ux: 'UX 개선',
  suggestion: '제안',
};

const STATUS_LABELS = {
  received: '접수',
  acknowledged: '작업예정',
  in_progress: '작업중',
  completed: '작업완료',
  deferred: '보류',
  cancelled: '접수취소',
};

const STATUS_COLORS = {
  received: 'default',
  acknowledged: 'info',
  in_progress: 'primary',
  completed: 'success',
  deferred: 'warning',
  cancelled: 'error',
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

const FeedbackManagementPage = () => {
  const theme = useTheme();
  const { addNotification } = useNotification();

  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);

  // Detail dialog state
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = statusFilter ? { status: statusFilter } : {};
      const data = await getFeedback(filters);
      setFeedbackList(data);
    } catch (err) {
      addNotification(`피드백 조회 실패: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, addNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRowClick = (fb) => {
    setSelectedFeedback(fb);
    setEditStatus(fb.status);
    setEditAdminNote(fb.admin_note || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedFeedback) return;
    setSaving(true);
    try {
      await updateFeedbackStatus(selectedFeedback.id, editStatus, editAdminNote);
      addNotification('피드백이 업데이트되었습니다.', 'success');
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      addNotification(`업데이트 실패: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedFeedback(null);
  };

  const truncate = (text, maxLen = 50) => {
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <RateReviewIcon sx={{ color: 'primary.main', fontSize: '1.6rem' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          피드백 관리
        </Typography>
      </Box>

      {/* Status filter chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Chip
          label="전체"
          variant={statusFilter === null ? 'filled' : 'outlined'}
          color={statusFilter === null ? 'primary' : 'default'}
          onClick={() => setStatusFilter(null)}
          sx={{ cursor: 'pointer', fontWeight: statusFilter === null ? 700 : 400 }}
        />
        {ALL_STATUSES.map((status) => (
          <Chip
            key={status}
            label={STATUS_LABELS[status]}
            variant={statusFilter === status ? 'filled' : 'outlined'}
            color={statusFilter === status ? STATUS_COLORS[status] : 'default'}
            onClick={() => setStatusFilter(status)}
            sx={{ cursor: 'pointer', fontWeight: statusFilter === status ? 700 : 400 }}
          />
        ))}
      </Box>

      {/* Table */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <TableSkeleton columns={6} rows={5} />
        ) : feedbackList.length === 0 ? (
          <EmptyState message="피드백이 없습니다." />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>생성일</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>제출자</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>위치</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>유형</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>내용</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {feedbackList.map((fb) => (
                  <TableRow
                    key={fb.id}
                    hover
                    onClick={() => handleRowClick(fb)}
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {format(new Date(fb.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </TableCell>
                    <TableCell>{fb._userName ||fb.user_name || fb.user_email || '-'}</TableCell>
                    <TableCell>{fb.location || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={TYPE_LABELS[fb.type] || fb.type}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{truncate(fb.content)}</TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_LABELS[fb.status] || fb.status}
                        size="small"
                        color={STATUS_COLORS[fb.status] || 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Detail dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>피드백 상세</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {selectedFeedback && (
            <>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
                  제출자
                </Typography>
                <Typography variant="body2">
                  {selectedFeedback._userName ||selectedFeedback.user_name || selectedFeedback.user_email || '-'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
                  위치
                </Typography>
                <Typography variant="body2">
                  {selectedFeedback.location || '-'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
                  유형
                </Typography>
                <Chip
                  label={TYPE_LABELS[selectedFeedback.type] || selectedFeedback.type}
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 60 }}>
                  생성일
                </Typography>
                <Typography variant="body2">
                  {format(new Date(selectedFeedback.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                </Typography>
              </Box>

              <TextField
                label="내용"
                multiline
                rows={4}
                fullWidth
                value={selectedFeedback.content}
                InputProps={{ readOnly: true }}
                sx={{ mt: 1 }}
              />

              <FormControl fullWidth size="small">
                <InputLabel>상태</InputLabel>
                <Select
                  value={editStatus}
                  label="상태"
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {ALL_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="관리자 메모"
                multiline
                rows={3}
                fullWidth
                value={editAdminNote}
                onChange={(e) => setEditAdminNote(e.target.value)}
                placeholder="내부 메모를 남겨주세요."
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleDialogClose} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : null}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeedbackManagementPage;
